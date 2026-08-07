import { describe, expect, it } from "vitest";
import { objectiveWeights, planningFit } from "@/planning/planningFit";

describe("Planning Fit", () => {
  it("uses the approved objective weights", () => {
    expect(objectiveWeights.broad_reach).toEqual({ A: 20, D: 35, C: 15, P: 20, E: 10 });
    expect(objectiveWeights.influential_core).toEqual({ A: 25, D: 35, C: 20, P: 10, E: 10 });
    expect(objectiveWeights.near_conversion).toEqual({ A: 25, D: 15, C: 35, P: 10, E: 15 });
  });

  it("keeps Economics inside Planning Fit and evidence outside it", () => {
    expect(planningFit(
      { A: 80, D: 70, C: 60, P: 50, E: 40 },
      "broad_reach",
    )).toBe(63.5);
  });
});
