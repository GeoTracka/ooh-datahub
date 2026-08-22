import type {
  SurveyAggregateFacet,
  SurveyAggregateMetric,
  SurveyAggregateSnapshot,
  SurveyContextQuery,
  SurveyContextSignal,
  SurveyFacetDimension,
} from "@/survey/contracts";

export const SURVEY_PLANNING_OBJECTIVES = [
  "broad_reach",
  "influential_core",
  "near_conversion",
] as const;

export type SurveyPlanningObjective =
  (typeof SURVEY_PLANNING_OBJECTIVES)[number];

export function isSurveyPlanningObjective(
  value: string,
): value is SurveyPlanningObjective {
  return (SURVEY_PLANNING_OBJECTIVES as readonly string[]).includes(value);
}

function available(
  metric: SurveyAggregateMetric | undefined,
): metric is SurveyAggregateMetric {
  return Boolean(
    metric &&
      !metric.suppressed &&
      metric.value !== null &&
      metric.denominator !== null,
  );
}

function metricWithPrefix(
  facet: SurveyAggregateFacet,
  prefix: string,
): SurveyAggregateMetric | undefined {
  return topMetricMatching(facet, (metric) => metric.id.startsWith(prefix));
}

function topMetricMatching(
  facet: SurveyAggregateFacet,
  predicate: (metric: SurveyAggregateMetric) => boolean,
): SurveyAggregateMetric | undefined {
  return facet.metrics
    .filter((metric) => predicate(metric) && available(metric))
    .sort(
      (left, right) =>
        (right.value ?? Number.NEGATIVE_INFINITY) -
          (left.value ?? Number.NEGATIVE_INFINITY) ||
        left.id.localeCompare(right.id),
    )[0];
}

function exactMetric(
  facet: SurveyAggregateFacet,
  id: string,
): SurveyAggregateMetric | undefined {
  const metric = facet.metrics.find((candidate) => candidate.id === id);
  return available(metric) ? metric : undefined;
}

function scopeMatchesQuery(
  facet: SurveyAggregateFacet,
  query: SurveyContextQuery,
): boolean {
  return (
    Object.entries(facet.scope) as Array<[SurveyFacetDimension, string]>
  ).every(([dimension, value]) => query[dimension] === value);
}

export function selectSurveyFacet(
  snapshot: SurveyAggregateSnapshot,
  query: SurveyContextQuery,
): SurveyAggregateFacet | null {
  return (
    snapshot.facets
      .filter((facet) => scopeMatchesQuery(facet, query))
      .sort(
        (left, right) =>
          Object.keys(right.scope).length - Object.keys(left.scope).length ||
          right.sampleSize - left.sampleSize ||
          left.scopeKey.localeCompare(right.scopeKey),
      )[0] ?? null
  );
}

function scopeLabel(facet: SurveyAggregateFacet): string {
  const values = Object.values(facet.scope);
  return values.length ? values.join(" · ") : "the approved survey sample";
}

function signalForMetric(input: {
  snapshot: SurveyAggregateSnapshot;
  facet: SurveyAggregateFacet;
  metric: SurveyAggregateMetric;
  id: string;
  label: string;
}): SurveyContextSignal {
  const { snapshot, facet, metric } = input;
  const denominator = metric.denominator!;
  const value = metric.value!;
  const valueText =
    metric.kind === "mean"
      ? `${value.toFixed(2)} / 5`
      : `${Math.round(value * 100)}%`;
  const evidenceSentence =
    metric.kind === "mean"
      ? `${metric.label} scored ${value.toFixed(2)} out of 5 across ${denominator.toLocaleString("en-NG")} applicable responses in ${scopeLabel(facet)}.`
      : `${metric.label} was reported by ${Math.round(value * 100)}% of ${denominator.toLocaleString("en-NG")} applicable responses in ${scopeLabel(facet)}.`;
  return {
    id: input.id,
    label: input.label,
    metricLabel: metric.label,
    valueText,
    evidenceSentence,
    sampleSize: facet.sampleSize,
    scope: facet.scope,
    sourceId: snapshot.source.id,
    sourcePeriod: snapshot.source.collectionPeriod,
    evidenceState: "authoritative_owner_supplied_survey",
    decisionUse: "context_only",
    claimBoundary: "self_reported_consumer_context_not_observed_delivery",
  };
}

