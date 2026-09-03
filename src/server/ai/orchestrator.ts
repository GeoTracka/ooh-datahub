import { createHash, randomUUID } from "node:crypto";

import type { CurrentUser } from "@/server/auth/currentUser";
import type { ArtifactType } from "@/server/artifacts/contracts";
import type { ChatServerEvent } from "@/server/chat/contracts";
import type {
  PlannerProvider,
  ProviderUsage,
} from "@/server/ai/provider";

export type ToolArtifactResult = {
  id: string;
  type: ArtifactType;
  revision: number;
};

export type ToolExecutionResult = {
  output: unknown;
  artifact?: ToolArtifactResult;
};

export type RuntimeToolRegistry = {
  definitions: readonly unknown[];
  execute(
    name: string,
    argumentsJson: string,
    context: { user: CurrentUser; threadId: string; signal: AbortSignal },
  ): Promise<ToolExecutionResult | unknown>;
};

export type RuntimePersistence = {
  saveUserMessage(input: {
    id: string;
    threadId: string;
    userId: string;
    text: string;
  }): Promise<void>;
  startToolRun(input: {
    id: string;
    threadId: string;
    providerCallId: string;
    toolName: string;
    argumentsJson: string;
  }): Promise<void>;
  completeToolRun(input: {
    id: string;
    status: "completed" | "failed" | "cancelled";
    durationMs: number;
    output?: unknown;
    errorCode?: string;
  }): Promise<void>;
  saveAssistantMessage(input: {
    id: string;
    threadId: string;
    text: string;
    providerResponseId: string;
    artifacts: ToolArtifactResult[];
  }): Promise<void>;
  saveUsage(input: {
    id: string;
    userId: string;
    threadId: string;
    usage: ProviderUsage;
  }): Promise<void>;
};

export type PlannerResponseContext = {
  threadId: string;
  user: CurrentUser;
  text: string;
  history: unknown[];
  toolRegistry: RuntimeToolRegistry;
  persistence: RuntimePersistence;
  config: {
    maxToolCalls: number;
    maxProviderTurns: number;
    toolTimeoutMs: number;
  };
  idFactory?: () => string;
  signal?: AbortSignal;
};

function safetyIdentifier(userId: string) {
  return createHash("sha256").update(userId, "utf8").digest("hex");
}

function toolLabel(name: string) {
  return name.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function normalizedExecution(value: ToolExecutionResult | unknown): ToolExecutionResult {
  if (
    value &&
    typeof value === "object" &&
    "output" in value
  ) {
    return value as ToolExecutionResult;
  }
  return { output: value };
}

async function withToolTimeout<T>(
  durationMs: number,
  outerSignal: AbortSignal | undefined,
  execute: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  const abort = () => controller.abort(outerSignal?.reason);
  outerSignal?.addEventListener("abort", abort, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      execute(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort("TOOL_TIMEOUT");
          reject(new Error("TOOL_TIMEOUT"));
        }, durationMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    outerSignal?.removeEventListener("abort", abort);
  }
}

export async function* runPlannerResponse(
  provider: PlannerProvider,
  context: PlannerResponseContext,
): AsyncGenerator<ChatServerEvent> {
  const nextId = context.idFactory ?? randomUUID;
  const userMessageId = nextId();
  const assistantMessageId = nextId();
  const input: unknown[] = [
    ...context.history,
    { role: "user", content: context.text },
  ];
  const artifacts: ToolArtifactResult[] = [];
  let assistantText = "";
  let toolCalls = 0;
  let finalResponseId = "";

  await context.persistence.saveUserMessage({
    id: userMessageId,
    threadId: context.threadId,
    userId: context.user.id,
    text: context.text,
  });
  yield { type: "response.started", messageId: assistantMessageId };

  try {
    for (let turn = 0; turn < context.config.maxProviderTurns; turn += 1) {
      const calls: Array<{ callId: string; name: string; arguments: string }> = [];
      let completed = false;
      for await (const event of provider.stream({
        input,
        tools: context.toolRegistry.definitions,
        safetyIdentifier: safetyIdentifier(context.user.id),
        maxToolCalls: Math.max(0, context.config.maxToolCalls - toolCalls),
        signal: context.signal,
      })) {
        if (event.type === "text_delta") {
          assistantText += event.delta;
          yield { type: "text.delta", delta: event.delta };
        } else if (event.type === "function_call") {
          calls.push(event);
        } else if (event.type === "completed") {
          completed = true;
          finalResponseId = event.responseId;
          await context.persistence.saveUsage({
            id: nextId(),
            userId: context.user.id,
            threadId: context.threadId,
            usage: event.usage,
          });
        } else if (event.type === "failed") {
          throw new Error(event.code);
        }
      }
      if (!completed) throw new Error("PROVIDER_STREAM_INCOMPLETE");

      if (calls.length === 0) {
        await context.persistence.saveAssistantMessage({
          id: assistantMessageId,
          threadId: context.threadId,
          text: assistantText,
          providerResponseId: finalResponseId,
          artifacts,
        });
        yield {
          type: "response.completed",
          messageId: assistantMessageId,
          suggestedActions: artifacts.length
            ? ["Compare the three approaches", "Fine-tune the plan", "Open the visual planner"]
            : [],
        };
        return;
      }

      if (toolCalls + calls.length > context.config.maxToolCalls) {
        throw new Error("TOOL_CALL_LIMIT_REACHED");
      }

      for (const call of calls) {
        toolCalls += 1;
        const runId = nextId();
        const startedAt = Date.now();
        await context.persistence.startToolRun({
          id: runId,
          threadId: context.threadId,
          providerCallId: call.callId,
          toolName: call.name,
          argumentsJson: call.arguments,
        });
        yield { type: "tool.started", runId, label: toolLabel(call.name) };
        try {
          const execution = normalizedExecution(
            await withToolTimeout(
              context.config.toolTimeoutMs,
              context.signal,
              (signal) =>
                context.toolRegistry.execute(call.name, call.arguments, {
                  user: context.user,
                  threadId: context.threadId,
                  signal,
                }),
            ),
          );
          const durationMs = Date.now() - startedAt;
          await context.persistence.completeToolRun({
            id: runId,
            status: "completed",
            durationMs,
            output: execution.output,
          });
          yield { type: "tool.completed", runId, durationMs };
          if (execution.artifact) {
            artifacts.push(execution.artifact);
            yield {
              type: "artifact.created",
              artifactId: execution.artifact.id,
              artifactType: execution.artifact.type,
              revision: execution.artifact.revision,
            };
          }
          input.push(
            {
              type: "function_call",
              call_id: call.callId,
              name: call.name,
              arguments: call.arguments,
            },
            {
              type: "function_call_output",
              call_id: call.callId,
              output: JSON.stringify(execution.output),
            },
          );
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          const code = error instanceof Error ? error.message : "TOOL_EXECUTION_FAILED";
          await context.persistence.completeToolRun({
            id: runId,
            status: context.signal?.aborted ? "cancelled" : "failed",
            durationMs,
            errorCode: code,
          });
          throw error;
        }
      }
    }
    throw new Error("PROVIDER_TURN_LIMIT_REACHED");
  } catch (error) {
    const code = error instanceof Error ? error.message : "PLANNER_RESPONSE_FAILED";
    yield {
      type: "response.failed",
      code: code.slice(0, 96),
      recoverable: !context.signal?.aborted,
    };
  }
}
