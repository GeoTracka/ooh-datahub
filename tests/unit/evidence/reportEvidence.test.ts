import { describe, expect, it } from "vitest";

import { reportEvidence } from "@/evidence/rblLoma2026/reportEvidence";

describe("reviewed report evidence", () => {
  it("contains bounded paraphrases with exact pages", () => {
    expect(reportEvidence.length).toBeGreaterThan(0);
    expect(
      reportEvidence.every(
        (item) => item.page > 0 && item.paraphrase.length <= 500,
      ),
    ).toBe(true);
    expect(
      reportEvidence.every(
        (item) => item.status === "approved" || item.status === "blocked",
      ),
    ).toBe(true);
  });

  it("does not approve the disputed four-week recall result", () => {
    const recall = reportEvidence.filter(
      (item) => item.metricId === "four_week_recall",
    );
    expect(recall.length).toBeGreaterThan(0);
    expect(recall.every((item) => item.status === "blocked")).toBe(true);
  });
});
