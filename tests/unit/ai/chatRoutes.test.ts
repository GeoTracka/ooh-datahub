import { describe, expect, it } from "vitest";

import { createRespondHandler } from "@/server/chat/respondHandler";
import { ChatServerEventSchema } from "@/server/chat/contracts";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "planner@example.com",
  displayName: "Planner",
};
const threadId = "22222222-2222-4222-8222-222222222222";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requireUser: async () => user,
    getOwnedThread: async () => ({ id: threadId, ownerId: user.id }),
    checkRateLimit: async () => true,
    async *events() {
      yield { type: "response.started" as const, messageId: "message_1" };
      yield {
        type: "response.completed" as const,
        messageId: "message_1",
        suggestedActions: [],
      };
    },
    ...overrides,
  };
}

describe("chat response route", () => {
  it("returns 401 before parsing a command when there is no session", async () => {
    const handler = createRespondHandler(
      dependencies({ requireUser: async () => { throw new Error("UNAUTHENTICATED"); } }),
    );
    const response = await handler(new Request("http://localhost/api/chat/respond", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed command and 404 for another owner's thread", async () => {
    const malformed = await createRespondHandler(dependencies())(
      new Request("http://localhost/api/chat/respond", {
        method: "POST",
        body: JSON.stringify({ threadId, message: "" }),
      }),
    );
    expect(malformed.status).toBe(400);

    const hidden = await createRespondHandler(
      dependencies({ getOwnedThread: async () => { throw new Error("THREAD_NOT_FOUND"); } }),
    )(
      new Request("http://localhost/api/chat/respond", {
        method: "POST",
        body: JSON.stringify({ threadId, message: "Plan a campaign" }),
      }),
    );
    expect(hidden.status).toBe(404);
  });

  it("streams one valid JSON event per line with no buffering headers", async () => {
    const response = await createRespondHandler(dependencies())(
      new Request("http://localhost/api/chat/respond", {
        method: "POST",
        body: JSON.stringify({ threadId, message: "Plan a campaign" }),
      }),
    );
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(response.headers.get("cache-control")).toBe("no-store, no-transform");
    const lines = (await response.text()).trim().split("\n");
    expect(lines.map((line) => ChatServerEventSchema.parse(JSON.parse(line)))).toHaveLength(2);
  });
});
