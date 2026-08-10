import { createHash } from "node:crypto";
import { canonicalJson } from "../shared/canonicalJson";
import type { ArtifactLicenseOverride } from "./artifactContract";

export const GRID3_RASTER_WORKER_VERSION = "grid3-accessibility-worker-v1";
export const GRID3_ACCESSIBILITY_CONTEXT_VERSION = "grid3-site-accessibility-v1";
export const GRID3_DEFAULT_THRESHOLDS_MINUTES = [5, 10, 15] as const;
export const GRID3_DEFAULT_RADII_M = [250, 500, 1000] as const;
export const GRID3_DEFAULT_MAX_SEARCH_RADIUS_M = 30_000;
export const GRID3_MAX_SEARCH_RADIUS_M = 50_000;

export type Grid3RasterRole = "population" | "walking_friction" | "mixed_friction";

export type RasterInspection = {
  workerVersion: string;
  driver: string;
  width: number;
  height: number;
  bandCount: number;
  dataType: string;
  epsg: number;
  geotransform: [number, number, number, number, number, number];
  pixelSize: [number, number];
  rotated: boolean;
  noData: number | null;
  unitType: string | null;
  boundsNative: [number, number, number, number];
  boundsWgs84: [number, number, number, number];
  pointInPixel: "center";
};

export type Grid3RasterProductContract = {
  role: Grid3RasterRole;
  sourceId: "grid3-nigeria-population" | "grid3-nigeria-friction";
  productVersion: string;
  productCitation: string;
  knownLimitations: string;
  expectedEpsg: number;
  approximateResolution: number;
  resolutionTolerance: number;
  unitSemantic: "population_count_per_cell" | "minutes_per_meter";
  licenseOverride?: ArtifactLicenseOverride;
};

const populationLicenseReview: ArtifactLicenseOverride = {
  licenseId: "CC-BY-4.0",
  attributionText: "WorldPop, University of Southampton / GRID3 Nigeria Population v3.0",
  shareAlike: false,
  commercialUseStatus: "permitted",
  reviewedAt: "2026-08-10",
  reviewReference: "WorldPop/GRID3 NGA gridded population v3.0 metadata; DOI 10.5258/SOTON/WP00782",
};

export const GRID3_RASTER_PRODUCTS: Record<Grid3RasterRole, Grid3RasterProductContract> = {
  population: {
    role: "population",
    sourceId: "grid3-nigeria-population",
    productVersion: "v3.0",
    productCitation: "Nnanatu C.C., Gadiaga A., Abbott T. J., Chamberlain H., Lazar A. N., Tatem A. J. (2025). Modelled gridded population estimates for Nigeria 2025 version 3.0. WorldPop, University of Southampton. DOI 10.5258/SOTON/WP00782.",
    knownLimitations: "Operational modelled population estimates; not official government statistics. Preserve fractional cell estimates and uncertainty/NoData semantics.",
    expectedEpsg: 4326,
    approximateResolution: 3 / 3600,
    resolutionTolerance: 0.0002,
    unitSemantic: "population_count_per_cell",
    licenseOverride: populationLicenseReview,
  },
  walking_friction: {
    role: "walking_friction",
    sourceId: "grid3-nigeria-friction",
    productVersion: "v1.0",
    productCitation: "Center for Integrated Earth System Information (CIESIN), Columbia University. 2025. GRID3 NGA - Travel Time Friction Surface v1.0. DOI 10.7916/tw5k-ys98.",
    knownLimitations: "Operational accessibility model; not fully validated by government officials or ministries. Walking surface adjusts walking speeds for slope and elevation.",
    expectedEpsg: 32632,
    approximateResolution: 30.005213,
    resolutionTolerance: 1,
    unitSemantic: "minutes_per_meter",
  },
  mixed_friction: {
    role: "mixed_friction",
    sourceId: "grid3-nigeria-friction",
    productVersion: "v1.0",
    productCitation: "Center for Integrated Earth System Information (CIESIN), Columbia University. 2025. GRID3 NGA - Travel Time Friction Surface v1.0. DOI 10.7916/tw5k-ys98.",
    knownLimitations: "Operational accessibility model; not fully validated by government officials or ministries. Motorized speeds are applied only to roads represented as vehicle-passable; walking speeds apply elsewhere.",
    expectedEpsg: 32632,
    approximateResolution: 30.005213,
    resolutionTolerance: 1,
    unitSemantic: "minutes_per_meter",
  },
};

