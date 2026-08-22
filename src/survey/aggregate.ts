import {
  SURVEY_CLAIM_BOUNDARY,
  SURVEY_CONTEXT_SCHEMA_VERSION,
  SURVEY_DECISION_USE,
  SURVEY_FORMAT_ATTRIBUTES,
  SURVEY_FORMATS,
  type CanonicalSurveyResponse,
  type SurveyAggregateFacet,
  type SurveyAggregateMetric,
  type SurveyAggregateSnapshotContent,
  type SurveyFacetDimension,
  type SurveyFacetScope,
  type SurveyFormat,
  type SurveySourceSpec,
} from "@/survey/contracts";

export const DEFAULT_SURVEY_FACET_GROUPINGS: SurveyFacetDimension[][] = [
  [],
  ["city"],
  ["ageBand"],
  ["gender"],
  ["transportMode"],
  ["city", "ageBand"],
  ["city", "transportMode"],
];

const formatLabels: Record<SurveyFormat, string> = {
  large_billboard: "Large billboard",
  digital_led: "Digital LED screen",
  transit_vehicle: "Transit or vehicle advertising",
  airport: "Airport advertising",
  street_furniture: "Street furniture or bus shelter",
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function slug(value: string): string {
  return normalize(value)
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function publicCounts(
  numerator: number,
  denominator: number,
  minimumSampleSize: number,
): Pick<SurveyAggregateMetric, "value" | "numerator" | "denominator" | "suppressed"> {
  if (denominator < minimumSampleSize) {
    return { value: null, numerator: null, denominator: null, suppressed: true };
  }
  return {
    value: round(numerator / denominator),
    numerator,
    denominator,
    suppressed: false,
  };
}

function shareMetric(input: {
  id: string;
  label: string;
  questionId: string;
  rows: readonly CanonicalSurveyResponse[];
  minimumSampleSize: number;
  applicable: (row: CanonicalSurveyResponse) => boolean;
  selected: (row: CanonicalSurveyResponse) => boolean;
}): SurveyAggregateMetric {
  const applicableRows = input.rows.filter(input.applicable);
  const numerator = applicableRows.filter(input.selected).length;
  return {
    id: input.id,
    label: input.label,
    kind: "share",
    ...publicCounts(numerator, applicableRows.length, input.minimumSampleSize),
    unit: "proportion",
    questionId: input.questionId,
    decisionUse: SURVEY_DECISION_USE,
    claimBoundary: SURVEY_CLAIM_BOUNDARY,
  };
}

function meanMetric(input: {
  id: string;
  label: string;
  questionId: string;
  values: readonly number[];
  minimumSampleSize: number;
}): SurveyAggregateMetric {
  if (input.values.length < input.minimumSampleSize) {
    return {
      id: input.id,
      label: input.label,
      kind: "mean",
      value: null,
      numerator: null,
      denominator: null,
      unit: "rating_1_to_5",
      suppressed: true,
      questionId: input.questionId,
      decisionUse: SURVEY_DECISION_USE,
      claimBoundary: SURVEY_CLAIM_BOUNDARY,
    };
  }
  return {
    id: input.id,
    label: input.label,
    kind: "mean",
    value: round(input.values.reduce((sum, value) => sum + value, 0) / input.values.length),
    numerator: null,
    denominator: input.values.length,
    unit: "rating_1_to_5",
    suppressed: false,
    questionId: input.questionId,
    decisionUse: SURVEY_DECISION_USE,
    claimBoundary: SURVEY_CLAIM_BOUNDARY,
  };
}

function hasDiagnostic(row: CanonicalSurveyResponse, code: string): boolean {
  return row.diagnostics.some((diagnostic) => diagnostic.code === code);
}

function distributionMetrics(input: {
  prefix: string;
  questionId: string;
  rows: readonly CanonicalSurveyResponse[];
  minimumSampleSize: number;
  value: (row: CanonicalSurveyResponse) => string | null;
}): SurveyAggregateMetric[] {
  const applicableRows = input.rows.flatMap((row) => {
    const value = input.value(row);
    return value ? [{ row, value: normalize(value) }] : [];
  });
  const categories = [...new Set(applicableRows.map(({ value }) => value))].sort((left, right) =>
    left.localeCompare(right),
  );
  return categories.map((category) => shareMetric({
    id: `${input.prefix}.${slug(category)}`,
    label: category,
    questionId: input.questionId,
    rows: applicableRows.map(({ row }) => row),
    minimumSampleSize: input.minimumSampleSize,
    applicable: (row) => input.value(row) !== null,
    selected: (row) => normalize(input.value(row) ?? "") === category,
  }));
}

function multiSelectMetrics(input: {
  prefix: string;
  questionId: string;
  rows: readonly CanonicalSurveyResponse[];
  minimumSampleSize: number;
  values: (row: CanonicalSurveyResponse) => readonly string[];
  excludeDiagnostic?: string;
}): SurveyAggregateMetric[] {
  const eligibleRows = input.excludeDiagnostic
    ? input.rows.filter((row) => !hasDiagnostic(row, input.excludeDiagnostic!))
    : [...input.rows];
  const categories = [...new Set(eligibleRows.flatMap((row) => input.values(row).map(normalize)))]
    .sort((left, right) => left.localeCompare(right));
  return categories.map((category) => shareMetric({
    id: `${input.prefix}.${slug(category)}`,
    label: category,
    questionId: input.questionId,
    rows: eligibleRows,
    minimumSampleSize: input.minimumSampleSize,
    applicable: () => true,
    selected: (row) => input.values(row).map(normalize).includes(category),
  }));
}

function formatMetrics(
  rows: readonly CanonicalSurveyResponse[],
  minimumSampleSize: number,
): SurveyAggregateMetric[] {
  const eligibleRows = rows.filter((row) =>
    !hasDiagnostic(row, "FORMAT_MATRIX_INCOMPLETE") &&
    !hasDiagnostic(row, "FORMAT_MATRIX_STRAIGHTLINE"),
  );
  const metrics: SurveyAggregateMetric[] = [];
  for (const format of SURVEY_FORMATS) {
    for (const attribute of SURVEY_FORMAT_ATTRIBUTES) {
      const values = eligibleRows.flatMap((row) => {
        const value = row.formatRatings[format]?.[attribute];
        return value === undefined ? [] : [value];
      });
      metrics.push(meanMetric({
        id: `format.${format}.${attribute}`,
        label: `${formatLabels[format]} — ${attribute.replace("_", " ")}`,
        questionId: "Q_FORMAT_MATRIX",
        values,
        minimumSampleSize,
      }));
    }
    const respondentMeans = eligibleRows.flatMap((row) => {
      const values = SURVEY_FORMAT_ATTRIBUTES.flatMap((attribute) => {
        const value = row.formatRatings[format]?.[attribute];
        return value === undefined ? [] : [value];
      });
      return values.length === SURVEY_FORMAT_ATTRIBUTES.length
        ? [values.reduce((sum, value) => sum + value, 0) / values.length]
        : [];
    });
    metrics.push(meanMetric({
      id: `format.overall.${format}`,
      label: `${formatLabels[format]} overall affinity`,
      questionId: "Q_FORMAT_MATRIX",
      values: respondentMeans,
      minimumSampleSize,
    }));
  }
  return metrics;
}

function metricsForFacet(
  rows: readonly CanonicalSurveyResponse[],
  minimumSampleSize: number,
): SurveyAggregateMetric[] {
  const metrics: SurveyAggregateMetric[] = [
    shareMetric({
      id: "attention.high_or_very_high",
      label: "High or very high OOH attention",
      questionId: "Q10",
      rows,
      minimumSampleSize,
      applicable: (row) => row.oohAttention !== null,
      selected: (row) => ["High", "Very high"].includes(row.oohAttention ?? ""),
    }),
    shareMetric({
      id: "attention.moderate",
      label: "Moderate OOH attention",
      questionId: "Q10",
      rows,
      minimumSampleSize,
      applicable: (row) => row.oohAttention !== null,
      selected: (row) => row.oohAttention === "Moderate",
    }),
    shareMetric({
      id: "exposure.noticed_four_plus_last_week",
      label: "Noticed OOH four or more times in the previous week",
      questionId: "Q16",
      rows,
      minimumSampleSize,
      applicable: (row) => row.weeklyNoticeFrequency !== null,
      selected: (row) => ["4-7", "8-14", "15+"].includes(row.weeklyNoticeFrequency ?? ""),
    }),
    shareMetric({
      id: "recall.four_week",
      label: "Recalled an OOH advertisement in the previous four weeks",
      questionId: "Q20",
      rows,
      minimumSampleSize,
      applicable: (row) => row.recalledOohLastFourWeeks !== null,
      selected: (row) => row.recalledOohLastFourWeeks === true,
    }),
    shareMetric({
      id: "traffic_attention.high",
      label: "High attention to advertising while in traffic",
      questionId: "Q27",
      rows,
      minimumSampleSize,
      applicable: (row) => row.trafficAttention !== null,
      selected: (row) => /^(4|5)(\b|\s)/.test(row.trafficAttention ?? ""),
    }),
    ...distributionMetrics({
      prefix: "environment",
      questionId: "Q18",
      rows,
      minimumSampleSize,
      value: (row) => row.primaryOohEnvironment,
    }),
    ...distributionMetrics({
      prefix: "hardest_format",
      questionId: "Q23",
      rows,
      minimumSampleSize,
      value: (row) => row.hardestToIgnoreFormat,
    }),
    ...distributionMetrics({
      prefix: "memorability",
      questionId: "Q24",
      rows,
      minimumSampleSize,
      value: (row) => row.memorabilityDriver,
    }),
    ...multiSelectMetrics({
      prefix: "top_format",
      questionId: "Q17",
      rows,
      minimumSampleSize,
      values: (row) => row.topFormats,
      excludeDiagnostic: "TOP3_FORMAT_COUNT_DIAGNOSTIC",
    }),
    ...multiSelectMetrics({
      prefix: "attention_driver",
      questionId: "Q29",
      rows,
      minimumSampleSize,
      values: (row) => row.attentionDrivers,
      excludeDiagnostic: "TOP2_DRIVER_COUNT_DIAGNOSTIC",
    }),
    ...multiSelectMetrics({
      prefix: "action",
      questionId: "Q30",
      rows,
      minimumSampleSize,
      values: (row) => row.actions,
    }),
    ...multiSelectMetrics({
      prefix: "response_category",
      questionId: "Q31",
      rows,
      minimumSampleSize,
      values: (row) => row.responsiveCategories,
    }),
    ...formatMetrics(rows, minimumSampleSize),
  ];
  return metrics.sort((left, right) => left.id.localeCompare(right.id));
}

function facetScope(
  row: CanonicalSurveyResponse,
  dimensions: readonly SurveyFacetDimension[],
): SurveyFacetScope | null {
  const scope: SurveyFacetScope = {};
  for (const dimension of dimensions) {
    const value = row[dimension];
    if (typeof value !== "string" || value.length === 0) return null;
    scope[dimension] = value;
  }
  return scope;
}

export function surveyScopeKey(scope: SurveyFacetScope): string {
  const entries = Object.entries(scope) as Array<[SurveyFacetDimension, string]>;
  if (entries.length === 0) return "overall";
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dimension, value]) => `${dimension}=${value}`)
    .join("|");
}

