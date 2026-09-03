import { describe, expect, it } from "vitest";

import { createArtifactRepository } from "@/server/artifacts/repository";
import { fakeArtifactStore } from "../../fixtures/aiRuntime";

describe("artifact revisions", () => {
  it("rejects a stale parent revision", async () => {
    const repo = createArtifactRepository(
      fakeArtifactStore({ currentRevision: 3 }),
    );
    await expect(
      repo.appendRevision({
        artifactId: "art_1",
        ownerId: "user_1",
        expectedParentRevision: 2,
        payload: {
          type: "audience",
          version: 1,
          factIds: [],
          summary: "Updated audience context",
        },
        reason: "Change budget",
      }),
    ).rejects.toThrow("STALE_ARTIFACT_REVISION");
  });

  it("hides another owner's artifact", async () => {
    const repo = createArtifactRepository(
      fakeArtifactStore({ ownerId: "user_2" }),
    );
    await expect(repo.getArtifact("art_1", "user_1")).rejects.toThrow(
      "ARTIFACT_NOT_FOUND",
    );
  });
});