function normalizedPositiveIntegers(values: readonly number[], label: string, maximum: number): number[] {
  const normalized = [...new Set(values.map((value) => Number(value)))].sort((a, b) => a - b);
  if (normalized.length === 0) throw new Error(`${label}_REQUIRED`);
  for (const value of normalized) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
      throw new Error(`INVALID_${label}:${value}`);
    }
  }
  return normalized;
}

export function normalizeAccessibilityThresholds(values: readonly number[]): number[] {
  return normalizedPositiveIntegers(values, "ACCESSIBILITY_THRESHOLD_MINUTES", 120);
}

export function normalizePopulationRadii(values: readonly number[]): number[] {
  return normalizedPositiveIntegers(values, "POPULATION_RADIUS_M", 10_000);
}

export function normalizeMaxSearchRadius(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > GRID3_MAX_SEARCH_RADIUS_M) {
    throw new Error(`INVALID_GRID3_MAX_SEARCH_RADIUS_M:${value}`);
  }
  return value;
}

export function symmetricEdgeCostMinutes(
  currentFrictionMinutesPerMeter: number,
  neighborFrictionMinutesPerMeter: number,
  stepDistanceM: number,
): number {
  if (
    !Number.isFinite(currentFrictionMinutesPerMeter)
    || !Number.isFinite(neighborFrictionMinutesPerMeter)
    || !Number.isFinite(stepDistanceM)
    || currentFrictionMinutesPerMeter <= 0
    || neighborFrictionMinutesPerMeter <= 0
    || stepDistanceM <= 0
  ) {
    throw new Error("INVALID_GRID3_EDGE_COST_INPUT");
  }
  return ((currentFrictionMinutesPerMeter + neighborFrictionMinutesPerMeter) / 2) * stepDistanceM;
}

export function validateGrid3RasterInspection(role: Grid3RasterRole, inspection: RasterInspection): void {
  const contract = GRID3_RASTER_PRODUCTS[role];
  if (inspection.workerVersion !== GRID3_RASTER_WORKER_VERSION) {
    throw new Error(`GRID3_RASTER_WORKER_VERSION_MISMATCH:${inspection.workerVersion}`);
  }
  if (inspection.bandCount !== 1) throw new Error(`GRID3_RASTER_SINGLE_BAND_REQUIRED:${role}`);
  if (inspection.rotated) throw new Error(`GRID3_RASTER_ROTATION_UNSUPPORTED:${role}`);
  if (inspection.epsg !== contract.expectedEpsg) {
    throw new Error(`GRID3_RASTER_EPSG_MISMATCH:${role}:${inspection.epsg}:${contract.expectedEpsg}`);
  }
  if (inspection.noData === null || !Number.isFinite(inspection.noData)) {
    throw new Error(`GRID3_RASTER_NODATA_REQUIRED:${role}`);
  }
  if (inspection.width <= 0 || inspection.height <= 0) {
    throw new Error(`GRID3_RASTER_DIMENSIONS_INVALID:${role}`);
  }
  const [pixelX, pixelY] = inspection.pixelSize;
  if (
    Math.abs(pixelX - contract.approximateResolution) > contract.resolutionTolerance
    || Math.abs(pixelY - contract.approximateResolution) > contract.resolutionTolerance
  ) {
    throw new Error(`GRID3_RASTER_RESOLUTION_MISMATCH:${role}:${pixelX}:${pixelY}`);
  }
  const [west, south, east, north] = inspection.boundsWgs84;
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    throw new Error(`GRID3_RASTER_BOUNDS_INVALID:${role}`);
  }
}

export function grid3RasterGridSignature(inspection: RasterInspection): string {
  return createHash("sha256").update(canonicalJson({
    width: inspection.width,
    height: inspection.height,
    epsg: inspection.epsg,
    geotransform: inspection.geotransform,
    pixelSize: inspection.pixelSize,
    boundsNative: inspection.boundsNative,
  }), "utf8").digest("hex");
}

export function productContractForRole(role: string): Grid3RasterProductContract {
  const contract = GRID3_RASTER_PRODUCTS[role as Grid3RasterRole];
  if (!contract) throw new Error(`UNKNOWN_GRID3_RASTER_ROLE:${role}`);
  return contract;
}
