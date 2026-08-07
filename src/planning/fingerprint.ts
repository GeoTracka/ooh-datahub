import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";
import type { ExposureBlock } from "@/planning/movement";
import { canonicalJson } from "@/shared/canonicalJson";

function canonicalKey(namespace: string, value: unknown): string {
  // These keys are compared by full canonical equality. They are deliberately
  // not shortened to a collision-prone display hash.
  return namespace + "|" + canonicalJson(value);
}

export function exposurePlanFingerprint(
  bundle: FrozenBundle,
  request: {
    sector: Sector;
    daypart: Daypart;
    siteIds: string[];
    flightStart: string;
    flightEnd: string;
    flightDays: number;
    scheduleBlocks: ExposureBlock[];
    exposureThreshold: "1+";
  },
): string {
  // The demo favors exactness over compactness: full canonical bundle content plus
  // controls is the cache/RFQ identity. No shortened hash can collide. The UI only
  // shows a labelled prefix and exposes the complete value on demand.
  return canonicalKey("estimate-result-v2", {
    bundle,
    request: { ...request, siteIds: [...request.siteIds].sort() },
  });
}

export function reachComparabilityKey(input: {
  sector: string;
  geography: string;
  flightStart: string;
  flightEnd: string;
  basis: string;
  threshold: string;
  panelVersion: string;
  modelVersion: string;
  targetUniverseVersion: string;
  targetAllocationSourceId: string;
  featureSchemaCompatibilityId: string;
  replicateSetId: string;
  targetCellPartitionId: string;
  scheduleModelVersion: string;
  flightDays: number;
}): string {
  return canonicalKey("reach-comparability-v1", input);
}

export function objectiveDeliveryComparabilityKey(input: {
  reachComparabilityKey: string;
  objective: "broad_reach" | "influential_core" | "near_conversion";
  profileSourceIds: string[];
  assumptionIds: string[];
}): string {
  return canonicalKey("objective-delivery-comparability-v1", {
    ...input,
    profileSourceIds: [...input.profileSourceIds].sort(),
    assumptionIds: [...input.assumptionIds].sort(),
  });
}
