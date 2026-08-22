import "server-only";

import { createHash } from "node:crypto";
import type {
  SurveyAggregateSnapshot,
  SurveyAggregateSnapshotContent,
} from "@/survey/contracts";
import { canonicalJson } from "@/shared/canonicalJson";

export function surveyAggregateSnapshotDigest(
  content: SurveyAggregateSnapshotContent,
): string {
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

export function bindSurveyAggregateSnapshotDigest(
  content: SurveyAggregateSnapshotContent,
): SurveyAggregateSnapshot {
  return {
    ...content,
    snapshotDigest: surveyAggregateSnapshotDigest(content),
  };
}
