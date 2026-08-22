import { describe, expect, it } from "vitest";
import artifactJson from "@/survey/data/rbl-loma-2026-lagos-planning-context.json";
import { surveyPlanningContextArtifactDigest } from "@/server/survey/publishedContextDigest";
import type {
  SurveyPlanningContextArtifact,
  SurveyPlanningContextArtifactContent,
} from "@/survey/publishedContext";

const artifact = artifactJson as SurveyPlanningContextArtifact;

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [key, ...objectKeys(child)],
  );
}

describe("published consumer survey planning context", () => {
  it("binds the compact Lagos projection to the exact aggregate snapshot", () => {
    const { artifactDigest, ...content } = artifact;
    expect(
      surveyPlanningContextArtifactDigest(
        content satisfies SurveyPlanningContextArtifactContent,
      ),
    ).toBe(artifactDigest);
    expect(artifact).toMatchObject({
      schemaVersion: "consumer-survey-planning-context-v1",
      sourceSnapshotDigest:
        "c0644a87d54060b71963f7b9cedaf994efec3828a62400d5c4c92340ea1b64fa",
      scope: { city: "Lagos" },
      scopeLabel: "Lagos",
      sampleSize: 204,
      weightingState: "unweighted_descriptive",
      decisionUse: "context_only",
      claimBoundary: "self_reported_consumer_context_not_observed_delivery",
    });
  });

  it("publishes exactly three independent signals with applicable denominators", () => {
    expect(artifact.signals).toHaveLength(3);
    expect(
      artifact.signals.map(({ label, metricLabel, valueText }) => ({
        label,
        metricLabel,
        valueText,
      })),
    ).toEqual([
      {
        label: "Format affinity",
        metricLabel: "Large billboard overall affinity",
        valueText: "4.14 / 5",
      },
      {
        label: "Environment pattern",
        metricLabel: "Major roads or highways",
        valueText: "35%",
      },
      {
        label: "Creative cue",
        metricLabel: "Creative design",
        valueText: "28%",
      },
    ]);
    expect(
      artifact.signals.map(({ evidenceSentence }) => evidenceSentence),
    ).toEqual([
      "Large billboard overall affinity scored 4.14 out of 5 across 177 applicable responses in Lagos.",
      "Major roads or highways was reported by 35% of 202 applicable responses in Lagos.",
      "Creative design was reported by 28% of 204 applicable responses in Lagos.",
    ]);
  });

  it("contains no delivery-measurement or scoring contract fields", () => {
    const keys = new Set(objectKeys(artifact).map((key) => key.toLowerCase()));
    for (const prohibited of [
      "movement",
      "ots",
      "reach",
      "frequency",
      "uniquereach",
      "targetshare",
      "influence",
      "planningfit",
      "calibration",
      "evidencegrade",
    ]) {
      expect(keys.has(prohibited)).toBe(false);
    }
  });
});
