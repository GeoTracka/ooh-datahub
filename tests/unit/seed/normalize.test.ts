import { describe, expect, it } from "vitest";
import { parseLooseNumber, parseSourcePeriod, totalMismatch } from "@/seed/normalize";

describe("seed normalization", () => {
  it("parses loose FAAN number literals without converting missing dashes to zero", () => {
    expect(parseLooseNumber("487, 048")).toBe(487_048);
    expect(parseLooseNumber(" 1,234.5 ")).toBe(1234.5);
    expect(parseLooseNumber("-")).toBeNull();
    expect(parseLooseNumber("—")).toBeNull();
  });

  it("preserves combined source periods instead of fabricating a month", () => {
    expect(parseSourcePeriod("August/September")).toEqual({
      rawMonth: "August/September",
      month: null,
      monthSpan: [8, 9],
      kind: "combined_months",
    });
    expect(parseSourcePeriod(null)).toEqual({
      rawMonth: null,
      month: null,
      monthSpan: [],
      kind: "quarter_only",
    });
  });

  it("detects reported totals that disagree with directional values", () => {
    expect(totalMismatch(100, 50, 150)).toBe(false);
    expect(totalMismatch(100, 50, 999)).toBe(true);
    expect(totalMismatch(100, null, 100)).toBe(false);
  });
});
