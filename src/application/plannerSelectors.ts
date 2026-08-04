import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { PlannerState } from "@/application/plannerReducer";
import type { EstimatePackageResult, ScenarioMeasurement } from "@/contracts/metrics";
import { activityPotential } from "@/planning/activityPotential";
import { estimatePackage } from "@/planning/engine";

export function selectVisiblePlan(state: PlannerState) {
  return state.draftPlan ?? state.appliedPlan;
}

export function selectRfqBasis(state: PlannerState) {
  return state.appliedPlan;
}

export function selectIsDirty(state: PlannerState): boolean {
  return state.draftPlan !== null;
}

type Plan = NonNullable<PlannerState["appliedPlan"]>;
type Scenario = ScenarioMeasurement;

function objectiveDeliveryDefinition(plan: Plan) {
  if (plan.brief.objective === "influential_core") {
    return {
      label: "Influence-weighted reached mass",
      unit: "influence_weighted_people" as const,
      value: (scenario: Scenario) => scenario.influenceMass,
    };
  }
  if (plan.brief.objective === "near_conversion") {
    return {
      label: "Serviceable target reach",
      unit: "people" as const,
      value: (scenario: Scenario) => scenario.serviceableReach,
    };
  }
  return {
    label: "Target reach",
    unit: "people" as const,
    value: (scenario: Scenario) => scenario.reach,
  };
}

function deliveryRange(plan: Plan) {
  if (!plan.measurement) return null;
  const definition = objectiveDeliveryDefinition(plan);
  const low = plan.measurement.scenarios.find((item) => item.id === "low");
  const base = plan.measurement.scenarios.find((item) => item.id === "base");
  const high = plan.measurement.scenarios.find((item) => item.id === "high");
  if (!low || !base || !high) return null;
  const values = [definition.value(low), definition.value(base), definition.value(high)];
  return values.some((value) => value === null)
    ? null
    : { low: values[0]!, base: values[1]!, high: values[2]! };
}

function changedIds(left: string[], right: string[]): string[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [...new Set([
    ...left.filter((id) => !rightSet.has(id)),
    ...right.filter((id) => !leftSet.has(id)),
  ])].sort();
}

function planSummary(plan: Plan) {
  const delivery = objectiveDeliveryDefinition(plan);
  return {
    planningFit: plan.recommended.planningFit,
    evidenceScore: plan.recommended.evidenceScore,
    evidenceGrade: plan.recommended.evidenceGrade,
    costNgn: plan.recommended.costNgn,
    siteIds: [...plan.recommended.siteIds],
    zoneIds: [...plan.selectedZoneIds],
    deliveryLabel: delivery.label,
    deliveryUnit: delivery.unit,
    deliveryRange: deliveryRange(plan),
    dataRevision: plan.dataRevision,
    fingerprint: plan.measurement?.fingerprint ?? null,
    comparabilityKey: plan.measurement?.comparabilityKey ?? null,
  };
}

function direction(value: number): string {
  return value > 0 ? "increases" : value < 0 ? "decreases" : "is unchanged";
}

function delta(from: Plan, to: Plan, action: string) {
  const definition = objectiveDeliveryDefinition(to);
  const comparable = from.brief.objective === to.brief.objective &&
    (from.measurement?.comparabilityKey ?? null) === (to.measurement?.comparabilityKey ?? null);
  const fromRange = deliveryRange(from);
  const toRange = deliveryRange(to);
  const reasonCode = !comparable
    ? "INCOMPARABLE_DELIVERY_BASIS"
    : !fromRange || !toRange
      ? "OBJECTIVE_DELIVERY_UNAVAILABLE"
      : null;
  const pillarKeys = ["A", "D", "C", "P", "E"] as const;
  const affectedPillars = pillarKeys.filter((pillar) =>
    from.recommended.pillars?.[pillar] !== to.recommended.pillars?.[pillar]
  );
  const costNgn = to.recommended.costNgn - from.recommended.costNgn;
  const eligibleDelivery = reasonCode === null
    ? toRange!.base - fromRange!.base
    : null;
  return {
    action,
    comparable,
    reasonCode,
    deliveryLabel: definition.label,
    deliveryUnit: definition.unit,
    from: planSummary(from),
    to: planSummary(to),
    costNgn,
    planningFit: from.recommended.planningFit === null || to.recommended.planningFit === null
      ? null
      : to.recommended.planningFit - from.recommended.planningFit,
    evidenceScore: to.recommended.evidenceScore - from.recommended.evidenceScore,
    eligibleDelivery,
    changedSiteIds: changedIds(from.recommended.siteIds, to.recommended.siteIds),
    changedZoneIds: changedIds(from.selectedZoneIds, to.selectedZoneIds),
    affectedPillars,
    tradeOff: reasonCode
      ? "Delivery is shown side by side and not subtracted because the basis changed."
      : "Base delivery " + direction(eligibleDelivery!) +
        " while cost " + direction(costNgn) + ".",
  };
}

