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

export type AdjustmentSiteOption = {
  id: string;
  label: string;
  zoneId: string;
  zoneLabel: string;
  supplierId: string;
  rateNgn: number;
};

export type AdjustmentZoneOption = {
  id: string;
  label: string;
};

export type AdjustmentOptions = {
  selectedSites: AdjustmentSiteOption[];
  addableSites: AdjustmentSiteOption[];
  replacementSitesBySelectedSite: Record<string, AdjustmentSiteOption[]>;
  selectedZones: AdjustmentZoneOption[];
  alternativeZones: AdjustmentZoneOption[];
};

function siteOption(bundle: FrozenBundle, site: FrozenBundle["sites"][number]): AdjustmentSiteOption {
  return {
    id: site.id,
    label: site.label,
    zoneId: site.zoneId,
    zoneLabel: bundle.zones.find((zone) => zone.id === site.zoneId)?.label ?? site.zoneId,
    supplierId: site.supplierId,
    rateNgn: site.rateNgn,
  };
}

export function listAdjustmentOptions(
  bundle: FrozenBundle,
  basis: PlanningResult,
): AdjustmentOptions {
  const selectedIds = new Set(basis.recommended.siteIds);
  const selectedZones = new Set(basis.selectedZoneIds);
  const compatible = bundle.sites.filter((site) =>
    siteDeliveryCompatible(site, basis.brief.flightStart, basis.brief.flightEnd)
  );
  const selectedSites = basis.recommended.siteIds
    .map((id) => bundle.sites.find((site) => site.id === id))
    .filter((site): site is FrozenBundle["sites"][number] => Boolean(site))
    .map((site) => siteOption(bundle, site));
  const addableSites = compatible
    .filter((site) => selectedZones.has(site.zoneId) && !selectedIds.has(site.id))
    .sort((left, right) => left.zoneId.localeCompare(right.zoneId) || left.id.localeCompare(right.id))
    .map((site) => siteOption(bundle, site));
  const replacementSitesBySelectedSite = Object.fromEntries(
    selectedSites.map((selected) => [
      selected.id,
      compatible
        .filter((site) => site.zoneId === selected.zoneId && !selectedIds.has(site.id))
        .sort((left, right) => left.rateNgn - right.rateNgn || left.id.localeCompare(right.id))
        .map((site) => siteOption(bundle, site)),
    ]),
  );
  const currentZones = basis.selectedZoneIds.map((id) => ({
    id,
    label: bundle.zones.find((zone) => zone.id === id)?.label ?? id,
  }));
  const alternativeZoneIds = [...new Set(
    compatible
      .filter((site) => !selectedZones.has(site.zoneId))
      .map((site) => site.zoneId),
  )].sort();

  return {
    selectedSites,
    addableSites,
    replacementSitesBySelectedSite,
    selectedZones: currentZones,
    alternativeZones: alternativeZoneIds.map((id) => ({
      id,
      label: bundle.zones.find((zone) => zone.id === id)?.label ?? id,
    })),
  };
}

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

function bestPlanForTargetZone(
  bundle: FrozenBundle,
  basis: PlanningResult,
  excludedZoneId: string,
  targetZoneId: string,
): PlanningResult {
  if (!basis.selectedZoneIds.includes(excludedZoneId)) {
    throw new Error("ZONE_NOT_IN_PACKAGE");
  }
  if (basis.selectedZoneIds.includes(targetZoneId)) {
    throw new Error("ZONE_ALREADY_IN_PACKAGE");
  }
  const keptSiteIds = basis.recommended.siteIds.filter((siteId) =>
    bundle.sites.find((site) => site.id === siteId)?.zoneId !== excludedZoneId
  );
  const candidates = bundle.sites
    .filter((site) =>
      site.zoneId === targetZoneId &&
      siteDeliveryCompatible(site, basis.brief.flightStart, basis.brief.flightEnd)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length === 0) throw new Error("NO_ALTERNATIVE_ZONE");
  return candidates
    .map((site) => recalculateSelectedSites(bundle, basis, [...keptSiteIds, site.id]))
    .sort((left, right) =>
      Number(right.recommended.valid) - Number(left.recommended.valid) ||
      comparePackageCandidates(left.recommended, right.recommended)
    )[0];
}

export function replaceZoneWithZone(
  bundle: FrozenBundle,
  basis: PlanningResult,
  excludedZoneId: string,
  targetZoneId: string,
): PlanningResult {
  return bestPlanForTargetZone(bundle, basis, excludedZoneId, targetZoneId);
}

export function promoteAlternativeZone(
  bundle: FrozenBundle,
  basis: PlanningResult,
  excludedZoneId: string,
): PlanningResult {
  if (!basis.selectedZoneIds.includes(excludedZoneId)) {
    throw new Error("ZONE_NOT_IN_PACKAGE");
  }
  const targetZoneIds = listAdjustmentOptions(bundle, basis).alternativeZones.map((zone) => zone.id);
  if (targetZoneIds.length === 0) throw new Error("NO_ALTERNATIVE_ZONE");
  return targetZoneIds
    .map((targetZoneId) => bestPlanForTargetZone(bundle, basis, excludedZoneId, targetZoneId))
    .sort((left, right) =>
      Number(right.recommended.valid) - Number(left.recommended.valid) ||
      comparePackageCandidates(left.recommended, right.recommended)
    )[0];
}
