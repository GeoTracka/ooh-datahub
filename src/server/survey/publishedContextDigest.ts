import "server-only";

import { createHash } from "node:crypto";
import type {
  SurveyPlanningContextArtifact,
  SurveyPlanningContextArtifactContent,
} from "@/survey/publishedContext";
import { canonicalJson } from "@/shared/canonicalJson";

export function surveyPlanningContextArtifactDigest(
  content: SurveyPlanningContextArtifactContent,
): string {
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

export function bindSurveyPlanningContextArtifactDigest(
  content: SurveyPlanningContextArtifactContent,
): SurveyPlanningContextArtifact {
  return {
    ...content,
    artifactDigest: surveyPlanningContextArtifactDigest(content),
  };
}
