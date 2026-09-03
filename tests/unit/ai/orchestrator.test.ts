import { describe, expect, it, vi } from "vitest";

import { runPlannerResponse } from "@/server/ai/orchestrator";
import {
  fakeProviderWithOneToolCall,
  requestContext,
} from "../../fixtures/aiRuntime";

describe("AI planner orchestrator", () => {
  it("streams text, executes validated tools, and emits a final artifact", async () => {
    const events = [];
    for await (const event of runPlannerResponse(
      fakeProviderWithOneToolCall(),
      requestContext,
    )) {
      events.push(event);
    }
    expect(events.map((event) => event.type)).toEqual([
      "response.started",
      "tool.started",
      "tool.completed",
      "artifact.created",
      "text.delta",
      "response.completed",
    ]);
  });

  it("streams and persists a prepared report download", async () => {
    const download = {
      artifactId: "11111111-1111-4111-8111-111111111111",
      revision: 2,
      reportKind: "campaign_plan" as const,
      title: "Everyday essentials campaign plan",
      filename: "everyday-essentials-campaign-plan-r2",
      formats: ["xlsx", "csv"] as const,
    };
    let turn = 0;
    const provider = {
      async *stream() {
        turn += 1;
        if (turn === 1) {
          yield {
            type: "function_call" as const,
            callId: "call_export",
            name: "prepare_artifact_export",
            arguments: JSON.stringify({
              artifactId: download.artifactId,
              expectedRevision: download.revision,
            }),
          };
          yield {
            type: "completed" as const,
            responseId: "resp_export_1",
            usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
          };
          return;
        }
        yield { type: "text_delta" as const, delta: "Your report is ready." };
        yield {
          type: "completed" as const,
          responseId: "resp_export_2",
          usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        };
      },
    };
    const saveAssistantMessage = vi.fn(async () => {});
    const events = [];

    for await (const event of runPlannerResponse(provider, {
      ...requestContext,
      text: "Export this plan as XLSX.",
      persistence: {
        ...requestContext.persistence,
        saveAssistantMessage,
      },
      toolRegistry: {
        definitions: [{ type: "function", name: "prepare_artifact_export" }],
        async execute() {
          return { output: download, download };
        },
      },
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "response.started",
      "tool.started",
      "tool.completed",
      "download.ready",
      "text.delta",
      "response.completed",
    ]);
    expect(events.find((event) => event.type === "download.ready")).toEqual({
      type: "download.ready",
      download,
    });
    expect(saveAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ downloads: [download] }),
    );
  });
});
