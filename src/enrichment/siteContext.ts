export const SITE_CONTEXT_READ_MODEL_VERSION = "site-context-read-model-v1" as const;
export const SITE_CONTEXT_COMPARISON_VERSION = "site-context-comparison-v1" as const;
export const SITE_CONTEXT_SIMILAR_RELATIVE_TOLERANCE = 0.05;

export type ContextCoverage = "complete" | "partial_source_coverage";
export type VectorCoverage = "full" | "places_only" | "roads_only" | "uncovered";
export type ContextMissingReason = "coordinate_not_currently_eligible" | "not_derived" | null;

export type SourceArtifactIdentity = {
  sourceId: string;
  artifactSha256: string;
};

export type ContextProvenance = {
  snapshotId: string;
  algorithmVersion: string;
  inputFingerprint: string;
  sourceArtifacts: SourceArtifactIdentity[];
};

export type CoordinateEvidence = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  sourceKind: string;
  coordinateSourceId: string;
  sourceArtifactId: string | null;
  spatialRights: string;
  spatialLicenseId: string | null;
  enrichmentRevision: string;
};

export type VectorContextRadius = {
  radiusM: number;
  placesCovered: boolean;
  roadsCovered: boolean;
  coverageStatus: VectorCoverage;
  placeCount: number | null;
  taxonomyEntropy: number | null;
  nearestMajorRoadM: number | null;
  majorRoadDensityKmPerKm2: number | null;
};

export type PopulationRadiusContext = {
  radiusM: number;
  populationEstimate: number;
  coverageStatus: ContextCoverage;
};

export type AccessibilityContext = {
  accessMode: "walking" | "mixed";
  thresholdMinutes: number;
  populationEstimate: number;
  coverageStatus: ContextCoverage;
};

export type SettlementRadiusContext = {
  radiusM: number;
  coverageStatus: ContextCoverage;
  insideSettlement: boolean;
  coreDepthM: number | null;
  settledAreaShare: number;
  componentDensityPerSqkm: number;
};

export type SiteContextReadModel = {
  readModelVersion: typeof SITE_CONTEXT_READ_MODEL_VERSION;
  siteId: string;
  coordinateAssertionId: string;
  coordinateCurrentlyEligible: boolean;
  coordinateEvidence: CoordinateEvidence;
  vectorProvenance: ContextProvenance | null;
  rasterProvenance: ContextProvenance | null;
  settlementProvenance: ContextProvenance | null;
  vectorMissingReason: ContextMissingReason;
  rasterMissingReason: ContextMissingReason;
  settlementMissingReason: ContextMissingReason;
  vectorContext: VectorContextRadius[];
  populationRadiusContext: PopulationRadiusContext[];
  accessibilityContext: AccessibilityContext[];
  settlementContext: SettlementRadiusContext[];
};

export type SiteContextContrast = {
  family: "vector" | "raster" | "settlement";
  metric: string;
  basis: string;
  direction: "left_higher" | "right_higher" | "left_lower" | "right_lower" | "similar";
  leftValue: number;
  rightValue: number;
  text: string;
};

export type SiteContextComparison = {
  version: typeof SITE_CONTEXT_COMPARISON_VERSION;
  leftCoordinateAssertionId: string;
  rightCoordinateAssertionId: string;
  complete: boolean;
  incompleteReasons: string[];
  contrasts: SiteContextContrast[];
};

function relativeDirection(left: number, right: number): "left_higher" | "right_higher" | "similar" {
  const scale = Math.max(Math.abs(left), Math.abs(right), 1e-9);
  if (Math.abs(left - right) / scale <= SITE_CONTEXT_SIMILAR_RELATIVE_TOLERANCE) return "similar";
  return left > right ? "left_higher" : "right_higher";
}

function commonByRadius<T extends { radiusM: number }>(
  left: readonly T[],
  right: readonly T[],
  usable: (value: T) => boolean,
): [T, T] | null {
  const rightByRadius = new Map(right.filter(usable).map((item) => [item.radiusM, item]));
  const matches = left
    .filter(usable)
    .map((item) => [item, rightByRadius.get(item.radiusM)] as const)
    .filter((pair): pair is readonly [T, T] => Boolean(pair[1]))
    .sort((a, b) => b[0].radiusM - a[0].radiusM);
  return matches[0] ? [matches[0][0], matches[0][1]] : null;
}

function commonAccessibility(
  left: readonly AccessibilityContext[],
  right: readonly AccessibilityContext[],
): [AccessibilityContext, AccessibilityContext] | null {
  const usable = (item: AccessibilityContext) => item.coverageStatus === "complete";
  const rightByKey = new Map(
    right.filter(usable).map((item) => [`${item.accessMode}:${item.thresholdMinutes}`, item]),
  );
  const matches = left
    .filter(usable)
    .map((item) => [item, rightByKey.get(`${item.accessMode}:${item.thresholdMinutes}`)] as const)
    .filter((pair): pair is readonly [AccessibilityContext, AccessibilityContext] => Boolean(pair[1]))
    .sort((a, b) => {
      if (a[0].accessMode !== b[0].accessMode) return a[0].accessMode === "walking" ? -1 : 1;
      return a[0].thresholdMinutes - b[0].thresholdMinutes;
    });
  return matches[0] ? [matches[0][0], matches[0][1]] : null;
}

function higherContrast(
  family: SiteContextContrast["family"],
  metric: string,
  basis: string,
  leftValue: number,
  rightValue: number,
  label: string,
): SiteContextContrast {
  const direction = relativeDirection(leftValue, rightValue);
  const text = direction === "similar"
    ? `Similar ${label} (${basis}).`
    : direction === "left_higher"
      ? `Left site has higher ${label} (${basis}).`
      : `Right site has higher ${label} (${basis}).`;
  return { family, metric, basis, direction, leftValue, rightValue, text };
}

