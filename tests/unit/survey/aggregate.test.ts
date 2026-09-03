import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/shared/canonicalJson";
import { buildSurveyAggregateSnapshotContent } from "@/survey/aggregate";
import {
  selectSurveyContextSignals,
  selectSurveyFacet,
} from "@/survey/contextSignals";
import type {
  CanonicalSurveyResponse,
  SurveyAggregateSnapshot,
  SurveyFormatRatings,
} from "@/survey/contracts";
import { RBL_LOMA_2026_SOURCE } from "@/server/survey/rblLoma2026";

function ratings(base: number): SurveyFormatRatings {
  return {
    large_billboard: {
      attention: base,
      recall: base,
      trust: base,
      effect: base,
      quality_feel: base,
    },
    digital_led: {
      attention: base - 1,
      recall: base - 1,
      trust: base - 1,
      effect: base - 1,
      quality_feel: base - 1,
    },
    transit_vehicle: {
      attention: 3,
      recall: 3,
      trust: 3,
      effect: 3,
      quality_feel: 3,
    },
    airport: {
      attention: 2,
      recall: 2,
      trust: 2,
      effect: 2,
      quality_feel: 2,
    },
    street_furniture: {
      attention: 3,
      recall: 3,
      trust: 3,
      effect: 3,
      quality_feel: 3,
    },
  };
}

function response(
  sourceRowNumber: number,
  overrides: Partial<CanonicalSurveyResponse> = {},
): CanonicalSurveyResponse {
  return {
    sourceRowNumber,
    contextEligible: true,
    collectionStart: "2026-05-20T09:00:00.000Z",
    collectionEnd: "2026-05-20T09:15:00.000Z",
    formVersion: "v3",
    city: "Lagos",
    ageBand: "26-35",
    gender: "Female",
    occupation: "Professional",
    incomeBand: "N500,000+",
    transportMode: "Private car",
    commutePattern: "Daily commuter",
    weekdayDayparts: ["Morning", "Evening"],
    weekendDayparts: ["Afternoon"],
    oohAttention: "High",
    weeklyNoticeFrequency: "8-14",
    recalledOohLastFourWeeks: true,
    recallDetailComplete: true,
    primaryOohEnvironment: "Major roads or highways",
    hardestToIgnoreFormat: "Large static billboard",
    memorabilityDriver: "Size/visibility",
    commuteMood: "Calm",
    trafficAttention: "5 Very attentive",
    bestRoad: "Ikorodu Road",
    bestArea: "Ikeja",
    topFormats: [
      "Large billboard",
      "Digital screen or LED",
      "Bus or vehicle wrap",
    ],
    commuteAttentionTargets: ["Billboards or signs", "Traffic or road"],
    attentionDrivers: [
      "Bigger or brighter display",
      "Relevant to my life",
    ],
    actions: [
      "Searched online",
      "Visited store or location",
      "Purchased product or service",
    ],
    responsiveCategories: ["FMCG"],
    formatRatings: ratings(5),
    diagnostics: [],
    ...overrides,
  };
}

function snapshotFor(
  responses: CanonicalSurveyResponse[],
): SurveyAggregateSnapshot {
  const content = buildSurveyAggregateSnapshotContent({
    source: RBL_LOMA_2026_SOURCE,
    responses,
    minimumSampleSize: 10,
    facetGroupings: [[], ["city"], ["city", "ageBand"]],
  });
  return { ...content, snapshotDigest: "a".repeat(64) };
}

