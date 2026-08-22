import {
  SURVEY_CLAIM_BOUNDARY,
  SURVEY_DECISION_USE,
  SURVEY_PLANNING_OBJECTIVES,
  type SurveyAggregateSnapshot,
  type SurveyContextQuery,
  type SurveyContextSignal,
  type SurveyFacetScope,
  type SurveyPlanningObjective,
} from "@/survey/contracts";
import {
  selectSurveyFacet,
  selectSurveyObjectiveContextProfile,
} from "@/survey/contextSignals";

export const SURVEY_PLANNING_CONTEXT_SCHEMA_VERSION =
  "consumer-survey-planning-context-v2" as const;

export type SurveyPlanningContextProfile = {
  objective: SurveyPlanningObjective;
  label: string;
  selectionRationale: string;
  signals: SurveyContextSignal[];
};

export type SurveyPlanningContextArtifactContent = {
  schemaVersion: typeof SURVEY_PLANNING_CONTEXT_SCHEMA_VERSION;
  sourceId: string;
  sourceSnapshotDigest: string;
  sourcePeriod: { start: string; end: string };
  query: SurveyContextQuery;
  scope: SurveyFacetScope;
  scopeLabel: string;
  sampleSize: number;
  weightingState: "unweighted_descriptive";
  qualityState: "owner_approved_cleaned_with_advisory_diagnostics";
  decisionUse: typeof SURVEY_DECISION_USE;
  claimBoundary: typeof SURVEY_CLAIM_BOUNDARY;
  profiles: Record<SurveyPlanningObjective, SurveyPlanningContextProfile>;
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
  query: SurveyContextQuery;
  maximumSignals?: number;
}): SurveyPlanningContextArtifactContent {
  const facet = selectSurveyFacet(input.snapshot, input.query);
  if (!facet) throw new Error("SURVEY_CONTEXT_FACET_NOT_FOUND");
  const profiles = Object.fromEntries(
    SURVEY_PLANNING_OBJECTIVES.map((objective) => {
      const profile = selectSurveyObjectiveContextProfile({
        snapshot: input.snapshot,
        query: input.query,
        objective,
        maximumSignals: input.maximumSignals ?? 3,
      });
      if (!profile || profile.signals.length === 0) {
        throw new Error(`SURVEY_CONTEXT_SIGNALS_UNAVAILABLE:${objective}`);
      }
      return [objective, profile];
    }),
  ) as Record<SurveyPlanningObjective, SurveyPlanningContextProfile>;
  return {
    schemaVersion: SURVEY_PLANNING_CONTEXT_SCHEMA_VERSION,
    sourceId: input.snapshot.source.id,
    sourceSnapshotDigest: input.snapshot.snapshotDigest,
    sourcePeriod: input.snapshot.source.collectionPeriod,
    query: input.query,
    scope: facet.scope,
    scopeLabel: scopeLabel(facet.scope),
    sampleSize: facet.sampleSize,
    weightingState: "unweighted_descriptive",
    qualityState: "owner_approved_cleaned_with_advisory_diagnostics",
    decisionUse: SURVEY_DECISION_USE,
    claimBoundary: SURVEY_CLAIM_BOUNDARY,
    profiles,
  };
}

export function selectSurveyPlanningContextProfile(
  artifact: SurveyPlanningContextArtifact,
  objective: SurveyPlanningObjective,
): SurveyPlanningContextProfile {
  const profile = artifact.profiles[objective];
  if (
    !profile ||
    profile.objective !== objective ||
    profile.signals.length === 0 ||
    profile.signals.length > 3
  ) {
    throw new Error(`SURVEY_PLANNING_CONTEXT_PROFILE_INVALID:${objective}`);
  }
  return profile;
}
