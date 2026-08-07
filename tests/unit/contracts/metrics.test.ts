import { describe, expect, it } from "vitest";
import { MetricClaimSchema } from "@/contracts/metrics";

const common = {
  id: "claim-1",
  label: "Demo delivery",
  sourceIds: ["demo-source"],
  caveats: ["Synthetic scenario"],
  applicability: "inside",
};

describe("MetricClaimSchema", () => {
  it("rejects Activity Potential with a people unit", () => {
    expect(() => MetricClaimSchema.parse({
      ...common,
      kind: "activity_potential",
      state: "modelled",
      evidence: "D",
      unit: "people",
      value: 72,
    })).toThrow();
  });

  it("accepts only Low/Base/High for an assumed demo reach", () => {
    expect(MetricClaimSchema.parse({
      ...common,
      kind: "scenario_target_reach",
      state: "assumed",
      evidence: "D",
      unit: "people",
      universe: 800_000,
      range: { type: "scenario", low: 220_000, base: 250_000, high: 285_000 },
    }).kind).toBe("scenario_target_reach");
  });

  it("rejects Influence Capture without a qi source", () => {
    expect(() => MetricClaimSchema.parse({
      ...common,
      kind: "influence_capture",
      state: "assumed",
      evidence: "D",
      unit: "percent",
      range: { type: "scenario", low: 40, base: 45, high: 51 },
    })).toThrow();
  });
});
