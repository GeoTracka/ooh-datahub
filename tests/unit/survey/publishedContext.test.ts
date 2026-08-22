import { describe, expect, it } from "vitest";
import artifactJson from "@/survey/data/rbl-loma-2026-lagos-planning-context.json";
import { surveyPlanningContextArtifactDigest } from "@/server/survey/publishedContextDigest";
import { SURVEY_PLANNING_OBJECTIVES } from "@/survey/contracts";
import {
  selectSurveyPlanningContextProfile,
  type SurveyPlanningContextArtifact,
  type SurveyPlanningContextArtifactContent,
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
  it("binds the objective-aware Lagos projection to the exact aggregate snapshot", () => {
    const { artifactDigest, ...content } = artifact;
    expect(
      surveyPlanningContextArtifactDigest(
        content satisfies SurveyPlanningContextArtifactContent,
      ),
    ).toBe(artifactDigest);
    expect(artifact).toMatchObject({
      schemaVersion: "consumer-survey-planning-context-v2",
      artifactDigest:
        "795e392c77ef8ece87e4ff3ff35dfbce478ca483def211ec5ba3a47d8497e928",
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

  it("publishes exactly three independent signals for every planner objective", () => {
    expect(Object.keys(artifact.profiles).sort()).toEqual(
      [...SURVEY_PLANNING_OBJECTIVES].sort(),
    );
    for (const objective of SURVEY_PLANNING_OBJECTIVES) {
      const profile = selectSurveyPlanningContextProfile(artifact, objective);
      expect(profile.objective).toBe(objective);
      expect(profile.signals).toHaveLength(3);
      expect(
        profile.signals.every(
          (signal) =>
            signal.decisionUse === "context_only" &&
            signal.claimBoundary ===
              "self_reported_consumer_context_not_observed_delivery",
        ),
      ).toBe(true);
    }
  });

  it("selects objective-relevant metrics with their applicable denominators", () => {
    expect(
      artifact.profiles.broad_reach.signals.map(
        ({ label, metricLabel, valueText, evidenceSentence }) => ({
          label,
          metricLabel,
          valueText,
          evidenceSentence,
        }),
      ),
    ).toEqual([
      {
        label: "Recent recall",
        metricLabel: "Recalled an OOH advertisement in the previous four weeks",
        valueText: "72%",
        evidenceSentence:
          "Recalled an OOH advertisement in the previous four weeks was reported by 72% of 201 applicable responses in Lagos.",
      },
      {
        label: "Visibility environment",
        metricLabel: "Major roads or highways",
        valueText: "35%",
        evidenceSentence:
          "Major roads or highways was reported by 35% of 202 applicable responses in Lagos.",
      },
      {
        label: "Hardest-to-ignore format",
        metricLabel: "Large static billboard",
        valueText: "38%",
        evidenceSentence:
          "Large static billboard was reported by 38% of 204 applicable responses in Lagos.",
      },
    ]);

    expect(
      artifact.profiles.influential_core.signals.map(
        ({ label, metricLabel, valueText }) => ({
          label,
          metricLabel,
          valueText,
        }),
      ),
    ).toEqual([
      {
        label: "Perceived trust",
        metricLabel: "Large billboard — trust",
        valueText: "4.13 / 5",
      },
      {
        label: "Personal relevance",
        metricLabel: "Relevant to my life",
        valueText: "36%",
      },
      {
        label: "Creative cue",
        metricLabel: "Creative design",
        valueText: "28%",
      },
    ]);

    expect(
      artifact.profiles.near_conversion.signals.map(
        ({ label, metricLabel, valueText }) => ({
          label,
          metricLabel,
          valueText,
        }),
      ),
    ).toEqual([
      {
        label: "Perceived effect",
        metricLabel: "Large billboard — effect",
        valueText: "4.16 / 5",
      },
      {
        label: "Reported store visit",
        metricLabel: "Visited store or location",
        valueText: "27%",
      },
      {
        label: "Reported online search",
        metricLabel: "Searched online",
        valueText: "21%",
      },
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
      "packageid",
      "deliveryraw",
    ]) {
      expect(keys.has(prohibited)).toBe(false);
    }
  });
});
