import { describe, expect, it } from "vitest";
import broadReachJson from "@/survey/data/rbl-loma-2026-lagos-planning-context.json";
import influentialCoreJson from "@/survey/data/rbl-loma-2026-lagos-influential-core-context.json";
import nearConversionJson from "@/survey/data/rbl-loma-2026-lagos-near-conversion-context.json";
import { surveyPlanningContextArtifactDigest } from "@/server/survey/publishedContextDigest";
import type { SurveyPlanningObjective } from "@/survey/contextSignals";
import type {
  SurveyPlanningContextArtifact,
  SurveyPlanningContextArtifactContent,
} from "@/survey/publishedContext";

const artifacts: Record<
  SurveyPlanningObjective,
  SurveyPlanningContextArtifact
> = {
  broad_reach: broadReachJson as SurveyPlanningContextArtifact,
  influential_core: influentialCoreJson as SurveyPlanningContextArtifact,
  near_conversion: nearConversionJson as SurveyPlanningContextArtifact,
};

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [key, ...objectKeys(child)],
  );
}

describe("published consumer survey planning context", () => {
  it("binds every objective profile to one exact aggregate snapshot", () => {
    for (const [objective, artifact] of Object.entries(artifacts) as Array<
      [SurveyPlanningObjective, SurveyPlanningContextArtifact]
    >) {
      const { artifactDigest, ...content } = artifact;
      expect(
        surveyPlanningContextArtifactDigest(
          content satisfies SurveyPlanningContextArtifactContent,
        ),
      ).toBe(artifactDigest);
      expect(artifact).toMatchObject({
        schemaVersion: "consumer-survey-planning-context-v2",
        objective,
        sourceSnapshotDigest:
          "c0644a87d54060b71963f7b9cedaf994efec3828a62400d5c4c92340ea1b64fa",
        scope: { city: "Lagos" },
        scopeLabel: "Lagos",
        sampleSize: 204,
        weightingState: "unweighted_descriptive",
        decisionUse: "context_only",
        claimBoundary:
          "self_reported_consumer_context_not_observed_delivery",
      });
      expect(artifact.signals).toHaveLength(3);
    }
  });

  it("publishes distinct independent facts for each objective", () => {
    expect(
      artifacts.broad_reach.signals.map(
        ({ label, metricLabel, valueText }) => ({
          label,
          metricLabel,
          valueText,
        }),
      ),
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
      artifacts.influential_core.signals.map(
        ({ label, metricLabel, valueText }) => ({
          label,
          metricLabel,
          valueText,
        }),
      ),
    ).toEqual([
      {
        label: "Trust affinity",
        metricLabel: "Large billboard — trust",
        valueText: "4.13 / 5",
      },
      {
        label: "Recall context",
        metricLabel:
          "Recalled an OOH advertisement in the previous four weeks",
        valueText: "72%",
      },
      {
        label: "Creative cue",
        metricLabel: "Creative design",
        valueText: "28%",
      },
    ]);

    expect(
      artifacts.near_conversion.signals.map(
        ({ label, metricLabel, valueText }) => ({
          label,
          metricLabel,
          valueText,
        }),
      ),
    ).toEqual([
      {
        label: "Search response",
        metricLabel: "Searched online",
        valueText: "21%",
      },
      {
        label: "Visit response",
        metricLabel: "Visited store or location",
        valueText: "27%",
      },
      {
        label: "Purchase response",
        metricLabel: "Purchased product or service",
        valueText: "16%",
      },
    ]);
  });

  it("keeps source provenance identical while objective profiles differ", () => {
    const profiles = Object.values(artifacts);
    expect(new Set(profiles.map(({ sourceId }) => sourceId))).toHaveLength(1);
    expect(
      new Set(profiles.map(({ sourceSnapshotDigest }) => sourceSnapshotDigest)),
    ).toHaveLength(1);
    expect(
      new Set(profiles.map(({ sampleSize }) => sampleSize)),
    ).toHaveLength(1);
    expect(
      new Set(profiles.map(({ artifactDigest }) => artifactDigest)).size,
    ).toBe(3);
  });

  it("contains no delivery-measurement or scoring contract fields", () => {
    for (const artifact of Object.values(artifacts)) {
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
    }
  });
});
