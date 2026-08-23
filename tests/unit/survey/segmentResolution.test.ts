import { describe, expect, it } from "vitest";
import catalogueJson from "@/survey/data/rbl-loma-2026-lagos-segment-catalogue.json";
import { surveyPlanningContextArtifactDigest } from "@/server/survey/publishedContextDigest";
import { surveySegmentCatalogueDigest } from "@/server/survey/segmentCatalogueDigest";
import {
  lagosPlanningContextArtifacts,
  resolveLagosPlanningContext,
  surveyAudienceLensBasisKey,
} from "@/survey/lagosPlanningContext";
import type {
  SurveySegmentCatalogue,
  SurveySegmentCatalogueContent,
} from "@/survey/segmentCatalogue";

const catalogue = catalogueJson as SurveySegmentCatalogue;

function brief(targetAudience: string, productDescription = "Campaign") {
  return { targetAudience, productDescription, sector: "fmcg" as const };
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [key, ...objectKeys(child)],
  );
}

describe("transparent survey segment resolution", () => {
  it("binds all published segment profiles to the exact source snapshot and n>=30 policy", () => {
    const { catalogueDigest, ...content } = catalogue;
    expect(
      surveySegmentCatalogueDigest(
        content satisfies SurveySegmentCatalogueContent,
      ),
    ).toBe(catalogueDigest);
    expect(catalogue).toMatchObject({
      schemaVersion: "consumer-survey-segment-catalogue-v1",
      sourceSnapshotDigest:
        "b44c4073ceb9056d88a061c40dbeaa70fa2154ff9ad32b4242bc6863bbb8552e",
      city: "Lagos",
      minimumSampleSize: 30,
      decisionUse: "context_only",
      claimBoundary: "self_reported_consumer_context_not_observed_delivery",
    });
    expect(catalogue.profiles).toHaveLength(12);
    expect(catalogue.profiles.every(({ sampleSize }) => sampleSize >= 30)).toBe(
      true,
    );
    for (const profile of catalogue.profiles) {
      for (const artifact of Object.values(profile.artifacts)) {
        const { artifactDigest, ...artifactContent } = artifact;
        expect(surveyPlanningContextArtifactDigest(artifactContent)).toBe(
          artifactDigest,
        );
        expect(artifact.sourceSnapshotDigest).toBe(
          catalogue.sourceSnapshotDigest,
        );
        expect(artifact.signals).toHaveLength(3);
      }
    }
  });

  it("uses the next available matched predicate when a precise segment is suppressed", () => {
    const context = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief(
        "Students, young workers, and convenience shoppers",
        "Affordable on-the-go refreshment launch",
      ),
    });
    expect(context.resolution).toMatchObject({
      mode: "matched_after_suppression",
      selectedProfileId: "ageBand:18-25",
      selectedLabel: "Aged 18–25",
      selectedSampleSize: 43,
      requestedPredicateLabel: "Occupation = Student",
      selectedPredicateLabel: "Age band = 18-25",
      unavailablePredicateLabels: ["Occupation = Student"],
    });
    expect(context.resolution.matchedTerms).toEqual([
      "students",
      "young workers",
    ]);
    expect(context.artifact).toMatchObject({
      objective: "broad_reach",
      sampleSize: 43,
      scope: { city: "Lagos", ageBand: "18-25" },
    });
  });

  it("resolves the preset briefs to published segment predicates", () => {
    const realEstate = resolveLagosPlanningContext({
      objective: "influential_core",
      brief: {
        targetAudience:
          "Affluent professionals, property investors, and diaspora buyers",
        productDescription:
          "Premium Lagos residential development for buyers and investors",
        sector: "real_estate",
      },
    });
    expect(realEstate.resolution).toMatchObject({
      mode: "matched_after_suppression",
      selectedProfileId: "occupation:business-trader",
      selectedLabel: "Business owners and traders",
      selectedSampleSize: 77,
    });
    expect(
      realEstate.artifact.signals.map(({ valueText }) => valueText),
    ).toEqual(["4.03 / 5", "78%", "30%"]);

    const bank = resolveLagosPlanningContext({
      objective: "near_conversion",
      brief: {
        targetAudience: "SME owners, merchants, and salaried professionals",
        productDescription:
          "Digital banking and payments for everyday business transactions",
        sector: "bank_fintech",
      },
    });
    expect(bank.resolution).toMatchObject({
      mode: "matched",
      selectedProfileId: "occupation:business-trader",
      selectedSampleSize: 77,
    });
    expect(bank.artifact.signals.map(({ valueText }) => valueText)).toEqual([
      "14%",
      "21%",
      "17%",
    ]);
  });

  it("falls back visibly when matched predicates do not clear the minimum sample", () => {
    const context = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief("Private car commuters and remote workers"),
    });
    expect(context.resolution).toMatchObject({
      mode: "fallback_suppressed",
      selectedProfileId: null,
      selectedLabel: "All Lagos respondents",
      selectedSampleSize: 204,
      unavailablePredicateLabels: [
        "Primary transport = Private car",
        "Mobility pattern = Remote",
      ],
    });
    expect(context.artifact).toBe(lagosPlanningContextArtifacts.broad_reach);
  });

  it("falls back to the city sample when no supported segment term is present", () => {
    const context = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief("People who enjoy refreshing drinks"),
    });
    expect(context.resolution).toMatchObject({
      mode: "fallback_no_match",
      selectedProfileId: null,
      selectedSampleSize: 204,
      matchedTerms: [],
      unavailablePredicateLabels: [],
    });
    expect(context.artifact.sampleSize).toBe(204);
  });

  it("supports explicit confirmation, manual segment override, and all-city override", () => {
    const automatic = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief(
        "Students, young workers, and convenience shoppers",
        "Affordable on-the-go refreshment launch",
      ),
    });
    expect(automatic.selection).toMatchObject({
      mode: "automatic",
      manualAction: null,
      selectedProfileId: "ageBand:18-25",
      selectedLabel: "Aged 18–25",
      selectedSampleSize: 43,
    });
    expect(automatic.audienceOptions).toHaveLength(13);
    expect(
      automatic.audienceOptions.every(({ sampleSize }) => sampleSize >= 30),
    ).toBe(true);

    const confirmed = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief(
        "Students, young workers, and convenience shoppers",
        "Affordable on-the-go refreshment launch",
      ),
      choice: { mode: "manual", profileId: "ageBand:18-25" },
    });
    expect(confirmed.selection).toMatchObject({
      mode: "manual",
      manualAction: "confirmed_automatic",
      selectedLabel: "Aged 18–25",
      selectedSampleSize: 43,
    });
    expect(confirmed.artifact.artifactDigest).toBe(
      automatic.artifact.artifactDigest,
    );

    const override = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief(
        "Students, young workers, and convenience shoppers",
        "Affordable on-the-go refreshment launch",
      ),
      choice: { mode: "manual", profileId: "occupation:business-trader" },
    });
    expect(override.resolution.selectedProfileId).toBe("ageBand:18-25");
    expect(override.selection).toMatchObject({
      mode: "manual",
      manualAction: "override",
      selectedProfileId: "occupation:business-trader",
      selectedLabel: "Business owners and traders",
      selectedPredicateLabel: "Occupation = Business/trader",
      selectedSampleSize: 77,
    });
    expect(override.artifact.signals.map(({ valueText }) => valueText)).toEqual(
      ["4.09 / 5", "39%", "30%"],
    );

    const allLagos = resolveLagosPlanningContext({
      objective: "broad_reach",
      brief: brief("SME owners and merchants"),
      choice: { mode: "manual", profileId: null },
    });
    expect(allLagos.selection).toMatchObject({
      mode: "manual",
      manualAction: "override",
      selectedProfileId: null,
      selectedLabel: "All Lagos respondents",
      selectedSampleSize: 204,
    });
    expect(allLagos.artifact).toBe(lagosPlanningContextArtifacts.broad_reach);
  });

  it("rejects stale manual profile ids and keys overrides to audience-defining brief fields", () => {
    expect(() =>
      resolveLagosPlanningContext({
        objective: "broad_reach",
        brief: brief("Students"),
        choice: { mode: "manual", profileId: "occupation:not-published" },
      }),
    ).toThrow("SURVEY_AUDIENCE_LENS_PROFILE_NOT_FOUND");

    const base = brief("Students", "Affordable refreshment");
    const baseKey = surveyAudienceLensBasisKey(base);
    expect(
      surveyAudienceLensBasisKey({ ...base, targetAudience: "BRT commuters" }),
    ).not.toBe(baseKey);
    expect(
      surveyAudienceLensBasisKey({
        ...base,
        productDescription: "Premium drink",
      }),
    ).not.toBe(baseKey);
    expect(
      surveyAudienceLensBasisKey({ ...base, sector: "bank_fintech" }),
    ).not.toBe(baseKey);
    expect(
      surveyAudienceLensBasisKey({
        ...base,
        targetAudience: "  STUDENTS  ",
        productDescription: "Affordable   refreshment",
      }),
    ).toBe(baseKey);
  });

  it("keeps segment catalogue contracts free of delivery and scoring fields", () => {
    const keys = new Set(objectKeys(catalogue).map((key) => key.toLowerCase()));
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
