import type { FrozenBundle } from "@/bundle/bundleSchema";
import type {
  Brief,
  PlanContextRevision,
  PlanningResult,
} from "@/contracts/domain";
import {
  applyResolvedAudience,
  resolveBriefAudience,
} from "@/planning/briefNormalization";
import { estimatePackage } from "@/planning/engine";
import { siteDeliveryCompatible } from "@/planning/movement";
import {
  comparePackageCandidates,
  optimizePackage,
} from "@/planning/packageOptimizer";

export function buildPlan(bundle: FrozenBundle, brief: Brief): PlanningResult {
  return optimizePackage(bundle, brief);
}

export function applyUploadContextToPlan(
  bundle: FrozenBundle,
  basis: PlanningResult,
  contextRevision: PlanContextRevision,
): PlanningResult {
  const resolvedAudience = resolveBriefAudience(bundle, basis.brief);
  const planningBundle = applyResolvedAudience(
    bundle,
    basis.brief.sector,
    resolvedAudience,
  );
  const measurement = estimatePackage(planningBundle, {
    sector: basis.brief.sector,
    daypart: basis.brief.daypart,
    siteIds: basis.recommended.siteIds,
    flightStart: basis.brief.flightStart,
    flightEnd: basis.brief.flightEnd,
  });
  return {
    ...basis,
    recommended: {
      ...basis.recommended,
      estimateFingerprint: measurement.fingerprint,
    },
    measurement,
    replay: measurement.replay,
    dataRevision: contextRevision.dataRevision,
    contextRevision,
  };
}

export function recalculatePlan(
  bundle: FrozenBundle,
  basis: PlanningResult,
  change: Partial<Brief>,
): PlanningResult {
  const next = optimizePackage(bundle, { ...basis.brief, ...change });
  return basis.contextRevision
    ? applyUploadContextToPlan(bundle, next, basis.contextRevision)
    : next;
}

export function recalculateSelectedSites(
  bundle: FrozenBundle,
  basis: PlanningResult,
  selectedSiteIds: string[],
): PlanningResult {
  const next = optimizePackage(bundle, basis.brief, selectedSiteIds);
  return basis.contextRevision
    ? applyUploadContextToPlan(bundle, next, basis.contextRevision)
    : next;
}

export function promoteAlternativeZone(
  bundle: FrozenBundle,
  basis: PlanningResult,
  excludedZoneId: string,
): PlanningResult {
  if (!basis.selectedZoneIds.includes(excludedZoneId)) {
    throw new Error("ZONE_NOT_IN_PACKAGE");
  }
  const keptSiteIds = basis.recommended.siteIds.filter((siteId) =>
    bundle.sites.find((site) => site.id === siteId)?.zoneId !== excludedZoneId
  );
  const outsideSites = bundle.sites
    .filter((site) =>
      siteDeliveryCompatible(site, basis.brief.flightStart, basis.brief.flightEnd) &&
      !basis.selectedZoneIds.includes(site.zoneId)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  if (outsideSites.length === 0) throw new Error("NO_ALTERNATIVE_ZONE");
  return outsideSites
    .map((site) => recalculateSelectedSites(bundle, basis, [...keptSiteIds, site.id]))
    .sort((left, right) =>
      Number(right.recommended.valid) - Number(left.recommended.valid) ||
      comparePackageCandidates(left.recommended, right.recommended)
    )[0];
}
