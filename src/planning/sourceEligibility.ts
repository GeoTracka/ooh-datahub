import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Sector } from "@/contracts/domain";

export type DeliveryScope = {
  sector: Sector;
  flightStart: string;
  flightEnd: string;
};

export function compatibleSource(
  bundle: FrozenBundle,
  sourceId: string,
  kind: "target_universe" | "target_allocation" | "influence" | "serviceability",
  scope: DeliveryScope,
): boolean {
  const source = bundle.sourceManifest.find((item) => item.id === sourceId);
  return Boolean(
    source &&
    source.kind === kind &&
    source.sector === scope.sector &&
    source.geographyId === bundle.manifest.geographyId &&
    source.productScope === scope.sector &&
    source.periodStart <= scope.flightStart &&
    source.periodEnd >= scope.flightEnd,
  );
}

export function targetProfileSourceIds(
  bundle: FrozenBundle,
  sector: Sector,
  field: "qiSourceId" | "serviceabilitySourceId",
): string[] {
  return [...new Set(bundle.targets
    .filter((target) => target.sector === sector)
    .map((target) => target[field]))].sort();
}

export function targetUniverseInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  const targets = bundle.targets.filter((target) => target.sector === scope.sector);
  return targets.length > 0 && targets.every((target) => compatibleSource(
    bundle, target.universeSourceId, "target_universe", scope,
  ));
}

export function targetAllocationInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  return compatibleSource(
    bundle,
    bundle.targetAllocationSourceIds[scope.sector],
    "target_allocation",
    scope,
  );
}

export function reachInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  return targetUniverseInputsCompatible(bundle, scope) &&
    targetAllocationInputsCompatible(bundle, scope);
}

export function serviceabilityInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  const targets = bundle.targets.filter((target) => target.sector === scope.sector);
  const sourceIds = targetProfileSourceIds(bundle, scope.sector, "serviceabilitySourceId");
  return targets.length > 0 && sourceIds.length === 1 && targets.every((target) =>
    compatibleSource(bundle, target.serviceabilitySourceId, "serviceability", scope)
  );
}

export function influenceInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  const targets = bundle.targets.filter((target) => target.sector === scope.sector);
  const sourceIds = targetProfileSourceIds(bundle, scope.sector, "qiSourceId");
  const denominator = bundle.panel
    .filter((member) => member.sector === scope.sector)
    .reduce((sum, member) => sum + member.weight * member.qi, 0);
  return targets.length > 0 && sourceIds.length === 1 &&
    targets.every((target) => compatibleSource(
      bundle, target.qiSourceId, "influence", scope,
    )) &&
    denominator > 0 &&
    bundle.manifest.influenceLinkageAssumptionId.length > 0 &&
    bundle.manifest.influenceSensitivityId.length > 0;
}
