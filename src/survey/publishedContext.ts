import {
  SURVEY_CLAIM_BOUNDARY,
  SURVEY_DECISION_USE,
  type SurveyAggregateSnapshot,
  type SurveyContextQuery,
  type SurveyContextSignal,
  type SurveyFacetScope,
} from "@/survey/contracts";
import {
  selectSurveyContextSignals,
  selectSurveyFacet,
  type SurveyPlanningObjective,
} from "@/survey/contextSignals";

export const SURVEY_PLANNING_CONTEXT_SCHEMA_VERSION =
  "consumer-survey-planning-context-v2" as const;

export type SurveyPlanningContextArtifactContent = {
  schemaVersion: typeof SURVEY_PLANNING_CONTEXT_SCHEMA_VERSION;
  sourceId: string;
  sourceSnapshotDigest: string;
  sourcePeriod: { start: string; end: string };
  objective: SurveyPlanningObjective;
  query: SurveyContextQuery;
  scope: SurveyFacetScope;
  scopeLabel: string;
  sampleSize: number;
  weightingState: "unweighted_descriptive";
  qualityState: "owner_approved_cleaned_with_advisory_diagnostics";
  decisionUse: typeof SURVEY_DECISION_USE;
  claimBoundary: typeof SURVEY_CLAIM_BOUNDARY;
  signals: SurveyContextSignal[];
};

export type SurveyPlanningContextArtifact =
  SurveyPlanningContextArtifactContent & {
    artifactDigest: string;
  };

function scopeLabel(scope: SurveyFacetScope): string {
  const values = Object.values(scope);
  return values.length > 0 ? values.join(" · ") : "Approved survey sample";
}

export function buildSurveyPlanningContextArtifactContent(input: {
  snapshot: SurveyAggregateSnapshot;
  objective: SurveyPlanningObjective;
  query: SurveyContextQuery;
  maximumSignals?: number;
}): SurveyPlanningContextArtifactContent {
  const facet = selectSurveyFacet(input.snapshot, input.query);
  if (!facet) throw new Error("SURVEY_CONTEXT_FACET_NOT_FOUND");
  const signals = selectSurveyContextSignals({
    snapshot: input.snapshot,
    objective: input.objective,
    query: input.query,
    maximumSignals: input.maximumSignals ?? 3,
  });
  if (signals.length === 0) {
    throw new Error("SURVEY_CONTEXT_SIGNALS_UNAVAILABLE");
  }
  return {
    schemaVersion: SURVEY_PLANNING_CONTEXT_SCHEMA_VERSION,
    sourceId: input.snapshot.source.id,
    sourceSnapshotDigest: input.snapshot.snapshotDigest,
    sourcePeriod: input.snapshot.source.collectionPeriod,
    objective: input.objective,
    query: input.query,
    scope: facet.scope,
    scopeLabel: scopeLabel(facet.scope),
    sampleSize: facet.sampleSize,
    weightingState: "unweighted_descriptive",
    qualityState: "owner_approved_cleaned_with_advisory_diagnostics",
    decisionUse: SURVEY_DECISION_USE,
    claimBoundary: SURVEY_CLAIM_BOUNDARY,
    signals,
  };
}
