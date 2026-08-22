import "server-only";

import { bindSurveyPlanningContextArtifactDigest } from "@/server/survey/publishedContextDigest";
import {
  SURVEY_CLAIM_BOUNDARY,
  SURVEY_DECISION_USE,
  type SurveyAggregateFacet,
  type SurveyAggregateSnapshot,
  type SurveyContextQuery,
} from "@/survey/contracts";
import {
  SURVEY_PLANNING_OBJECTIVES,
  type SurveyPlanningObjective,
} from "@/survey/contextSignals";
import { buildSurveyPlanningContextArtifactContent } from "@/survey/publishedContext";
import {
  SURVEY_SEGMENT_CATALOGUE_SCHEMA_VERSION,
  SURVEY_SEGMENT_DIMENSIONS,
  surveySegmentLabel,
  surveySegmentPredicateLabel,
  surveySegmentProfileId,
  type SurveySegmentCatalogueContent,
  type SurveySegmentDimension,
  type SurveySegmentProfile,
} from "@/survey/segmentCatalogue";

function segmentFacet(
  facet: SurveyAggregateFacet,
  city: string,
): { dimension: SurveySegmentDimension; value: string } | null {
  if (facet.scope.city !== city || Object.keys(facet.scope).length !== 2) {
    return null;
  }
  for (const dimension of SURVEY_SEGMENT_DIMENSIONS) {
    const value = facet.scope[dimension];
    if (typeof value === "string" && value.length > 0) {
      return { dimension, value };
    }
  }
  return null;
}

function profileForFacet(input: {
  snapshot: SurveyAggregateSnapshot;
  city: string;
  facet: SurveyAggregateFacet;
  dimension: SurveySegmentDimension;
  value: string;
}): SurveySegmentProfile {
  const query = {
    city: input.city,
    [input.dimension]: input.value,
  } satisfies SurveyContextQuery;
  const artifacts = Object.fromEntries(
    SURVEY_PLANNING_OBJECTIVES.map((objective) => {
      const content = buildSurveyPlanningContextArtifactContent({
        snapshot: input.snapshot,
        objective,
        query,
        maximumSignals: 3,
      });
      return [objective, bindSurveyPlanningContextArtifactDigest(content)];
    }),
  ) as Record<
    SurveyPlanningObjective,
    ReturnType<typeof bindSurveyPlanningContextArtifactDigest>
  >;

  return {
    id: surveySegmentProfileId(input.dimension, input.value),
    dimension: input.dimension,
    value: input.value,
    label: surveySegmentLabel(input.dimension, input.value),
    predicateLabel: surveySegmentPredicateLabel(input.dimension, input.value),
    query,
    sampleSize: input.facet.sampleSize,
    artifacts,
  };
}

export function buildSurveySegmentCatalogueContent(input: {
  snapshot: SurveyAggregateSnapshot;
  city: string;
}): SurveySegmentCatalogueContent {
  const profiles = input.snapshot.facets
    .flatMap((facet) => {
      const segment = segmentFacet(facet, input.city);
      return segment
        ? [
            profileForFacet({
              snapshot: input.snapshot,
              city: input.city,
              facet,
              ...segment,
            }),
          ]
        : [];
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    schemaVersion: SURVEY_SEGMENT_CATALOGUE_SCHEMA_VERSION,
    sourceId: input.snapshot.source.id,
    sourceArtifactSha256: input.snapshot.source.sha256,
    sourceSnapshotDigest: input.snapshot.snapshotDigest,
    sourcePeriod: input.snapshot.source.collectionPeriod,
    city: input.city,
    minimumSampleSize: input.snapshot.minimumSampleSize,
    weightingState: "unweighted_descriptive",
    qualityState: "owner_approved_cleaned_with_advisory_diagnostics",
    decisionUse: SURVEY_DECISION_USE,
    claimBoundary: SURVEY_CLAIM_BOUNDARY,
    profiles,
  };
}
