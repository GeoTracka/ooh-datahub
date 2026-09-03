import { describe, expect, it } from "vitest";

import { createChatRepository } from "@/server/chat/repository";
import { fakeChatStore } from "../../fixtures/aiRuntime";

describe("chat ownership", () => {
  it("does not reveal another owner's thread", async () => {
    const repo = createChatRepository(fakeChatStore({ ownerId: "user_2" }));
    await expect(repo.getThread("thread_1", "user_1")).rejects.toThrow(
      "THREAD_NOT_FOUND",
    );
  });

  it("returns an owned thread", async () => {
    const repo = createChatRepository(fakeChatStore());
    await expect(repo.getThread("thread_1", "user_1")).resolves.toMatchObject({
      id: "thread_1",
      title: "Campaign plan",
    });
  });
});