export function selectPlanDeltas(state: PlannerState) {
  const visible = selectVisiblePlan(state);
  if (!visible || !state.appliedPlan || !state.originalPlan) return null;
  if (!visible.measurement || !state.appliedPlan.measurement ||
    !state.originalPlan.measurement) return null;
  const action = state.lastAction ?? "Plan adjustment";
  return {
    currentToDraft: delta(state.appliedPlan, visible, action),
    originalToDraft: delta(state.originalPlan, visible, action),
  };
}

export function selectZoneCards(bundle: FrozenBundle, state: PlannerState) {
  const plan = selectVisiblePlan(state);
  if (!plan || !plan.measurement) return [];
  const measurement: EstimatePackageResult = plan.measurement;
  const baseScenario = measurement.scenarios.find((item) => item.id === "base")!;
  const reachEligible = ["scenario_target_reach", "calibrated_target_reach"]
    .includes(measurement.claim.kind);
  const influenceEligible = measurement.influence !== null;
  return plan.selectedZoneIds.map((zoneId, index) => {
    const withoutZone = plan.recommended.siteIds.filter((siteId) => {
      return bundle.sites.find((site) => site.id === siteId)?.zoneId !== zoneId;
    });
    const reduced = estimatePackage(bundle, {
      sector: plan.brief.sector,
      daypart: plan.brief.daypart,
      siteIds: withoutZone,
      flightStart: plan.brief.flightStart,
      flightEnd: plan.brief.flightEnd,
    });
    const reducedBase = reduced.scenarios.find((item) => item.id === "base")!;
    const zoneSites = bundle.sites.filter((site) =>
      site.zoneId === zoneId && plan.recommended.siteIds.includes(site.id),
    );
    const zoneMovement = zoneSites.reduce(
      (sum, site) => sum + site.baseMovement[plan.brief.daypart],
      0,
    ) / zoneSites.length;
    return {
      rank: index + 1,
      zoneId,
      label: bundle.zones.find((zone) => zone.id === zoneId)!.label,
      siteIds: plan.recommended.siteIds.filter(
        (siteId) => bundle.sites.find((site) => site.id === siteId)?.zoneId === zoneId,
      ),
      sites: plan.recommended.siteIds
        .map((siteId) => bundle.sites.find((site) => site.id === siteId)!)
        .filter((site) => site.zoneId === zoneId)
        .map((site) => ({ id: site.id, label: site.label })),
      activityPotential: activityPotential(
        zoneMovement,
        bundle.activityCohort.map((location) => location.value),
      ),
      marginalReach: !reachEligible || baseScenario.reach === null || reducedBase.reach === null
        ? null
        : Math.max(0, baseScenario.reach - reducedBase.reach),
      marginalInfluencePoints:
        !influenceEligible ||
        baseScenario.influenceCapture === null || reducedBase.influenceCapture === null
          ? null
          : Math.max(0, baseScenario.influenceCapture - reducedBase.influenceCapture),
      marginalInfluenceMass:
        !influenceEligible ||
        baseScenario.influenceMass === null || reducedBase.influenceMass === null
          ? null
          : Math.max(0, baseScenario.influenceMass - reducedBase.influenceMass),
      marginalServiceableReach:
        !reachEligible ||
        baseScenario.serviceableReach === null || reducedBase.serviceableReach === null
          ? null
          : Math.max(0, baseScenario.serviceableReach - reducedBase.serviceableReach),
      role: index === 0 ? "Lead delivery zone" : index === 1 ? "Complementary audience zone" : "Coverage balance zone",
    };
  });
}
