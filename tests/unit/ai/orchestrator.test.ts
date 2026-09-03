import { describe, expect, it } from "vitest";

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
});
