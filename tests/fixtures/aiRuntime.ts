import type { Brief } from "@/contracts/domain";
import type { ArtifactStore } from "@/server/artifacts/repository";
import type { ChatStore } from "@/server/chat/repository";
import type { EvidenceAnswer, EvidenceQuery } from "@/server/evidence/repository";

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

export function fakeEvidenceRepository({
  answers,
}: {
  answers?: readonly EvidenceAnswer[];
} = {}) {
  const defaultAnswer: EvidenceAnswer = {
    factId: "journey-attention-lagos",
    metricId: "journey_attention_high",
    label: "High attention while travelling",
    value: 60,
    unit: "percent",
    numerator: 30,
    denominator: 50,
    respondentBase: 50,
    geography: "lagos",
    segment: { city: "lagos" },
    period: "2026-05",
    caveat: "Unweighted survey evidence for the study sample; not population reach or site delivery.",
    citation: {
      sourceId: "rbl-loma-ooh-penetration-databook-2026-r1",
      sha256: "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
      workbookField: "Q10",
      page: null,
    },
  };
  return {
    queries: [] as EvidenceQuery[],
    async search(query: EvidenceQuery): Promise<EvidenceAnswer[]> {
      this.queries.push(query);
      const available = answers ?? [defaultAnswer];
      return available.filter(
        (answer) =>
          query.metricIds.includes(answer.metricId) &&
          query.geographyIds.includes(answer.geography),
      );
    },
  };
}
