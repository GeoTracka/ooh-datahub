import type { RblLomaCityId } from "@/evidence/contracts";

const MINIMUM_SEGMENT_BASE = 30;
const PERIOD = "2026-05";
const WEIGHTING = "unweighted";

type FactIdentity = {
  metricId: string;
  city: RblLomaCityId;
};

function assertSegmentBase(base: number): void {
  if (!Number.isInteger(base) || base < MINIMUM_SEGMENT_BASE) {
    throw new Error(`INSUFFICIENT_RESPONDENT_BASE:${base}`);
  }
}

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`INVALID_${label.toUpperCase()}:${value}`);
  }
}

function round(value: number, precision = 1): number {
  const scale = 10 ** precision;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function percentageFact({
  metricId,
  city,
  yes,
  base,
}: FactIdentity & { yes: number; base: number }) {
  assertSegmentBase(base);
  assertCount(yes, "numerator");
  if (yes > base) throw new Error(`NUMERATOR_EXCEEDS_DENOMINATOR:${yes}:${base}`);

  return {
    metricId,
    city,
    value: round((yes / base) * 100),
    unit: "percent" as const,
    numerator: yes,
    denominator: base,
    respondentBase: base,
    period: PERIOD,
    weighting: WEIGHTING,
  };
}

export function meanRatingFact({
  metricId,
  city,
  ratings,
  respondentBase,
}: FactIdentity & {
  ratings: readonly unknown[];
  respondentBase: number;
}) {
  assertSegmentBase(respondentBase);
  const validRatings = ratings.filter(
    (rating): rating is number =>
      typeof rating === "number" &&
      Number.isFinite(rating) &&
      rating >= 1 &&
      rating <= 5,
  );
  if (validRatings.length === 0) throw new Error("NO_VALID_RATINGS");

  return {
    metricId,
    city,
    value: round(
      validRatings.reduce((total, rating) => total + rating, 0) /
        validRatings.length,
      2,
    ),
    unit: "mean_rating" as const,
    validBase: validRatings.length,
    respondentBase,
    scale: { min: 1, max: 5 } as const,
    period: PERIOD,
    weighting: WEIGHTING,
  };
}

export function selectionFact({
  metricId,
  city,
  selectionCount,
  validRespondentBase,
}: FactIdentity & {
  selectionCount: number;
  validRespondentBase: number;
}) {
  assertSegmentBase(validRespondentBase);
  assertCount(selectionCount, "selection_count");
  if (selectionCount > validRespondentBase) {
    throw new Error(
      `SELECTION_COUNT_EXCEEDS_BASE:${selectionCount}:${validRespondentBase}`,
    );
  }

  return {
    metricId,
    city,
    value: selectionCount,
    unit: "selections" as const,
    selectionCount,
    validBase: validRespondentBase,
    respondentBase: validRespondentBase,
    period: PERIOD,
    weighting: WEIGHTING,
  };
}

export { MINIMUM_SEGMENT_BASE };

