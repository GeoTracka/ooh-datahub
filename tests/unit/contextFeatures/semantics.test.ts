import { describe, expect, it } from "vitest";
import {
  continuousPercentile,
  singleMonthNumber,
  summarizeSourceRates,
} from "../../../src/contextFeatures/semantics";

describe("context feature semantics", () => {
  it("matches PostgreSQL percentile_cont interpolation", () => {
    const values = [100, 200, 300, 400];
    expect(continuousPercentile(values, 0.25)).toBe(175);
    expect(continuousPercentile(values, 0.5)).toBe(250);
    expect(continuousPercentile(values, 0.75)).toBe(325);
    expect(continuousPercentile([], 0.5)).toBeNull();
    expect(() => continuousPercentile(values, 1.1)).toThrow("PERCENTILE_OUT_OF_RANGE");
  });

  it("never invents a month for combined, quarter-only or malformed periods", () => {
    expect(singleMonthNumber({ kind: "month", months: [1] })).toBe(1);
    expect(singleMonthNumber({ kind: "combined", months: [8, 9] })).toBeNull();
    expect(singleMonthNumber({ kind: "quarter_only", months: [] })).toBeNull();
    expect(singleMonthNumber({ kind: "month", months: [13] })).toBeNull();
    expect(singleMonthNumber({ kind: "month", months: [1, 2] })).toBeNull();
  });

  it("reports source-rate sample coverage alongside statistics", () => {
    expect(summarizeSourceRates([100, 200, 300, 400, null])).toEqual({
      sourceObservationCount: 5,
      rateObservationCount: 4,
      missingRateCount: 1,
      minimum: 100,
      p25: 175,
      median: 250,
      p75: 325,
      maximum: 400,
      average: 250,
    });
  });
});
