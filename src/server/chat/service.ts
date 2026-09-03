import "server-only";

import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { binaryToUuid, uuidToBinary } from "@/server/auth/ids";
import {
  MessageContentSchema,
  type ChatThread,
  type MessageContent,
} from "@/server/chat/contracts";
import { evidenceDatabase } from "@/server/db/client";

type ThreadRow = RowDataPacket & {
  id: Buffer;
  owner_user_id: Buffer;
  title: string;
  status: ChatThread["status"];
  created_at: Date;
  updated_at: Date;
};

function thread(row: ThreadRow): ChatThread {
  return {
    id: binaryToUuid(row.id),
    ownerId: binaryToUuid(row.owner_user_id),
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listThreads(ownerId: string): Promise<ChatThread[]> {
  const { pool } = evidenceDatabase();
  const [rows] = await pool.query<ThreadRow[]>(
    `SELECT id, owner_user_id, title, status, created_at, updated_at
     FROM ai_threads WHERE owner_user_id = ?
     ORDER BY updated_at DESC LIMIT 100`,
    [uuidToBinary(ownerId)],
  );
  return rows.map(thread);
}

export async function createThread(ownerId: string, title: string) {
  const id = randomUUID();
  const { pool } = evidenceDatabase();
  await pool.execute(
    `INSERT INTO ai_threads (id, owner_user_id, title) VALUES (?, ?, ?)`,
    [uuidToBinary(id), uuidToBinary(ownerId), title],
  );
  return {
    id,
    ownerId,
    title,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getOwnedThread(threadId: string, ownerId: string) {
  const { pool } = evidenceDatabase();
  const [rows] = await pool.query<ThreadRow[]>(
    `SELECT id, owner_user_id, title, status, created_at, updated_at
     FROM ai_threads WHERE id = ? AND owner_user_id = ? LIMIT 1`,
    [uuidToBinary(threadId), uuidToBinary(ownerId)],
  );
  if (!rows[0]) throw new Error("THREAD_NOT_FOUND");
  return thread(rows[0]);
}

type MessageRow = RowDataPacket & {
  id: Buffer;
  role: "user" | "assistant";
  sequence_number: number;
  content: string | MessageContent;
  created_at: Date;
};

export async function listMessages(threadId: string, ownerId: string) {
  await getOwnedThread(threadId, ownerId);
  const { pool } = evidenceDatabase();
  const [rows] = await pool.query<MessageRow[]>(
    `SELECT id, role, sequence_number, content, created_at
     FROM ai_messages WHERE thread_id = ? ORDER BY sequence_number ASC LIMIT 500`,
    [uuidToBinary(threadId)],
  );
  return rows.map((row) => ({
    id: binaryToUuid(row.id),
    role: row.role,
    sequenceNumber: row.sequence_number,
    content: MessageContentSchema.parse(
      typeof row.content === "string" ? JSON.parse(row.content) : row.content,
    ),
    createdAt: row.created_at,
  }));
}

export async function providerHistory(threadId: string, ownerId: string) {
  const messages = await listMessages(threadId, ownerId);
  return messages.map((message) => ({
    role: message.role,
    content: message.content
      .map((block) => {
        if (block.type === "text") return block.text;
        if (block.type === "artifact_ref") {
          return `[Plan artifact ${block.artifactId}, revision ${block.revision}]`;
        }
        return `[Evidence fact ${block.factId}]`;
      })
      .join("\n"),
  }));
}

export async function renameThread(threadId: string, ownerId: string, title: string) {
  const { pool } = evidenceDatabase();
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE ai_threads SET title = ? WHERE id = ? AND owner_user_id = ?`,
    [title, uuidToBinary(threadId), uuidToBinary(ownerId)],
  );
  if (result.affectedRows !== 1) throw new Error("THREAD_NOT_FOUND");
  return getOwnedThread(threadId, ownerId);
}

export async function deleteThread(threadId: string, ownerId: string) {
  const { pool } = evidenceDatabase();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM campaign_artifacts WHERE thread_id = ? AND owner_user_id = ?`,
      [uuidToBinary(threadId), uuidToBinary(ownerId)],
    );
    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM ai_threads WHERE id = ? AND owner_user_id = ?`,
      [uuidToBinary(threadId), uuidToBinary(ownerId)],
    );
    if (result.affectedRows !== 1) throw new Error("THREAD_NOT_FOUND");
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
