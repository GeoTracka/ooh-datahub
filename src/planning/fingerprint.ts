import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";
import type { ExposureBlock } from "@/planning/movement";
import { canonicalJson } from "@/shared/canonicalJson";

const bundleCanonicalCache = new WeakMap<object, string>();

function canonicalKey(namespace: string, value: unknown): string {
  // These keys are compared by full canonical equality. They are deliberately
  // not shortened to a collision-prone display hash.
  return namespace + "|" + canonicalJson(value);
}

function canonicalBundle(bundle: FrozenBundle): string {
  const cached = bundleCanonicalCache.get(bundle);
  if (cached) return cached;
  const serialized = canonicalJson(bundle);
  bundleCanonicalCache.set(bundle, serialized);
  return serialized;
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
  // Preserve the exact historical canonical bytes while avoiding a full bundle
  // traversal for every candidate evaluated against the same immutable bundle.
  const normalizedRequest = canonicalJson({
    ...request,
    siteIds: [...request.siteIds].sort(),
  });
  return "estimate-result-v2|" +
    "{\"bundle\":" + canonicalBundle(bundle) +
    ",\"request\":" + normalizedRequest + "}";
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