function lowerDistanceContrast(
  family: SiteContextContrast["family"],
  metric: string,
  basis: string,
  leftValue: number,
  rightValue: number,
  label: string,
): SiteContextContrast {
  const rawDirection = relativeDirection(leftValue, rightValue);
  const direction: SiteContextContrast["direction"] = rawDirection === "similar"
    ? "similar"
    : rawDirection === "left_higher"
      ? "right_lower"
      : "left_lower";
  const text = direction === "similar"
    ? `Similar ${label} (${basis}).`
    : direction === "left_lower"
      ? `Left site is closer to ${label} (${basis}).`
      : `Right site is closer to ${label} (${basis}).`;
  return { family, metric, basis, direction, leftValue, rightValue, text };
}

function familyReason(
  family: string,
  left: ContextMissingReason,
  right: ContextMissingReason,
): string | null {
  if (left === null && right === null) return null;
  return `${family}:${left ?? "available"}:${right ?? "available"}`;
}

export function compareSiteContext(
  left: SiteContextReadModel,
  right: SiteContextReadModel,
): SiteContextComparison {
  const incompleteReasons: string[] = [];
  if (!left.coordinateCurrentlyEligible) incompleteReasons.push("left_coordinate_not_currently_eligible");
  if (!right.coordinateCurrentlyEligible) incompleteReasons.push("right_coordinate_not_currently_eligible");

  for (const reason of [
    familyReason("vector", left.vectorMissingReason, right.vectorMissingReason),
    familyReason("raster", left.rasterMissingReason, right.rasterMissingReason),
    familyReason("settlement", left.settlementMissingReason, right.settlementMissingReason),
  ]) {
    if (reason) incompleteReasons.push(reason);
  }

  if (left.vectorContext.some((item) => item.coverageStatus !== "full")) incompleteReasons.push("left_vector_partial_coverage");
  if (right.vectorContext.some((item) => item.coverageStatus !== "full")) incompleteReasons.push("right_vector_partial_coverage");
  if (left.populationRadiusContext.some((item) => item.coverageStatus !== "complete")
    || left.accessibilityContext.some((item) => item.coverageStatus !== "complete")) {
    incompleteReasons.push("left_raster_partial_coverage");
  }
  if (right.populationRadiusContext.some((item) => item.coverageStatus !== "complete")
    || right.accessibilityContext.some((item) => item.coverageStatus !== "complete")) {
    incompleteReasons.push("right_raster_partial_coverage");
  }
  if (left.settlementContext.some((item) => item.coverageStatus !== "complete")) incompleteReasons.push("left_settlement_partial_coverage");
  if (right.settlementContext.some((item) => item.coverageStatus !== "complete")) incompleteReasons.push("right_settlement_partial_coverage");

  const contrasts: SiteContextContrast[] = [];
  if (left.coordinateCurrentlyEligible && right.coordinateCurrentlyEligible) {
    const vector = commonByRadius(
      left.vectorContext,
      right.vectorContext,
      (item) => item.coverageStatus === "full",
    );
    if (vector) {
      if (vector[0].placeCount !== null && vector[1].placeCount !== null) {
        contrasts.push(higherContrast(
          "vector", "destination_presence", `${vector[0].radiusM} m radius`,
          vector[0].placeCount, vector[1].placeCount, "destination presence",
        ));
      }
      if (vector[0].nearestMajorRoadM !== null && vector[1].nearestMajorRoadM !== null) {
        contrasts.push(lowerDistanceContrast(
          "vector", "nearest_major_road_distance_m", `${vector[0].radiusM} m source-covered radius`,
          vector[0].nearestMajorRoadM, vector[1].nearestMajorRoadM, "a major road",
        ));
      }
    }

    const population = commonByRadius(
      left.populationRadiusContext,
      right.populationRadiusContext,
      (item) => item.coverageStatus === "complete",
    );
    if (population) {
      contrasts.push(higherContrast(
        "raster", "resident_population", `${population[0].radiusM} m radius`,
        population[0].populationEstimate, population[1].populationEstimate, "resident population context",
      ));
    }

    const access = commonAccessibility(left.accessibilityContext, right.accessibilityContext);
    if (access) {
      contrasts.push(higherContrast(
        "raster", "accessible_population", `${access[0].accessMode} ${access[0].thresholdMinutes}-minute threshold`,
        access[0].populationEstimate, access[1].populationEstimate, "accessible resident-population context",
      ));
    }

    const settlement = commonByRadius(
      left.settlementContext,
      right.settlementContext,
      (item) => item.coverageStatus === "complete",
    );
    if (settlement) {
      contrasts.push(higherContrast(
        "settlement", "settled_area_share", `${settlement[0].radiusM} m radius`,
        settlement[0].settledAreaShare, settlement[1].settledAreaShare, "settled-area share",
      ));
      if (settlement[0].coreDepthM !== null && settlement[1].coreDepthM !== null) {
        contrasts.push(higherContrast(
          "settlement", "settlement_core_depth", `${settlement[0].radiusM} m radius`,
          settlement[0].coreDepthM, settlement[1].coreDepthM, "settlement core depth",
        ));
      }
    }
  }

  return {
    version: SITE_CONTEXT_COMPARISON_VERSION,
    leftCoordinateAssertionId: left.coordinateAssertionId,
    rightCoordinateAssertionId: right.coordinateAssertionId,
    complete: incompleteReasons.length === 0,
    incompleteReasons,
    contrasts,
  };
}
