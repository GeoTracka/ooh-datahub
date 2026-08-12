import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { PlannerState } from "@/application/plannerReducer";
import type { EstimatePackageResult, ScenarioMeasurement } from "@/contracts/metrics";
import type { DrawerTarget, MapLens, SpatialFeature } from "@/contracts/renderer";
import { activityPotential } from "@/planning/activityPotential";
import {
  applyResolvedAudience,
  resolveBriefAudience,
} from "@/planning/briefNormalization";
import { estimatePackage } from "@/planning/engine";
import { PUBLIC_COPY, confidenceLabel } from "@/content/plainLanguage";

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

type ZoneCardView = {
  rank: number;
  zoneId: string;
  label: string;
  siteIds: string[];
  sites: Array<{ id: string; label: string }>;
  activityPotential: number | null;
  marginalReach: number | null;
  marginalInfluencePoints: number | null;
  marginalInfluenceMass: number | null;
  marginalServiceableReach: number | null;
  role: string;
};

const zoneCardCache = new WeakMap<Plan, ZoneCardView[]>();

function resolvedPlanningBundle(bundle: FrozenBundle, plan: Plan): FrozenBundle {
  return applyResolvedAudience(
    bundle,
    plan.brief.sector,
    resolveBriefAudience(bundle, plan.brief),
  );
}

