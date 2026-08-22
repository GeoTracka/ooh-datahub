import type { Brief } from "@/contracts/domain";
import broadReachArtifactJson from "@/survey/data/rbl-loma-2026-lagos-planning-context.json";
import influentialCoreArtifactJson from "@/survey/data/rbl-loma-2026-lagos-influential-core-context.json";
import nearConversionArtifactJson from "@/survey/data/rbl-loma-2026-lagos-near-conversion-context.json";
import segmentCatalogueJson from "@/survey/data/rbl-loma-2026-lagos-segment-catalogue.json";
import type { SurveyPlanningObjective } from "@/survey/contextSignals";
import type { SurveyPlanningContextArtifact } from "@/survey/publishedContext";
import type { SurveySegmentCatalogue } from "@/survey/segmentCatalogue";
import {
  resolveSurveySegment,
  selectedSurveySegmentProfile,
  type SurveySegmentResolution,
} from "@/survey/segmentResolution";

export const lagosPlanningContextArtifacts: Record<
  SurveyPlanningObjective,
  SurveyPlanningContextArtifact
> = {
  broad_reach: broadReachArtifactJson as SurveyPlanningContextArtifact,
  influential_core:
    influentialCoreArtifactJson as SurveyPlanningContextArtifact,
  near_conversion: nearConversionArtifactJson as SurveyPlanningContextArtifact,
};

export const lagosSurveySegmentCatalogue =
  segmentCatalogueJson as SurveySegmentCatalogue;

export const lagosPlanningContextArtifact =
  lagosPlanningContextArtifacts.broad_reach;

export type ResolvedSurveyPlanningContext = {
  artifact: SurveyPlanningContextArtifact;
  resolution: SurveySegmentResolution;
  catalogueDigest: string;
};

export function selectLagosPlanningContextArtifact(
  objective: SurveyPlanningObjective,
): SurveyPlanningContextArtifact {
  return lagosPlanningContextArtifacts[objective];
}

export function resolveLagosPlanningContext(input: {
  objective: SurveyPlanningObjective;
  brief: Pick<Brief, "targetAudience" | "productDescription" | "sector">;
}): ResolvedSurveyPlanningContext {
  const fallbackArtifact = selectLagosPlanningContextArtifact(input.objective);
  const resolution = resolveSurveySegment({
    catalogue: lagosSurveySegmentCatalogue,
    fallbackSampleSize: fallbackArtifact.sampleSize,
    brief: input.brief,
  });
  const profile = selectedSurveySegmentProfile({
    catalogue: lagosSurveySegmentCatalogue,
    resolution,
  });
  const artifact = profile?.artifacts[input.objective] ?? fallbackArtifact;
  if (artifact.sourceSnapshotDigest !== fallbackArtifact.sourceSnapshotDigest) {
    throw new Error("SURVEY_SEGMENT_SOURCE_SNAPSHOT_MISMATCH");
  }
  if (artifact.decisionUse !== "context_only") {
    throw new Error("SURVEY_SEGMENT_DECISION_USE_INVALID");
  }
  return {
    artifact,
    resolution: {
      ...resolution,
      selectedSampleSize: artifact.sampleSize,
    },
    catalogueDigest: lagosSurveySegmentCatalogue.catalogueDigest,
  };
}
