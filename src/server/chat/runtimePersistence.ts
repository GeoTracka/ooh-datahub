import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { uuidToBinary } from "@/server/auth/ids";
import type { MessageContent } from "@/server/chat/contracts";
import type { RuntimePersistence } from "@/server/ai/orchestrator";
import { evidenceDatabase } from "@/server/db/client";

async function nextMessageSequence(
  connection: PoolConnection,
  threadId: string,
) {
  const threadBinary = uuidToBinary(threadId);
  const [threads] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM ai_threads WHERE id = ? FOR UPDATE`,
    [threadBinary],
  );
  if (!threads[0]) throw new Error("THREAD_NOT_FOUND");
  const [rows] = await connection.query<(RowDataPacket & { next_sequence: number })[]>(
    `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
     FROM ai_messages WHERE thread_id = ?`,
    [threadBinary],
  );
  return rows[0]?.next_sequence ?? 1;
}

async function insertMessage(input: {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: MessageContent;
  providerResponseId?: string;
}) {
  const { pool } = evidenceDatabase();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const sequence = await nextMessageSequence(connection, input.threadId);
    await connection.execute(
      `INSERT INTO ai_messages
         (id, thread_id, role, sequence_number, content, provider_response_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidToBinary(input.id),
        uuidToBinary(input.threadId),
        input.role,
        sequence,
        JSON.stringify(input.content),
        input.providerResponseId ?? null,
      ],
    );
    await connection.execute(
      `UPDATE ai_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [uuidToBinary(input.threadId)],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function jsonValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function createMariaDbRuntimePersistence(): RuntimePersistence {
  const { pool } = evidenceDatabase();
  return {
    async saveUserMessage(input) {
      await insertMessage({
        id: input.id,
        threadId: input.threadId,
        role: "user",
        content: [{ type: "text", text: input.text }],
      });
    },
    async startToolRun(input) {
      let args: unknown;
      try {
        args = JSON.parse(input.argumentsJson);
      } catch {
        args = { unparsed: input.argumentsJson.slice(0, 50_000) };
      }
      await pool.execute(
        `INSERT INTO ai_tool_runs
           (id, thread_id, provider_call_id, tool_name, arguments_json, status)
         VALUES (?, ?, ?, ?, ?, 'running')`,
        [
          uuidToBinary(input.id),
          uuidToBinary(input.threadId),
          input.providerCallId,
          input.toolName,
          jsonValue(args),
        ],
      );
    },
    async completeToolRun(input) {
      await pool.execute(
        `UPDATE ai_tool_runs
         SET status = ?, duration_ms = ?, output_json = ?, error_code = ?,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          input.status,
          input.durationMs,
          input.output === undefined ? null : jsonValue(input.output),
          input.errorCode ?? null,
          uuidToBinary(input.id),
        ],
      );
    },
    async saveAssistantMessage(input) {
      const content: MessageContent = [
        ...(input.text ? [{ type: "text" as const, text: input.text }] : []),
        ...input.artifacts.map((artifact) => ({
          type: "artifact_ref" as const,
          artifactId: artifact.id,
          revision: artifact.revision,
        })),
      ];
      await insertMessage({
        id: input.id,
        threadId: input.threadId,
        role: "assistant",
        content,
        providerResponseId: input.providerResponseId,
      });
    },
    async saveUsage(input) {
      await pool.execute(
        `INSERT INTO ai_usage_events
           (id, user_id, thread_id, provider, model, input_tokens, output_tokens, total_tokens)
         VALUES (?, ?, ?, 'openai', ?, ?, ?, ?)`,
        [
          uuidToBinary(input.id),
          uuidToBinary(input.userId),
          uuidToBinary(input.threadId),
          process.env.OPENAI_MODEL?.trim() || "unconfigured",
          input.usage.inputTokens,
          input.usage.outputTokens,
          input.usage.totalTokens,
        ],
      );
    },
  };
}

export async function consumeAiRateLimit(userId: string) {
  const configured = Number.parseInt(process.env.AI_REQUESTS_PER_MINUTE ?? "12", 10);
  const limit = Number.isInteger(configured) && configured > 0 ? configured : 12;
  const { pool } = evidenceDatabase();
  const now = new Date();
  await pool.execute(
    `INSERT INTO ai_rate_limits
       (user_id, scope, window_started_at, request_count)
     VALUES (?, 'planner_response', ?, 1)
     ON DUPLICATE KEY UPDATE
       request_count = IF(window_started_at <= DATE_SUB(VALUES(window_started_at), INTERVAL 60 SECOND), 1, request_count + 1),
       window_started_at = IF(window_started_at <= DATE_SUB(VALUES(window_started_at), INTERVAL 60 SECOND), VALUES(window_started_at), window_started_at)`,
    [uuidToBinary(userId), now],
  );
  const [rows] = await pool.query<(RowDataPacket & { request_count: number })[]>(
    `SELECT request_count FROM ai_rate_limits
     WHERE user_id = ? AND scope = 'planner_response' LIMIT 1`,
    [uuidToBinary(userId)],
  );
  return (rows[0]?.request_count ?? limit + 1) <= limit;
}
