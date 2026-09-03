import { describe, expect, it } from "vitest";

import { createEvidenceRepository } from "@/server/evidence/repository";

const approvedFact = {
  factId: "journey-attention-lagos",
  metricId: "journey_attention_high",
  label: "High attention",
  value: 60,
  unit: "percent",
  numerator: 30,
  denominator: 50,
  respondentBase: 50,
  geography: "lagos",
  segment: { city: "lagos" },
  period: "2026-05",
  weighting: "unweighted",
  status: "approved",
  citation: {
    sourceId: "rbl-loma-ooh-penetration-databook-2026-r1",
    sha256:
      "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
    workbookField: "Q10",
    page: null,
  },
} as const;

describe("evidence repository", () => {
  it("never returns blocked facts", async () => {
    const repo = createEvidenceRepository({
      findFacts: async () => [
        { ...approvedFact, metricId: "four_week_recall", status: "blocked" },
      ],
    });

    await expect(
      repo.search({
        metricIds: ["four_week_recall"],
        geographyIds: ["lagos"],
      }),
    ).rejects.toThrow("EVIDENCE_BLOCKED");
  });

  it("returns a bounded answer contract for approved facts", async () => {
    const repo = createEvidenceRepository({
      findFacts: async () => [approvedFact],
    });

    await expect(
      repo.search({
        metricIds: ["journey_attention_high"],
        geographyIds: ["lagos"],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        factId: "journey-attention-lagos",
        respondentBase: 50,
        caveat:
          "Unweighted survey evidence for the study sample; not population reach or site delivery.",
      }),
    ]);
  });

  it("rejects low-base segments and unrestricted respondent queries", async () => {
    const lowBase = { ...approvedFact, respondentBase: 29 };
    const repo = createEvidenceRepository({ findFacts: async () => [lowBase] });

    await expect(
      repo.search({
        metricIds: ["journey_attention_high"],
        geographyIds: ["lagos"],
      }),
    ).rejects.toThrow("EVIDENCE_BASE_TOO_SMALL");

    await expect(
      repo.search({ metricIds: [], geographyIds: [] }),
    ).rejects.toThrow("BOUNDED_EVIDENCE_QUERY_REQUIRED");
  });
});