function uniqueGroupings(
  groupings: readonly (readonly SurveyFacetDimension[])[],
): SurveyFacetDimension[][] {
  const normalized = groupings.map((grouping) => [...new Set(grouping)].sort());
  const seen = new Set<string>();
  return normalized.filter((grouping) => {
    const key = grouping.join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.join("|").localeCompare(right.join("|")));
}

export function buildSurveyAggregateSnapshotContent(input: {
  source: SurveySourceSpec;
  responses: readonly CanonicalSurveyResponse[];
  minimumSampleSize?: number;
  facetGroupings?: readonly (readonly SurveyFacetDimension[])[];
}): SurveyAggregateSnapshotContent {
  const minimumSampleSize = input.minimumSampleSize ?? 30;
  if (!Number.isInteger(minimumSampleSize) || minimumSampleSize < 1) {
    throw new Error("SURVEY_MINIMUM_SAMPLE_SIZE_INVALID");
  }
  const included = input.responses.filter((response) => response.contextEligible);
  const facetGroupings = uniqueGroupings(input.facetGroupings ?? DEFAULT_SURVEY_FACET_GROUPINGS);
  const groups = new Map<string, { scope: SurveyFacetScope; rows: CanonicalSurveyResponse[] }>();

  for (const response of included) {
    for (const dimensions of facetGroupings) {
      const scope = facetScope(response, dimensions);
      if (scope === null) continue;
      const key = surveyScopeKey(scope);
      const group = groups.get(key) ?? { scope, rows: [] };
      group.rows.push(response);
      groups.set(key, group);
    }
  }

  const facets: SurveyAggregateFacet[] = [...groups.entries()]
    .filter(([, group]) => group.rows.length >= minimumSampleSize)
    .map(([scopeKey, group]) => ({
      scopeKey,
      scope: group.scope,
      sampleSize: group.rows.length,
      metrics: metricsForFacet(group.rows, minimumSampleSize),
    }))
    .sort((left, right) => left.scopeKey.localeCompare(right.scopeKey));

  return {
    schemaVersion: SURVEY_CONTEXT_SCHEMA_VERSION,
    source: input.source,
    decisionUse: SURVEY_DECISION_USE,
    claimBoundary: SURVEY_CLAIM_BOUNDARY,
    minimumSampleSize,
    responseCount: input.responses.length,
    includedResponseCount: included.length,
    excludedResponseCount: input.responses.length - included.length,
    facetGroupings,
    facets,
  };
}
