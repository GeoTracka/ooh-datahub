import type { Brief } from "@/contracts/domain";
import type { ArtifactStore } from "@/server/artifacts/repository";
import type { ChatStore } from "@/server/chat/repository";

export const validBrief: Brief = {
  productName: "Everyday essentials",
  productDescription: "A household consumer product for everyday use.",
  targetAudience: "Working adults and family shoppers in Lagos.",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "all_day",
  budgetNgn: 20_000_000,
  normalizationBudgetNgn: 20_000_000,
  flightStart: "2026-10-01",
  flightEnd: "2026-10-31",
};

export function fakeArtifactStore({
  ownerId = "user_1",
  currentRevision = 1,
}: {
  ownerId?: string;
  currentRevision?: number;
} = {}): ArtifactStore {
  return {
    async findArtifact() {
      return {
        id: "art_1",
        ownerId,
        currentRevisionNumber: currentRevision,
        type: "plan",
      };
    },
    async appendRevision(input) {
      return {
        artifactId: input.artifactId,
        revision: currentRevision + 1,
        payload: input.payload,
      };
    },
  };
}

export function fakeChatStore({
  ownerId = "user_1",
}: {
  ownerId?: string;
} = {}): ChatStore {
  return {
    async findThread() {
      return {
        id: "thread_1",
        ownerId,
        title: "Campaign plan",
        status: "active",
        createdAt: new Date("2026-09-03T10:00:00Z"),
        updatedAt: new Date("2026-09-03T10:00:00Z"),
      };
    },
  };
}

