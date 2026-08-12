import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import {
  comparePackageCandidates,
  optimizePackage,
  selectPackageOptions,
} from "@/planning/packageOptimizer";
import { evidenceScore } from "@/planning/evidence";

const brief = {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg" as const,
  objective: "broad_reach" as const,
  daypart: "pm" as const,
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("optimizePackage", () => {
  it("returns one package across exactly three selected zones", () => {
    const result = optimizePackage(frozenLagosBundle, brief);
    expect(result.recommended.zoneIds).toHaveLength(3);
    expect(result.internalReplacements).toHaveLength(2);
    expect(result.recommended.costNgn).toBeLessThanOrEqual(brief.budgetNgn);
    expect(result.recommended.evidenceScore).toBe(
      evidenceScore(frozenLagosBundle.evidenceProfiles.recommendation),
    );
    expect(result.recommended.evidenceScore).toBe(40);
    expect(result.recommended.evidenceScore).not.toBe(54);
    expect(result.recommended.evidenceGrade).toBe("D");
  });

  it("returns three distinct planning approaches", () => {
    const result = optimizePackage(frozenLagosBundle, brief);
    expect(result.packageOptions.map((option) => option.style)).toEqual([
      "best_overall",
      "maximum_delivery",
      "budget_smart",
    ]);
    expect(new Set(result.packageOptions.map((option) => option.candidate.id)).size)
      .toBe(3);
    expect(result.packageOptions[0].candidate.id).toBe(result.recommended.id);
    expect(result.packageOptions.every((option) => option.candidate.valid)).toBe(true);
  });

  it("keeps the budget-smart approach within the planning-fit guardrail", () => {
    const result = optimizePackage(frozenLagosBundle, brief);
    const best = result.packageOptions.find((option) => option.style === "best_overall")!;
    const budget = result.packageOptions.find((option) => option.style === "budget_smart")!;
    expect(budget.candidate.planningFit)
      .toBeGreaterThanOrEqual(best.candidate.planningFit! - 5);
  });

  it("allocates valid candidates in style priority order", () => {
    const template = optimizePackage(frozenLagosBundle, brief).recommended;
    const best = { ...template, id: "best", planningFit: 100, deliveryRaw: 100, costNgn: 20 };
    const delivery = { ...template, id: "delivery", planningFit: 98, deliveryRaw: 300, costNgn: 10 };
    const budget = { ...template, id: "budget", planningFit: 97, deliveryRaw: 200, costNgn: 12 };

    const options = selectPackageOptions([best, delivery, budget]);

    expect(options.map((option) => [option.style, option.candidate.id])).toEqual([
      ["best_overall", "best"],
      ["maximum_delivery", "delivery"],
      ["budget_smart", "budget"],
    ]);
  });

  it("keeps valid candidates ahead of invalid recovery candidates", () => {
    const template = optimizePackage(frozenLagosBundle, brief).recommended;
    const valid = { ...template, id: "valid", planningFit: 80, valid: true };
    const invalidHigh = { ...template, id: "invalid-high", planningFit: 100, valid: false };
    const invalidSecond = { ...template, id: "invalid-second", planningFit: 99, valid: false };

    const options = selectPackageOptions([invalidHigh, invalidSecond, valid]);

    expect(options[0]).toMatchObject({
      style: "best_overall",
      candidate: { id: "valid", valid: true },
    });
    expect(new Set(options.map((option) => option.candidate.id)).size).toBe(3);
  });

  it("returns only the distinct candidates available in a limited cohort", () => {
    const template = optimizePackage(frozenLagosBundle, brief).recommended;
    const options = selectPackageOptions([
      { ...template, id: "one" },
      { ...template, id: "two" },
    ]);

    expect(options).toHaveLength(2);
    expect(new Set(options.map((option) => option.candidate.id)).size).toBe(2);
  });

  it.each(["broad_reach", "influential_core", "near_conversion"] as const)(
    "returns a valid maximum-delivery approach for %s",
    (objective) => {
      const result = optimizePackage(frozenLagosBundle, { ...brief, objective });
      const maximum = result.packageOptions.find(
        (option) => option.style === "maximum_delivery",
      )!;
      expect(maximum.candidate.valid).toBe(true);
      expect(maximum.candidate.deliveryRaw).not.toBeNull();
    },
  );

  it("returns a repairable invalid result instead of throwing below minimum cost", () => {
    const result = optimizePackage(frozenLagosBundle, { ...brief, budgetNgn: 1 });
    expect(result.recommended.valid).toBe(false);
    expect(result.recommended.invalidReasonCodes).toContain("BUDGET_EXCEEDED");
    expect(result.recommended.siteIds.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the best objective score non-decreasing for nested budget sets", () => {
    fc.assert(fc.property(
      fc.integer({ min: 15, max: 18 }),
      fc.integer({ min: 0, max: 4 }),
      (lowerMillions, deltaMillions) => {
        const smaller = optimizePackage(frozenLagosBundle, {
          ...brief,
          budgetNgn: lowerMillions * 1_000_000,
        });
        const larger = optimizePackage(frozenLagosBundle, {
          ...brief,
          budgetNgn: (lowerMillions + deltaMillions) * 1_000_000,
        });
        expect(larger.recommended.planningFit!)
          .toBeGreaterThanOrEqual(smaller.recommended.planningFit!);
      },
    ), { seed: 260803, numRuns: 30 });
  }, 120_000);

  it("uses influence mass as the one Delivery input for Influential core", () => {
    const result = optimizePackage(frozenLagosBundle, {
      ...brief,
      objective: "influential_core",
    });
    expect(result.recommended.deliveryRaw).toBe(
      result.measurement!.scenarios[1].influenceMass,
    );
  });

  it("accepts an individual zero qi when compatible influence mass remains", () => {
    const candidate = structuredClone(frozenLagosBundle);
    candidate.panel.find((member) => member.sector === "fmcg")!.qi = 0;
    const result = optimizePackage(candidate, {
      ...brief,
      objective: "influential_core",
    });
    expect(result.recommended.mode).toBe("planning_fit");
    expect(result.measurement!.influence).not.toBeNull();
  });

  it("breaks exact score ties by evidence, cost, then stable ID", () => {
    const template = optimizePackage(frozenLagosBundle, brief).recommended;
    const tied = [
      { ...template, id: "b", evidenceScore: 60, costNgn: 11_000_000 },
      { ...template, id: "a", evidenceScore: 60, costNgn: 11_000_000 },
      { ...template, id: "c", evidenceScore: 61, costNgn: 12_000_000 },
      { ...template, id: "d", evidenceScore: 60, costNgn: 10_000_000 },
    ].sort(comparePackageCandidates);
    expect(tied.map((candidate) => candidate.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("does not label a qi-ineligible shortlist as Planning Fit", () => {
    const noQi = structuredClone(frozenLagosBundle);
    for (const member of noQi.panel.filter((item) => item.sector === "fmcg")) {
      member.qi = 0;
    }
    const result = optimizePackage(noQi, { ...brief, objective: "influential_core" });
    expect(result.recommended.mode).toBe("context_shortlist");
    expect(result.recommended.planningFit).toBeNull();
    expect(result.recommended.contextReason).toBe("INFLUENCE_PROFILE_INCOMPATIBLE");
  });

  it("treats a compatible all-zero serviceability profile as a valid zero", () => {
    const zeroServiceability = structuredClone(frozenLagosBundle);
    for (const member of zeroServiceability.panel.filter((item) => item.sector === "fmcg")) {
      member.serviceability = 0;
    }
    const result = optimizePackage(zeroServiceability, { ...brief, objective: "near_conversion" });
    expect(result.recommended.mode).toBe("planning_fit");
    expect(result.recommended.deliveryRaw).toBe(0);
  });

  it("rejects a missing influence source even when qi values are positive", () => {
    const missingSource = structuredClone(frozenLagosBundle);
    missingSource.sourceManifest = missingSource.sourceManifest.filter(
      (source) => source.id !== "synthetic-fmcg-influence-v1",
    );
    const result = optimizePackage(missingSource, { ...brief, objective: "influential_core" });
    expect(result.recommended.mode).toBe("context_shortlist");
    expect(result.recommended.contextReason).toBe("INFLUENCE_PROFILE_INCOMPATIBLE");
  });

  it("rejects serviceability whose product period does not cover the flight", () => {
    const expired = structuredClone(frozenLagosBundle);
    const source = expired.sourceManifest.find(
      (item) => item.id === "synthetic-fmcg-serviceability-v1",
    )!;
    source.periodEnd = "2026-08-31";
    const result = optimizePackage(expired, { ...brief, objective: "near_conversion" });
    expect(result.recommended.mode).toBe("context_shortlist");
    expect(result.recommended.planningFit).toBeNull();
    expect(result.recommended.contextReason).toBe("SERVICEABILITY_PROFILE_INCOMPATIBLE");
  });

  it("returns a target-basis context shortlist when allocation provenance is incompatible", () => {
    const incompatible = structuredClone(frozenLagosBundle);
    const source = incompatible.sourceManifest.find(
      (item) => item.id === incompatible.targetAllocationSourceIds.fmcg,
    )!;
    source.periodEnd = "2026-08-31";
    const result = optimizePackage(incompatible, brief);
    expect(result.measurement!.claim.kind).toBe("general_ots");
    expect(result.recommended.mode).toBe("context_shortlist");
    expect(result.recommended.contextReason).toBe("TARGET_BASIS_INCOMPATIBLE");
  });

  it("filters out an unavailable face and types an explicit selected override", () => {
    const candidate = structuredClone(frozenLagosBundle);
    const unavailable = candidate.sites.at(-1)!;
    unavailable.deliverySchedule.availabilityEnd = "2026-08-31";
    const ranked = optimizePackage(candidate, brief);
    expect(ranked.recommended.siteIds).not.toContain(unavailable.id);

    const selected = [
      unavailable.id,
      ...ranked.recommended.siteIds.filter((siteId) => siteId !== unavailable.id).slice(0, 2),
    ];
    const override = optimizePackage(candidate, brief, selected);
    expect(override.recommended.valid).toBe(false);
    expect(override.recommended.invalidReasonCodes)
      .toContain("SITE_UNAVAILABLE_FOR_FLIGHT");
    expect(override.measurement!.claim.kind).toBe("movement");
  });

  it("returns a repairable invalid candidate when every face is outside the flight", () => {
    const candidate = structuredClone(frozenLagosBundle);
    for (const site of candidate.sites) {
      site.deliverySchedule.availabilityEnd = "2026-08-31";
    }
    const result = optimizePackage(candidate, brief);
    expect(result.recommended.valid).toBe(false);
    expect(result.recommended.invalidReasonCodes)
      .toContain("SITE_UNAVAILABLE_FOR_FLIGHT");
    expect(result.measurement!.claim.kind).toBe("movement");
  });

  it("suppresses Planning Fit when Recommendation Evidence is unavailable", () => {
    const candidate = structuredClone(frozenLagosBundle);
    candidate.evidenceProfiles.recommendation.hasZeroCritical = true;
    const result = optimizePackage(candidate, brief);
    expect(result.recommended.mode).toBe("context_shortlist");
    expect(result.recommended.planningFit).toBeNull();
    expect(result.recommended.evidenceScore).toBe(0);
    expect(result.recommended.evidenceGrade).toBe("unavailable");
    expect(result.recommended.contextReason)
      .toBe("RECOMMENDATION_EVIDENCE_UNAVAILABLE");
  });
});
