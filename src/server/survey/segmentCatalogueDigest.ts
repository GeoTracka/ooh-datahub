import "server-only";

import { createHash } from "node:crypto";
import { canonicalJson } from "@/shared/canonicalJson";
import type {
  SurveySegmentCatalogue,
  SurveySegmentCatalogueContent,
} from "@/survey/segmentCatalogue";

export function surveySegmentCatalogueDigest(
  content: SurveySegmentCatalogueContent,
): string {
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

export function bindSurveySegmentCatalogueDigest(
  content: SurveySegmentCatalogueContent,
): SurveySegmentCatalogue {
  return {
    ...content,
    catalogueDigest: surveySegmentCatalogueDigest(content),
  };
}