describe("consumer survey aggregates", () => {
  it("derives deterministic, context-only aggregate facets", () => {
    const responses = Array.from({ length: 40 }, (_, index) =>
      response(index + 2, {
        oohAttention: index < 20 ? "High" : "Moderate",
        recalledOohLastFourWeeks: index < 30,
        primaryOohEnvironment:
          index < 28 ? "Major roads or highways" : "Market area",
        memorabilityDriver:
          index < 24 ? "Size/visibility" : "Creative design",
      }),
    );
    const content = buildSurveyAggregateSnapshotContent({
      source: RBL_LOMA_2026_SOURCE,
      responses,
      minimumSampleSize: 10,
      facetGroupings: [[], ["city"]],
    });
    expect(content).toMatchObject({
      decisionUse: "context_only",
      claimBoundary: "self_reported_consumer_context_not_observed_delivery",
      responseCount: 40,
      includedResponseCount: 40,
      excludedResponseCount: 0,
    });
    expect(content.facets.map(({ scopeKey }) => scopeKey)).toEqual([
      "city=Lagos",
      "overall",
    ]);
    const overall = content.facets.find(
      ({ scopeKey }) => scopeKey === "overall",
    )!;
    expect(
      overall.metrics.find(({ id }) => id === "attention.high_or_very_high")
        ?.value,
    ).toBe(0.5);
    expect(
      overall.metrics.find(({ id }) => id === "recall.four_week")?.value,
    ).toBe(0.75);
    expect(
      overall.metrics.find(
        ({ id }) => id === "format.overall.large_billboard",
      )?.value,
    ).toBe(5);
    expect(canonicalJson(content)).toBe(
      canonicalJson(
        buildSurveyAggregateSnapshotContent({
          source: RBL_LOMA_2026_SOURCE,
          responses: [...responses].reverse(),
          minimumSampleSize: 10,
          facetGroupings: [["city"], []],
        }),
      ),
    );
  });

  it("omits small facets and suppresses question denominators below the threshold", () => {
    const responses = [
      ...Array.from({ length: 12 }, (_, index) => response(index + 2)),
      ...Array.from({ length: 4 }, (_, index) =>
        response(index + 100, { city: "Abuja" }),
      ),
    ];
    responses.slice(0, 7).forEach((item) => {
      item.oohAttention = null;
    });
    const content = buildSurveyAggregateSnapshotContent({
      source: RBL_LOMA_2026_SOURCE,
      responses,
      minimumSampleSize: 10,
      facetGroupings: [[], ["city"]],
    });
    expect(
      content.facets.some(({ scopeKey }) => scopeKey === "city=Abuja"),
    ).toBe(false);
    const lagos = content.facets.find(
      ({ scopeKey }) => scopeKey === "city=Lagos",
    )!;
    expect(
      lagos.metrics.find(
        ({ id }) => id === "attention.high_or_very_high",
      ),
    ).toMatchObject({
      value: null,
      numerator: null,
      denominator: null,
      suppressed: true,
    });
  });

  it("selects the most specific available facet and caps broad-reach context", () => {
    const snapshot = snapshotFor(
      Array.from({ length: 35 }, (_, index) => response(index + 2)),
    );
    expect(
      selectSurveyFacet(snapshot, {
        city: "Lagos",
        ageBand: "26-35",
      })?.scopeKey,
    ).toBe("ageBand=26-35|city=Lagos");
    const signals = selectSurveyContextSignals({
      snapshot,
      query: { city: "Lagos", ageBand: "26-35" },
      objective: "broad_reach",
      maximumSignals: 10,
    });
    expect(signals).toHaveLength(3);
    expect(signals.map(({ label }) => label)).toEqual([
      "Format affinity",
      "Environment pattern",
      "Creative cue",
    ]);
    expect(
      signals.every(({ decisionUse }) => decisionUse === "context_only"),
    ).toBe(true);
    expect(
      signals.every(
        ({ claimBoundary }) =>
          claimBoundary ===
          "self_reported_consumer_context_not_observed_delivery",
      ),
    ).toBe(true);
    expect(
      signals.every(({ evidenceSentence }) =>
        evidenceSentence.includes("35 applicable responses"),
      ),
    ).toBe(true);
  });

  it("selects distinct signal families for each campaign objective", () => {
    const snapshot = snapshotFor(
      Array.from({ length: 35 }, (_, index) =>
        response(index + 2, {
          memorabilityDriver:
            index < 20 ? "Creative design" : "Size/visibility",
        }),
      ),
    );
    const query = { city: "Lagos", ageBand: "26-35" } as const;

    expect(
      selectSurveyContextSignals({
        snapshot,
        query,
        objective: "influential_core",
      }).map(({ label }) => label),
    ).toEqual(["Trust affinity", "Recall context", "Creative cue"]);

    expect(
      selectSurveyContextSignals({
        snapshot,
        query,
        objective: "near_conversion",
      }).map(({ label }) => label),
    ).toEqual(["Search response", "Visit response", "Purchase response"]);
  });
});
