import { describe, expect, it } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { estimatePackage } from "@/planning/engine";
import {
  applyUploadContextToPlan,
  buildPlan,
  promoteAlternativeZone,
  recalculatePlan,
  recalculateSelectedSites,
} from "@/application/plannerService";
import { initialPlannerState, plannerReducer } from "@/application/plannerReducer";
import {
  selectPlanDeltas,
  selectZoneCards,
} from "@/application/plannerSelectors";

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

describe("plannerReducer", () => {
  it("previews a package option without adding fine-tune history", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: applied });
    const alternative = applied.packageOptions[1].candidate;
    const preview = recalculateSelectedSites(
      frozenLagosBundle,
      applied,
      alternative.siteIds,
    );
    const selected = plannerReducer(loaded, { type: "package-previewed", plan: preview });
    expect(selected.draftPlan?.recommended.id).toBe(alternative.id);
    expect(selected.draftHistory).toEqual([]);
    expect(selected.lastAction).toBe("Package option selected");
    expect(selected.status).toBe("dirty");
  });

  it("preserves existing fine-tune history while previewing a package option", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: applied });
    const firstDraft = { ...applied, contextRevision: "context-1" };
    const secondDraft = { ...applied, contextRevision: "context-2" };
    const drafted = {
      ...loaded,
      draftPlan: secondDraft,
      draftHistory: [firstDraft],
      status: "dirty" as const,
    };

    const previewed = plannerReducer(drafted, { type: "package-previewed", plan: firstDraft });

    expect(previewed.draftHistory).toEqual(drafted.draftHistory);
  });

  it("clears an alternative preview when the applied package is selected", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: applied });
    const alternative = applied.packageOptions[1].candidate;
    const preview = recalculateSelectedSites(
      frozenLagosBundle,
      applied,
      alternative.siteIds,
    );
    const dirty = plannerReducer(loaded, { type: "package-previewed", plan: preview });
    const cleared = plannerReducer(dirty, { type: "package-previewed", plan: null });
    expect(cleared.draftPlan).toBeNull();
    expect(cleared.draftHistory).toEqual([]);
    expect(cleared.lastAction).toBeNull();
    expect(cleared.status).toBe("loaded");
  });

  it("keeps the RFQ basis on the applied plan until Apply", { timeout: 30_000 }, () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: applied });
    const draft = recalculatePlan(frozenLagosBundle, applied, { budgetNgn: 20_000_000 });
    const dirty = plannerReducer(loaded, { type: "drafted", plan: draft });
    expect(dirty.appliedPlan?.recommended.id).toBe(applied.recommended.id);
    expect(dirty.draftPlan?.brief.budgetNgn).toBe(20_000_000);
    const committed = plannerReducer(dirty, { type: "applied" });
    expect(committed.appliedPlan?.brief.budgetNgn).toBe(20_000_000);
    expect(committed.draftPlan).toBeNull();
  });

  it("routes uploaded context through the same draft, Undo, and Apply lifecycle", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
    const uploaded = applyUploadContextToPlan(frozenLagosBundle, original, {
      mode: "context_shortlist",
      decisionUse: "context_only",
      selectedRowIds: ["UP-001"],
      selectedRows: [{
        rowId: "UP-001",
        assetId: "YB-001",
        supplier: "Demo Media",
        address: "Herbert Macaulay Way Yaba",
        format: "Static",
        rateNgn: 3_200_000,
        coordinate: null,
      }],
      enrichmentSnapshotId: "snapshot-upload-1",
      dataRevision: "upload-context-v1",
      fingerprint: "upload-fingerprint-1",
      claimResolution: {
        highest: "context",
        influenceEligible: false,
        evidenceCap: "D",
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
        recoveryAction: "Provide a feature-compatible calibration bundle",
      },
      planningFit: null,
    });
    const dirty = plannerReducer(loaded, {
      type: "drafted",
      plan: uploaded,
      reason: "Apply uploaded context · upload-context-v1",
    });
    expect(dirty.appliedPlan).toBe(original);
    expect(dirty.draftPlan?.contextRevision?.dataRevision).toBe("upload-context-v1");
    expect(plannerReducer(dirty, { type: "undo" }).draftPlan).toBeNull();
    const applied = plannerReducer(dirty, { type: "applied" });
    expect(applied.originalPlan).toBe(original);
    expect(applied.appliedPlan?.contextRevision?.enrichmentSnapshotId)
      .toBe("snapshot-upload-1");
  });

  it("allows a commercially valid claim-degraded draft to apply", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const degraded = {
      ...applied,
      recommended: {
        ...applied.recommended,
        planningFit: null,
        pillars: null,
        mode: "context_shortlist" as const,
        valid: true,
      },
    };
    const state = {
      ...initialPlannerState,
      appliedPlan: applied,
      draftPlan: degraded,
    };
    expect(plannerReducer(state, { type: "applied" }).appliedPlan?.recommended.mode)
      .toBe("context_shortlist");
  });

  it("blocks a package-invalid draft", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const invalid = {
      ...applied,
      recommended: { ...applied.recommended, valid: false },
    };
    const state = {
      ...initialPlannerState,
      appliedPlan: applied,
      draftPlan: invalid,
    };
    expect(() => plannerReducer(state, { type: "applied" }))
      .toThrow("PACKAGE_INVALID");
  });

  it("preserves the immutable original and resets back to it after Apply", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
    const changed = recalculatePlan(frozenLagosBundle, original, { budgetNgn: 20_000_000 });
    const applied = plannerReducer(
      plannerReducer(loaded, { type: "drafted", plan: changed }),
      { type: "applied" },
    );
    const reset = plannerReducer(applied, { type: "reset" });
    expect(reset.originalPlan).toBe(original);
    expect(reset.appliedPlan).toBe(changed);
    expect(reset.draftPlan).toBe(original);
    expect(plannerReducer(reset, { type: "applied" }).appliedPlan).toBe(original);
  });

  it.each([
    ["broad_reach", "Target reach"],
    ["influential_core", "Influence-weighted reached mass"],
    ["near_conversion", "Serviceable target reach"],
  ] as const)("reports objective-specific comparable deltas for %s", (objective, label) => {
    const original = buildPlan(frozenLagosBundle, { ...brief, objective });
    const draft = recalculatePlan(frozenLagosBundle, original, { budgetNgn: 20_000_000 });
    const deltas = selectPlanDeltas({
      ...initialPlannerState,
      originalPlan: original,
      appliedPlan: original,
      draftPlan: draft,
      status: "dirty",
    })!;
    expect(deltas.currentToDraft.deliveryLabel).toBe(label);
    expect(deltas.currentToDraft.reasonCode).toBeNull();
    expect(deltas.currentToDraft.eligibleDelivery).toBe(
      draft.recommended.deliveryRaw! - original.recommended.deliveryRaw!,
    );
  });

  it("refuses a numeric delta across objective or comparability changes", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const changedObjective = recalculatePlan(frozenLagosBundle, original, {
      objective: "influential_core",
    });
    const deltas = selectPlanDeltas({
      ...initialPlannerState,
      originalPlan: original,
      appliedPlan: original,
      draftPlan: changedObjective,
      status: "dirty",
    })!;
    expect(deltas.currentToDraft.eligibleDelivery).toBeNull();
    expect(deltas.currentToDraft.reasonCode).toBe("INCOMPARABLE_DELIVERY_BASIS");
  });

  it("uses influence mass, not Capture percentage points, for influential zone delivery", () => {
    const plan = buildPlan(frozenLagosBundle, {
      ...brief,
      objective: "influential_core",
    });
    const state = plannerReducer(initialPlannerState, { type: "loaded", plan });
    const first = selectZoneCards(frozenLagosBundle, state)[0];
    const reduced = estimatePackage(frozenLagosBundle, {
      sector: plan.brief.sector,
      daypart: plan.brief.daypart,
      flightStart: plan.brief.flightStart,
      flightEnd: plan.brief.flightEnd,
      siteIds: plan.recommended.siteIds.filter((siteId) =>
        frozenLagosBundle.sites.find((site) => site.id === siteId)?.zoneId !== first.zoneId
      ),
    });
    const base = plan.measurement!.scenarios.find((item) => item.id === "base")!;
    const reducedBase = reduced.scenarios.find((item) => item.id === "base")!;
    expect(first.marginalInfluenceMass).toBeCloseTo(
      base.influenceMass! - reducedBase.influenceMass!,
      8,
    );
  });

  it("recomputes include, remove, and same-zone swap from selected site IDs", { timeout: 60_000 }, () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const selected = applied.recommended.siteIds;
    const first = frozenLagosBundle.sites.find((site) => site.id === selected[0])!;
    const sameZoneAlternative = frozenLagosBundle.sites.find(
      (site) => site.zoneId === first.zoneId && !selected.includes(site.id),
    )!;
    const outside = frozenLagosBundle.sites.find(
      (site) => !selected.includes(site.id) &&
        applied.selectedZoneIds.includes(site.zoneId),
    )!;

    const cases = [
      [...selected, outside.id],
      selected.slice(0, -1),
      [sameZoneAlternative.id, ...selected.slice(1)],
    ];

    for (const siteIds of cases) {
      const draft = recalculateSelectedSites(frozenLagosBundle, applied, siteIds);
      expect(draft.measurement!.fingerprint).not.toBe(applied.measurement!.fingerprint);
      expect(draft.recommended.estimateFingerprint).toBe(draft.measurement!.fingerprint);
    }
  });

  it("excludes a zone and promotes a deterministic alternative zone", { timeout: 120_000 }, () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const excluded = applied.selectedZoneIds[0];
    const draft = promoteAlternativeZone(frozenLagosBundle, applied, excluded);
    expect(draft.selectedZoneIds).toHaveLength(3);
    expect(draft.selectedZoneIds).not.toContain(excluded);
    expect(draft.measurement!.fingerprint).not.toBe(applied.measurement!.fingerprint);
  });

  it("atomically applies a valid draft and enters RFQ without replacing original", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
    const draft = recalculatePlan(frozenLagosBundle, original, { daypart: "evening" });
    const dirty = plannerReducer(loaded, { type: "drafted", plan: draft });
    const rfq = plannerReducer(dirty, { type: "apply-and-review-rfq" });
    expect(rfq).toMatchObject({
      originalPlan: original,
      appliedPlan: draft,
      draftPlan: null,
      draftHistory: [],
      status: "rfq",
    });
  });

  it("rejects direct dirty or invalid review and closes a valid RFQ to loaded", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
    const draft = recalculatePlan(frozenLagosBundle, original, { daypart: "evening" });
    const dirty = plannerReducer(loaded, { type: "drafted", plan: draft });
    expect(() => plannerReducer(dirty, { type: "review-rfq" }))
      .toThrow("APPLY_DRAFT_BEFORE_RFQ");
    const invalid = {
      ...loaded,
      appliedPlan: {
        ...original,
        recommended: { ...original.recommended, valid: false },
      },
    };
    expect(() => plannerReducer(invalid, { type: "review-rfq" }))
      .toThrow("PACKAGE_INVALID");
    const review = plannerReducer(loaded, { type: "review-rfq" });
    expect(plannerReducer(review, { type: "close-rfq" }).status).toBe("loaded");
  });

  it("turns changed RFQ dates into a recomputed dirty schedule revision", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const review = plannerReducer(
      plannerReducer(initialPlannerState, { type: "loaded", plan: original }),
      { type: "review-rfq" },
    );
    const revised = recalculatePlan(frozenLagosBundle, original, {
      flightStart: "2026-09-08",
    });
    const dirty = plannerReducer(review, {
      type: "close-rfq-with-draft",
      plan: revised,
    });
    expect(dirty.status).toBe("dirty");
    expect(dirty.appliedPlan).toBe(original);
    expect(dirty.draftPlan).toBe(revised);
    expect(revised.measurement!.fingerprint).not.toBe(original.measurement!.fingerprint);
  });
});