function signalCandidate(input: {
  snapshot: SurveyAggregateSnapshot;
  facet: SurveyAggregateFacet;
  metric: SurveyAggregateMetric | undefined;
  id: string;
  label: string;
}): SurveyContextSignal | null {
  return input.metric
    ? signalForMetric({
        snapshot: input.snapshot,
        facet: input.facet,
        metric: input.metric,
        id: input.id,
        label: input.label,
      })
    : null;
}

function broadReachSignals(
  snapshot: SurveyAggregateSnapshot,
  facet: SurveyAggregateFacet,
): Array<SurveyContextSignal | null> {
  const topFormat = metricWithPrefix(facet, "format.overall.");
  const environment = metricWithPrefix(facet, "environment.");
  const memorability = metricWithPrefix(facet, "memorability.");
  return [
    signalCandidate({
      snapshot,
      facet,
      metric: topFormat,
      id: topFormat ? `survey-format:${topFormat.id}` : "survey-format",
      label: "Format affinity",
    }),
    signalCandidate({
      snapshot,
      facet,
      metric: environment,
      id: environment
        ? `survey-environment:${environment.id}`
        : "survey-environment",
      label: "Environment pattern",
    }),
    signalCandidate({
      snapshot,
      facet,
      metric: memorability,
      id: memorability
        ? `survey-creative:${memorability.id}`
        : "survey-creative",
      label: "Creative cue",
    }),
  ];
}

function influentialCoreSignals(
  snapshot: SurveyAggregateSnapshot,
  facet: SurveyAggregateFacet,
): Array<SurveyContextSignal | null> {
  const trust = topMetricMatching(
    facet,
    (metric) => /^format\.[^.]+\.trust$/.test(metric.id),
  );
  const recall = exactMetric(facet, "recall.four_week");
  const memorability = metricWithPrefix(facet, "memorability.");
  return [
    signalCandidate({
      snapshot,
      facet,
      metric: trust,
      id: trust ? `survey-trust:${trust.id}` : "survey-trust",
      label: "Trust affinity",
    }),
    signalCandidate({
      snapshot,
      facet,
      metric: recall,
      id: "survey-recall",
      label: "Recall context",
    }),
    signalCandidate({
      snapshot,
      facet,
      metric: memorability,
      id: memorability
        ? `survey-creative:${memorability.id}`
        : "survey-creative",
      label: "Creative cue",
    }),
  ];
}

function nearConversionSignals(
  snapshot: SurveyAggregateSnapshot,
  facet: SurveyAggregateFacet,
): Array<SurveyContextSignal | null> {
  const definitions = [
    {
      metricId: "action.searched_online",
      signalId: "survey-action:action.searched_online",
      label: "Search response",
    },
    {
      metricId: "action.visited_store_or_location",
      signalId: "survey-action:action.visited_store_or_location",
      label: "Visit response",
    },
    {
      metricId: "action.purchased_product_or_service",
      signalId: "survey-action:action.purchased_product_or_service",
      label: "Purchase response",
    },
  ] as const;
  return definitions.map(({ metricId, signalId, label }) =>
    signalCandidate({
      snapshot,
      facet,
      metric: exactMetric(facet, metricId),
      id: signalId,
      label,
    }),
  );
}

export function selectSurveyContextSignals(input: {
  snapshot: SurveyAggregateSnapshot;
  query?: SurveyContextQuery;
  objective?: SurveyPlanningObjective;
  maximumSignals?: number;
}): SurveyContextSignal[] {
  const maximumSignals = Math.max(0, Math.min(3, input.maximumSignals ?? 3));
  if (maximumSignals === 0) return [];
  const facet = selectSurveyFacet(input.snapshot, input.query ?? {});
  if (!facet) return [];

  const objective = input.objective ?? "broad_reach";
  const candidates =
    objective === "influential_core"
      ? influentialCoreSignals(input.snapshot, facet)
      : objective === "near_conversion"
        ? nearConversionSignals(input.snapshot, facet)
        : broadReachSignals(input.snapshot, facet);

  return candidates
    .filter((candidate): candidate is SurveyContextSignal => candidate !== null)
    .slice(0, maximumSignals);
}
