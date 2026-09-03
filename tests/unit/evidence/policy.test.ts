import { describe, expect, it } from "vitest";

import {
  APPROVED_METRIC_FAMILIES,
  evidenceDisposition,
} from "@/evidence/rblLoma2026/policy";

describe("RBL evidence policy", () => {
  it("blocks four-week recall while workbook/report values conflict", () => {
    expect(evidenceDisposition("four_week_recall", "lagos")).toEqual({
      status: "blocked",
      reason: "workbook_report_mismatch",
    });
  });

  it.each([
    "population_extrapolation",
    "site_reach",
    "frequency",
    "price",
    "availability",
    "roi",
    "radio_listening",
    "outdoor_activation_potential",
  ])("blocks unsupported metric %s", (metricId) => {
    expect(evidenceDisposition(metricId, "lagos")).toEqual({
      status: "blocked",
      reason: "unsupported_metric",
    });
  });

  it("approves governed metric families for the 12 study cities", () => {
    expect(APPROVED_METRIC_FAMILIES).toContain("journey_attention");
    expect(evidenceDisposition("journey_attention_high", "kano")).toEqual({
      status: "approved",
    });
  });

  it("fails closed for unknown metrics and geography", () => {
    expect(evidenceDisposition("made_up_score", "lagos")).toEqual({
      status: "blocked",
      reason: "unknown_metric",
    });
    expect(evidenceDisposition("journey_attention_high", "owerri")).toEqual({
      status: "blocked",
      reason: "unsupported_geography",
    });
  });
});
