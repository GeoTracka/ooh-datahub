export type SourcePeriodLike = {
  kind?: unknown;
  months?: unknown;
};

export function singleMonthNumber(period: SourcePeriodLike | null | undefined): number | null {
  if (!period || period.kind !== "month" || !Array.isArray(period.months) || period.months.length !== 1) {
    return null;
  }
  const month = Number(period.months[0]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

export function continuousPercentile(
  values: readonly number[],
  percentile: number,
): number | null {
  if (!(percentile >= 0 && percentile <= 1)) throw new Error("PERCENTILE_OUT_OF_RANGE");
  const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const position = percentile * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export type SourceRateSummary = {
  sourceObservationCount: number;
  rateObservationCount: number;
  missingRateCount: number;
  minimum: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  maximum: number | null;
  average: number | null;
};

export function summarizeSourceRates(values: readonly (number | null)[]): SourceRateSummary {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const total = values.length;
  return {
    sourceObservationCount: total,
    rateObservationCount: present.length,
    missingRateCount: total - present.length,
    minimum: present.length ? Math.min(...present) : null,
    p25: continuousPercentile(present, 0.25),
    median: continuousPercentile(present, 0.5),
    p75: continuousPercentile(present, 0.75),
    maximum: present.length ? Math.max(...present) : null,
    average: present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null,
  };
}
