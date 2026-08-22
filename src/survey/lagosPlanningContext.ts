import broadReachArtifactJson from "@/survey/data/rbl-loma-2026-lagos-planning-context.json";
import influentialCoreArtifactJson from "@/survey/data/rbl-loma-2026-lagos-influential-core-context.json";
import nearConversionArtifactJson from "@/survey/data/rbl-loma-2026-lagos-near-conversion-context.json";
import type { SurveyPlanningObjective } from "@/survey/contextSignals";
import type { SurveyPlanningContextArtifact } from "@/survey/publishedContext";

export const lagosPlanningContextArtifacts: Record<
  SurveyPlanningObjective,
  SurveyPlanningContextArtifact
> = {
  broad_reach: broadReachArtifactJson as SurveyPlanningContextArtifact,
  influential_core:
    influentialCoreArtifactJson as SurveyPlanningContextArtifact,
  near_conversion:
    nearConversionArtifactJson as SurveyPlanningContextArtifact,
};

export const lagosPlanningContextArtifact =
  lagosPlanningContextArtifacts.broad_reach;

export function selectLagosPlanningContextArtifact(
  objective: SurveyPlanningObjective,
): SurveyPlanningContextArtifact {
  return lagosPlanningContextArtifacts[objective];
}
