import { describe, expect, it } from "vitest";

import { createChatRepository } from "@/server/chat/repository";
import {
  MessageContentSchema,
  providerContentFromMessage,
} from "@/server/chat/contracts";
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

  it("keeps a prepared report as a durable message block", () => {
    const content = MessageContentSchema.parse([
      { type: "text", text: "Your report is ready." },
      {
        type: "download_ref",
        artifactId: "11111111-1111-4111-8111-111111111111",
        revision: 2,
        reportKind: "campaign_plan",
        title: "Everyday essentials campaign plan",
        filename: "everyday-essentials-campaign-plan-r2",
        formats: ["xlsx", "csv"],
      },
    ]);

    expect(providerContentFromMessage(content)).toBe(
      "Your report is ready.\n[Campaign plan report 11111111-1111-4111-8111-111111111111, revision 2, available as XLSX and CSV]",
    );
  });
});
