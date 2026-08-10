import { describe, expect, it } from "vitest";
import {
  VECTOR_CONTEXT_DEFAULT_RADII_M,
  isMajorRoadClass,
  normalizeVectorContextRadii,
  shannonEntropy,
} from "../../../src/enrichment/vectorContext";

describe("vector context semantics", () => {
  it("normalizes radius inputs deterministically and rejects unbounded queries", () => {
    expect(normalizeVectorContextRadii([1000, 250, 500, 250])).toEqual([250, 500, 1000]);
    expect([...VECTOR_CONTEXT_DEFAULT_RADII_M]).toEqual([250, 500, 1000]);
    expect(() => normalizeVectorContextRadii([0])).toThrow("VECTOR_CONTEXT_RADIUS_INVALID:0");
    expect(() => normalizeVectorContextRadii([6000])).toThrow("VECTOR_CONTEXT_RADIUS_INVALID:6000");
  });

  it("keeps the major-road definition explicit", () => {
    expect(["motorway", "trunk", "primary", "secondary"].every(isMajorRoadClass)).toBe(true);
    expect(isMajorRoadClass("tertiary")).toBe(false);
    expect(isMajorRoadClass("residential")).toBe(false);
  });

  it("computes category diversity without pretending it is visitation", () => {
    expect(shannonEntropy([])).toBeNull();
    expect(shannonEntropy([10])).toBeCloseTo(0, 12);
    expect(shannonEntropy([10, 10])).toBeCloseTo(Math.log(2), 12);
    expect(shannonEntropy([8, 2])).toBeLessThan(Math.log(2));
  });
});
