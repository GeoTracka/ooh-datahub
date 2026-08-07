import { describe, expect, it } from "vitest";
import { verifyFeatureRegistry } from "@/planning/featureRegistry";

describe("verifyFeatureRegistry", () => {
  it("rejects one derived feature assigned to two score pillars", () => {
    expect(() => verifyFeatureRegistry([
      { id: "restaurant-density", role: "score", pillar: "A" },
      { id: "restaurant-density", role: "score", pillar: "C" },
    ])).toThrow("restaurant-density");
  });

  it("rejects a reach predictor reused as a score bonus", () => {
    expect(() => verifyFeatureRegistry([
      { id: "poi-attraction", role: "measurement", pillar: null },
      { id: "poi-attraction", role: "score", pillar: "A" },
    ])).toThrow("poi-attraction");
  });
});