function objectiveDeliveryDefinition(plan: Plan) {
  if (plan.brief.objective === "influential_core") {
    return {
      label: PUBLIC_COPY.metrics.priorityAudienceReach,
      unit: "influence_weighted_people" as const,
      value: (scenario: Scenario) => scenario.influenceMass,
    };
  }
  if (plan.brief.objective === "near_conversion") {
    return {
      label: PUBLIC_COPY.metrics.likelyCustomerReach,
      unit: "people" as const,
      value: (scenario: Scenario) => scenario.serviceableReach,
    };
  }
  return {
    label: PUBLIC_COPY.metrics.estimatedReach,
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
      ? "Audience delivery is shown side by side because the campaign settings changed."
      : "Expected audience delivery " + direction(eligibleDelivery!) +
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

export function selectZoneCards(bundle: FrozenBundle, state: PlannerState): ZoneCardView[] {
  const plan = selectVisiblePlan(state);
  if (!plan || !plan.measurement) return [];
  const cached = zoneCardCache.get(plan);
  if (cached) return cached;

  const planningBundle = resolvedPlanningBundle(bundle, plan);
  const measurement: EstimatePackageResult = plan.measurement;
  const baseScenario = measurement.scenarios.find((item) => item.id === "base")!;
  const reachEligible = ["scenario_target_reach", "calibrated_target_reach"]
    .includes(measurement.claim.kind);
  const influenceEligible = measurement.influence !== null;
  const cards = plan.selectedZoneIds.map((zoneId, index) => {
    const withoutZone = plan.recommended.siteIds.filter((siteId) => {
      return bundle.sites.find((site) => site.id === siteId)?.zoneId !== zoneId;
    });
    const reduced = estimatePackage(planningBundle, {
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
      role: index === 0
        ? PUBLIC_COPY.areas.primary
        : index === 1
          ? PUBLIC_COPY.areas.supporting
          : PUBLIC_COPY.areas.additional,
    };
  });
  zoneCardCache.set(plan, cards);
  return cards;
}

export function selectLensFeatures(
  bundle: FrozenBundle,
  state: PlannerState,
  lens: MapLens,
): SpatialFeature[] {
  const plan = selectVisiblePlan(state);
  if (!plan || !plan.measurement) return [];
  const zoneFeatures = selectZoneCards(bundle, state).map((card) => {
    const zone = bundle.zones.find((item) => item.id === card.zoneId)!;
    const metric = lens === "plan"
      ? { label: "Recommendation rank", value: card.rank, unit: "rank" as const }
      : lens === "activity"
        ? { label: PUBLIC_COPY.metrics.areaActivity, value: card.activityPotential, unit: "index_0_100" as const }
        : lens === "influence"
          ? { label: PUBLIC_COPY.metrics.additionalPriorityReach, value: card.marginalInfluenceMass, unit: "people" as const }
          : plan.brief.objective === "near_conversion"
            ? { label: PUBLIC_COPY.metrics.additionalLikelyCustomerReach, value: card.marginalServiceableReach, unit: "people" as const }
            : { label: PUBLIC_COPY.metrics.additionalReach, value: card.marginalReach, unit: "people" as const };
    return {
      id: card.zoneId,
      coordinateField: {
        value: { longitude: zone.center[0], latitude: zone.center[1] },
        policy: {
          sourceProduct: "synthetic" as const,
          sourceField: "zones.center",
          contentClass: "CUSTOMER_VALUE" as const,
          allowedPurposes: ["LIVE_DISPLAY_CONTEXT" as const],
          displaySurfaces: ["MAPLIBRE" as const],
          persistence: { kind: "NEVER" as const },
          policyVersion: "2026-08-03",
          receivedAt: bundle.manifest.createdAt,
        },
      },
      visual: {
        label: card.label,
        metricLabel: metric.label,
        value: metric.value,
        unit: metric.unit,
        evidenceLabel: confidenceLabel(plan.measurement!.claim.evidence),
      },
    } satisfies SpatialFeature;
  });

  if (lens !== "plan" || !plan.contextRevision) return zoneFeatures;
  const contextFeatures: SpatialFeature[] = plan.contextRevision.selectedRows.flatMap((row) => {
    if (!row.coordinate || row.coordinate.provider !== "customer") return [];
    return [{
      id: "context/" + row.rowId,
      coordinateField: {
        value: {
          longitude: row.coordinate.value[0],
          latitude: row.coordinate.value[1],
        },
        policy: {
          sourceProduct: "customer" as const,
          sourceField: row.coordinate.sourceArtifactId,
          contentClass: "CUSTOMER_INPUT" as const,
          allowedPurposes: ["LIVE_DISPLAY_CONTEXT" as const],
          displaySurfaces: ["MAPLIBRE" as const],
          persistence: {
            kind: "CUSTOMER_POLICY" as const,
            policyId: row.coordinate.license,
          },
          legalApprovalId: row.coordinate.license,
          policyVersion: "upload-context-v1",
          receivedAt: bundle.manifest.createdAt,
        },
      },
      visual: {
        label: row.address ?? row.assetId,
        metricLabel: "Uploaded inventory · comparison only",
        value: null,
        unit: "none" as const,
        evidenceLabel: "Audience estimate not available",
      },
    }];
  });
  return [...zoneFeatures, ...contextFeatures];
}

export function selectCausalDrawerViewModel(
  bundle: FrozenBundle,
  plan: NonNullable<PlannerState["appliedPlan"]>,
  target: DrawerTarget,
) {
  if (!plan.measurement) throw new Error("DRAWER_MEASUREMENT_UNAVAILABLE");
  if (target.kind === "site" && !plan.recommended.siteIds.includes(target.id)) {
    throw new Error("DRAWER_SITE_OUTSIDE_VISIBLE_PLAN");
  }
  if (target.kind === "zone" && !plan.selectedZoneIds.includes(target.id)) {
    throw new Error("DRAWER_ZONE_OUTSIDE_VISIBLE_PLAN");
  }
  if (
    target.kind === "evidence" &&
    !plan.recommended.siteIds.includes(target.siteId)
  ) {
    throw new Error("DRAWER_EVIDENCE_SITE_OUTSIDE_VISIBLE_PLAN");
  }
  const planningBundle = resolvedPlanningBundle(bundle, plan);
  const siteIds = target.kind === "package" || target.kind === "pillar"
    ? plan.recommended.siteIds
    : target.kind === "zone"
      ? plan.recommended.siteIds.filter((siteId) =>
          bundle.sites.find((site) => site.id === siteId)?.zoneId === target.id
        )
      : target.kind === "site"
        ? [target.id]
        : [target.siteId];
  const measurement = target.kind === "package" || target.kind === "pillar"
    ? plan.measurement
    : estimatePackage(planningBundle, {
        sector: plan.brief.sector,
        daypart: plan.brief.daypart,
        siteIds,
        flightStart: plan.brief.flightStart,
        flightEnd: plan.brief.flightEnd,
      });
  const label = target.kind === "package"
    ? "Recommended package"
    : target.kind === "pillar"
      ? target.id + " score area"
    : target.kind === "zone"
      ? bundle.zones.find((zone) => zone.id === target.id)?.label ?? target.id
      : target.kind === "site"
        ? bundle.sites.find((site) => site.id === target.id)?.label ?? target.id
        : "Source information";
  const sourceIds = [...new Set([
    ...measurement.claim.sourceIds,
    ...(measurement.influence?.sourceIds ?? []),
  ])].sort();
  const nextTargets: DrawerTarget[] = target.kind === "package"
    ? (["A", "D", "C", "P", "E"] as const).map((id) => ({
        kind: "pillar" as const,
        id,
        metric: target.metric,
      }))
    : target.kind === "pillar"
      ? target.id === "D"
        ? plan.selectedZoneIds.map((id) => ({
            kind: "zone" as const,
            id,
            metric: target.metric,
          }))
        : []
      : target.kind === "zone"
        ? siteIds.map((id) => ({
            kind: "site" as const,
            id,
            metric: target.metric,
          }))
        : target.kind === "site"
          ? sourceIds.map((id) => ({
              kind: "evidence" as const,
              id,
              siteId: target.id,
              metric: target.metric,
            }))
          : [];
  return {
    target,
    label,
    measurement,
    siteIds,
    nextTargets,
    sourceRecord: target.kind === "evidence"
      ? bundle.sourceManifest.find((source) => source.id === target.id) ?? null
      : null,
    scopeNote: target.kind === "package"
      ? "How this package's audience estimate was built"
      : target.kind === "pillar"
        ? target.id === "D"
          ? "Delivery score area; this is the only score area used in the audience estimate"
          : "Package score area; it helps rank options but does not change the audience estimate"
        : target.kind === "evidence"
          ? "Source record used for this media location"
          : "Estimate recalculated for this selection using the same dates and audience settings",
  };
}
