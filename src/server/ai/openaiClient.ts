import "server-only";

import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseInput,
} from "openai/resources/responses/responses";

import { PLANNER_INSTRUCTIONS } from "@/server/ai/instructions";
import type {
  PlannerProvider,
  ProviderEvent,
  ProviderRequest,
} from "@/server/ai/provider";

type OpenAiRuntimeConfig = {
  apiKey: string;
  model: string;
};

export function openAiRuntimeConfig(): OpenAiRuntimeConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY_REQUIRED");
  if (!model) throw new Error("OPENAI_MODEL_REQUIRED");
  return { apiKey, model };
}

export function createOpenAiPlannerProvider(
  config = openAiRuntimeConfig(),
): PlannerProvider {
  const client = new OpenAI({ apiKey: config.apiKey });
  return {
    async *stream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
      const stream = await client.responses.create(
        {
          model: config.model,
          instructions: PLANNER_INSTRUCTIONS,
          input: request.input as ResponseInput,
          tools: request.tools as FunctionTool[],
          tool_choice: "auto",
          parallel_tool_calls: true,
          store: false,
          stream: true,
          safety_identifier: request.safetyIdentifier,
        },
        { signal: request.signal },
      );

      for await (const event of stream) {
        switch (event.type) {
          case "response.output_text.delta":
            yield { type: "text_delta", delta: event.delta };
            break;
          case "response.output_item.done":
            if (event.item.type === "function_call") {
              yield {
                type: "function_call",
                callId: event.item.call_id,
                name: event.item.name,
                arguments: event.item.arguments,
              };
            }
            break;
          case "response.completed": {
            const usage = event.response.usage;
            yield {
              type: "completed",
              responseId: event.response.id,
              usage: {
                inputTokens: usage?.input_tokens ?? 0,
                outputTokens: usage?.output_tokens ?? 0,
                totalTokens: usage?.total_tokens ?? 0,
              },
            };
            break;
          }
          case "response.failed":
            yield {
              type: "failed",
              code: event.response.error?.code ?? "OPENAI_RESPONSE_FAILED",
            };
            break;
          case "error":
            yield { type: "failed", code: event.code ?? "OPENAI_STREAM_ERROR" };
            break;
        }
      }
    },
  };
}
