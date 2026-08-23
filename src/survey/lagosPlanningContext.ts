import type { Brief } from "@/contracts/domain";
import broadReachArtifactJson from "@/survey/data/rbl-loma-2026-lagos-planning-context.json";
import influentialCoreArtifactJson from "@/survey/data/rbl-loma-2026-lagos-influential-core-context.json";
import nearConversionArtifactJson from "@/survey/data/rbl-loma-2026-lagos-near-conversion-context.json";
import segmentCatalogueJson from "@/survey/data/rbl-loma-2026-lagos-segment-catalogue.json";
import type { SurveyPlanningObjective } from "@/survey/contextSignals";
import type { SurveyPlanningContextArtifact } from "@/survey/publishedContext";
import type {
  SurveySegmentCatalogue,
  SurveySegmentDimension,
  SurveySegmentProfile,
} from "@/survey/segmentCatalogue";
import {
  resolveSurveySegment,
  selectedSurveySegmentProfile,
  surveyAudienceLensBasisKey,
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

export type SurveyAudienceLensChoice =
  { mode: "automatic" } | { mode: "manual"; profileId: string | null };

export type SurveyAudienceLensSelection = {
  mode: SurveyAudienceLensChoice["mode"];
  manualAction: "confirmed_automatic" | "override" | null;
  selectedProfileId: string | null;
  selectedLabel: string;
  selectedPredicateLabel: string | null;
  selectedSampleSize: number;
  explanation: string;
};

export type SurveyAudienceLensOption = {
  profileId: string | null;
  dimension: SurveySegmentDimension | null;
  label: string;
  predicateLabel: string | null;
  sampleSize: number;
};

export type ResolvedSurveyPlanningContext = {
  artifact: SurveyPlanningContextArtifact;
  resolution: SurveySegmentResolution;
  selection: SurveyAudienceLensSelection;
  audienceOptions: SurveyAudienceLensOption[];
  catalogueDigest: string;
  minimumSampleSize: number;
};

export const AUTOMATIC_SURVEY_AUDIENCE_LENS: SurveyAudienceLensChoice = {
  mode: "automatic",
};

export function selectLagosPlanningContextArtifact(
  objective: SurveyPlanningObjective,
): SurveyPlanningContextArtifact {
  return lagosPlanningContextArtifacts[objective];
}

function validateSurveyContextArtifact(
  artifact: SurveyPlanningContextArtifact,
  fallbackArtifact: SurveyPlanningContextArtifact,
): void {
  if (artifact.sourceSnapshotDigest !== fallbackArtifact.sourceSnapshotDigest) {
    throw new Error("SURVEY_SEGMENT_SOURCE_SNAPSHOT_MISMATCH");
  }
  if (artifact.decisionUse !== "context_only") {
    throw new Error("SURVEY_SEGMENT_DECISION_USE_INVALID");
  }
}

function automaticSelection(
  resolution: SurveySegmentResolution,
): SurveyAudienceLensSelection {
  return {
    mode: "automatic",
    manualAction: null,
    selectedProfileId: resolution.selectedProfileId,
    selectedLabel: resolution.selectedLabel,
    selectedPredicateLabel: resolution.selectedPredicateLabel,
    selectedSampleSize: resolution.selectedSampleSize,
    explanation: resolution.explanation,
  };
}

function manualSelection(input: {
  profile: SurveySegmentProfile | null;
  fallbackSampleSize: number;
  city: string;
  automaticResolution: SurveySegmentResolution;
}): SurveyAudienceLensSelection {
  const selectedLabel = input.profile?.label ?? `All ${input.city} respondents`;
  const selectedPredicateLabel = input.profile?.predicateLabel ?? null;
  const selectedSampleSize =
    input.profile?.sampleSize ?? input.fallbackSampleSize;
  const automaticLabel = input.automaticResolution.selectedLabel;
  const selectedProfileId = input.profile?.id ?? null;
  const confirmedAutomatic =
    selectedProfileId === input.automaticResolution.selectedProfileId;
  return {
    mode: "manual",
    manualAction: confirmedAutomatic ? "confirmed_automatic" : "override",
    selectedProfileId,
    selectedLabel,
    selectedPredicateLabel,
    selectedSampleSize,
    explanation: confirmedAutomatic
      ? `User confirmed the automatic audience lens, ${selectedLabel}.`
      : `User selected ${selectedLabel} instead of the automatic brief suggestion, ${automaticLabel}.`,
  };
}

function audienceOptions(
  catalogue: SurveySegmentCatalogue,
  fallbackSampleSize: number,
): SurveyAudienceLensOption[] {
  return [
    {
      profileId: null,
      dimension: null,
      label: `All ${catalogue.city} respondents`,
      predicateLabel: null,
      sampleSize: fallbackSampleSize,
    },
    ...catalogue.profiles.map((profile) => ({
      profileId: profile.id,
      dimension: profile.dimension,
      label: profile.label,
      predicateLabel: profile.predicateLabel,
      sampleSize: profile.sampleSize,
    })),
  ];
}

export function resolveLagosPlanningContext(input: {
  objective: SurveyPlanningObjective;
  brief: Pick<Brief, "targetAudience" | "productDescription" | "sector">;
  choice?: SurveyAudienceLensChoice;
}): ResolvedSurveyPlanningContext {
  const fallbackArtifact = selectLagosPlanningContextArtifact(input.objective);
  const resolution = resolveSurveySegment({
    catalogue: lagosSurveySegmentCatalogue,
    fallbackSampleSize: fallbackArtifact.sampleSize,
    brief: input.brief,
  });
  const automaticProfile = selectedSurveySegmentProfile({
    catalogue: lagosSurveySegmentCatalogue,
    resolution,
  });
  const choice = input.choice ?? AUTOMATIC_SURVEY_AUDIENCE_LENS;

  let profile = automaticProfile;
  let selection = automaticSelection(resolution);
  if (choice.mode === "manual") {
    profile = choice.profileId
      ? (lagosSurveySegmentCatalogue.profiles.find(
          ({ id }) => id === choice.profileId,
        ) ?? null)
      : null;
    if (choice.profileId && !profile) {
      throw new Error(
        `SURVEY_AUDIENCE_LENS_PROFILE_NOT_FOUND:${choice.profileId}`,
      );
    }
    selection = manualSelection({
      profile,
      fallbackSampleSize: fallbackArtifact.sampleSize,
      city: lagosSurveySegmentCatalogue.city,
      automaticResolution: resolution,
    });
  }

  const artifact = profile?.artifacts[input.objective] ?? fallbackArtifact;
  validateSurveyContextArtifact(artifact, fallbackArtifact);
  if (artifact.sampleSize !== selection.selectedSampleSize) {
    throw new Error("SURVEY_AUDIENCE_LENS_SAMPLE_SIZE_MISMATCH");
  }

  return {
    artifact,
    resolution,
    selection,
    audienceOptions: audienceOptions(
      lagosSurveySegmentCatalogue,
      fallbackArtifact.sampleSize,
    ),
    catalogueDigest: lagosSurveySegmentCatalogue.catalogueDigest,
    minimumSampleSize: lagosSurveySegmentCatalogue.minimumSampleSize,
  };
}

export { surveyAudienceLensBasisKey };
