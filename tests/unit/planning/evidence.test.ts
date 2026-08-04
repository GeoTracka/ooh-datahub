import { describe, expect, it } from "vitest";
import { evaluateEvidence } from "@/planning/evidence";

const syntheticProfile = {
  source: 25,
  validation: 25,
  temporal: 55,
  granularityCoverage: 60,
  completeness: 70,
  minimumCritical: 25,
  caps: [54],
  hasZeroCritical: false,
};

describe("evaluateEvidence", () => {
  it("computes the synthetic score as 40/D; 54 is only a ceiling", () => {
    expect(evaluateEvidence(syntheticProfile)).toEqual({ score: 40, grade: "D" });
  });

  it("fails closed when a critical component is zero", () => {
    expect(evaluateEvidence({ ...syntheticProfile, hasZeroCritical: true }))
      .toEqual({ score: 0, grade: "unavailable" });
  });
});
