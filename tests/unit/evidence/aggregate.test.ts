import { describe, expect, it } from "vitest";

import {
  meanRatingFact,
  percentageFact,
  selectionFact,
} from "@/evidence/rblLoma2026/aggregate";

describe("RBL aggregate facts", () => {
  it("retains numerator, denominator, base, period and weighting caveat", () => {
    expect(
      percentageFact({
        metricId: "journey_attention_high",
        city: "lagos",
        yes: 30,
        base: 50,
      }),
    ).toMatchObject({
      value: 60,
      numerator: 30,
      denominator: 50,
      respondentBase: 50,
      period: "2026-05",
      weighting: "unweighted",
    });
  });

  it("does not publish segments below the minimum valid base", () => {
    expect(() =>
      percentageFact({
        metricId: "journey_attention_high",
        city: "lagos",
        yes: 12,
        base: 29,
      }),
    ).toThrow("INSUFFICIENT_RESPONDENT_BASE");
  });

  it("publishes rating means with a valid base and scale", () => {
    expect(
      meanRatingFact({
        metricId: "format_attention_rating_billboard",
        city: "lagos",
        ratings: [5, 4, 3, null, "bad", 4],
        respondentBase: 31,
      }),
    ).toMatchObject({
      value: 4,
      validBase: 4,
      respondentBase: 31,
      scale: { min: 1, max: 5 },
      weighting: "unweighted",
    });
  });

  it("keeps multi-select counts separate from the valid respondent base", () => {
    expect(
      selectionFact({
        metricId: "top_format_seen_billboard",
        city: "abuja",
        selectionCount: 22,
        validRespondentBase: 40,
      }),
    ).toMatchObject({
      value: 22,
      selectionCount: 22,
      validBase: 40,
      unit: "selections",
    });
  });
});

