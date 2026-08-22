import type {
  SurveyAggregateFacet,
  SurveyAggregateMetric,
  SurveyAggregateSnapshot,
  SurveyContextQuery,
  SurveyContextSignal,
  SurveyFacetDimension,
  SurveyPlanningObjective,
} from "@/survey/contracts";

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

function rankedMetric(
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

function metricWithPrefix(
  facet: SurveyAggregateFacet,
  prefix: string,
): SurveyAggregateMetric | undefined {
  return rankedMetric(facet, (metric) => metric.id.startsWith(prefix));
}

function formatAttributeMetric(
  facet: SurveyAggregateFacet,
  attribute: "trust" | "effect",
): SurveyAggregateMetric | undefined {
  const matcher = new RegExp(`^format\\.[^.]+\\.${attribute}$`);
  return rankedMetric(facet, (metric) => matcher.test(metric.id));
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

export function selectSurveyContextSignals(input: {
  snapshot: SurveyAggregateSnapshot;
  query?: SurveyContextQuery;
  maximumSignals?: number;
}): SurveyContextSignal[] {
  const maximumSignals = Math.max(0, Math.min(3, input.maximumSignals ?? 3));
  if (maximumSignals === 0) return [];
  const facet = selectSurveyFacet(input.snapshot, input.query ?? {});
  if (!facet) return [];

  const candidates: Array<SurveyContextSignal | null> = [];
  const topFormat = metricWithPrefix(facet, "format.overall.");
  candidates.push(
    topFormat
      ? signalForMetric({
          snapshot: input.snapshot,
          facet,
          metric: topFormat,
          id: `survey-format:${topFormat.id}`,
          label: "Format affinity",
        })
      : null,
  );

  const environment = metricWithPrefix(facet, "environment.");
  candidates.push(
    environment
      ? signalForMetric({
          snapshot: input.snapshot,
          facet,
          metric: environment,
          id: `survey-environment:${environment.id}`,
          label: "Environment pattern",
        })
      : null,
  );

  const memorability = metricWithPrefix(facet, "memorability.");
  candidates.push(
    memorability
      ? signalForMetric({
          snapshot: input.snapshot,
          facet,
          metric: memorability,
          id: `survey-creative:${memorability.id}`,
          label: "Creative cue",
        })
      : null,
  );

  const attention = exactMetric(facet, "attention.high_or_very_high");
  candidates.push(
    attention
      ? signalForMetric({
          snapshot: input.snapshot,
          facet,
          metric: attention,
          id: "survey-attention",
          label: "Audience attention",
        })
      : null,
  );

  const recall = exactMetric(facet, "recall.four_week");
  candidates.push(
    recall
      ? signalForMetric({
          snapshot: input.snapshot,
          facet,
          metric: recall,
          id: "survey-recall",
          label: "Recall context",
        })
      : null,
  );

  return candidates
    .filter((candidate): candidate is SurveyContextSignal => candidate !== null)
    .slice(0, maximumSignals);
}

type ObjectiveSignalCandidate = {
  idPrefix: string;
  label: string;
  select(facet: SurveyAggregateFacet): SurveyAggregateMetric | undefined;
};

type ObjectiveContextDefinition = {
  label: string;
  selectionRationale: string;
  candidates: ObjectiveSignalCandidate[];
};

export type SelectedSurveyObjectiveContextProfile = {
  objective: SurveyPlanningObjective;
  label: string;
  selectionRationale: string;
  signals: SurveyContextSignal[];
};

const OBJECTIVE_CONTEXT_DEFINITIONS: Record<
  SurveyPlanningObjective,
  ObjectiveContextDefinition
> = {
  broad_reach: {
    label: "Broad reach",
    selectionRationale:
      "Prioritizes recent recall, the most common visibility environment, and the format respondents found hardest to ignore.",
    candidates: [
      {
        idPrefix: "survey-recall",
        label: "Recent recall",
        select: (facet) => exactMetric(facet, "recall.four_week"),
      },
      {
        idPrefix: "survey-environment",
        label: "Visibility environment",
        select: (facet) => metricWithPrefix(facet, "environment."),
      },
      {
        idPrefix: "survey-hardest-format",
        label: "Hardest-to-ignore format",
        select: (facet) => metricWithPrefix(facet, "hardest_format."),
      },
      {
        idPrefix: "survey-format",
        label: "Format affinity",
        select: (facet) => metricWithPrefix(facet, "format.overall."),
      },
    ],
  },
  influential_core: {
    label: "Priority audience",
    selectionRationale:
      "Prioritizes perceived trust, personal relevance, and the strongest reported creative memorability cue.",
    candidates: [
      {
        idPrefix: "survey-trust",
        label: "Perceived trust",
        select: (facet) => formatAttributeMetric(facet, "trust"),
      },
      {
        idPrefix: "survey-relevance",
        label: "Personal relevance",
        select: (facet) =>
          exactMetric(facet, "attention_driver.relevant_to_my_life"),
      },
      {
        idPrefix: "survey-creative",
        label: "Creative cue",
        select: (facet) => metricWithPrefix(facet, "memorability."),
      },
      {
        idPrefix: "survey-recall",
        label: "Recent recall",
        select: (facet) => exactMetric(facet, "recall.four_week"),
      },
    ],
  },
  near_conversion: {
    label: "Likely customers",
    selectionRationale:
      "Prioritizes perceived format effect and self-reported actions taken after noticing outdoor advertising.",
    candidates: [
      {
        idPrefix: "survey-effect",
        label: "Perceived effect",
        select: (facet) => formatAttributeMetric(facet, "effect"),
      },
      {
        idPrefix: "survey-action",
        label: "Reported store visit",
        select: (facet) =>
          exactMetric(facet, "action.visited_store_or_location"),
      },
      {
        idPrefix: "survey-action",
        label: "Reported online search",
        select: (facet) => exactMetric(facet, "action.searched_online"),
      },
      {
        idPrefix: "survey-action",
        label: "Reported purchase",
        select: (facet) =>
          exactMetric(facet, "action.purchased_product_or_service"),
      },
      {
        idPrefix: "survey-recall",
        label: "Recent recall",
        select: (facet) => exactMetric(facet, "recall.four_week"),
      },
    ],
  },
};

export function selectSurveyObjectiveContextProfile(input: {
  snapshot: SurveyAggregateSnapshot;
  query?: SurveyContextQuery;
  objective: SurveyPlanningObjective;
  maximumSignals?: number;
}): SelectedSurveyObjectiveContextProfile | null {
  const maximumSignals = Math.max(0, Math.min(3, input.maximumSignals ?? 3));
  const facet = selectSurveyFacet(input.snapshot, input.query ?? {});
  if (!facet) return null;
  const definition = OBJECTIVE_CONTEXT_DEFINITIONS[input.objective];
  const selectedMetricIds = new Set<string>();
  const signals: SurveyContextSignal[] = [];
  for (const candidate of definition.candidates) {
    if (signals.length >= maximumSignals) break;
    const metric = candidate.select(facet);
    if (!metric || selectedMetricIds.has(metric.id)) continue;
    selectedMetricIds.add(metric.id);
    signals.push(
      signalForMetric({
        snapshot: input.snapshot,
        facet,
        metric,
        id: `${candidate.idPrefix}:${metric.id}`,
        label: candidate.label,
      }),
    );
  }
  return {
    objective: input.objective,
    label: definition.label,
    selectionRationale: definition.selectionRationale,
    signals,
  };
}
