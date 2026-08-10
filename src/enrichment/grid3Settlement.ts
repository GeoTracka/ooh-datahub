import { createHash } from "node:crypto";
import { canonicalJson } from "../shared/canonicalJson";

export const GRID3_SETTLEMENT_SOURCE_ID = "grid3-nigeria-settlements";
export const GRID3_SETTLEMENT_PRODUCT_VERSION = "v4.1";
export const GRID3_SETTLEMENT_ADAPTER_VERSION = "grid3-settlement-adapter-v1";
export const GRID3_SETTLEMENT_WORKER_VERSION = "grid3-settlement-worker-v1";
export const GRID3_SETTLEMENT_CONTEXT_VERSION = "grid3-settlement-context-v1";
export const GRID3_SETTLEMENT_DEFAULT_RADII_M = [250, 500, 1000] as const;

export type Grid3SettlementOptionalSemantic =
  | "buildingCount"
  | "buildingDensity"
  | "degreeUrbanisation"
  | "populationEstimate"
  | "falsePositiveProbability"
  | "placeCode";

export type Grid3SettlementFieldMap = {
  featureId: string;
  buildingCount?: string;
  buildingDensity?: string;
  degreeUrbanisation?: string;
  populationEstimate?: string;
  falsePositiveProbability?: string;
  placeCode?: string;
};

const allowedFieldMapKeys = new Set([
  "featureId",
  "buildingCount",
  "buildingDensity",
  "degreeUrbanisation",
  "populationEstimate",
  "falsePositiveProbability",
  "placeCode",
]);

function requiredFieldName(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`GRID3_SETTLEMENT_FIELD_MAP_VALUE_REQUIRED:${key}`);
  }
  return value.trim();
}

export function normalizeGrid3SettlementFieldMap(value: unknown): Grid3SettlementFieldMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GRID3_SETTLEMENT_FIELD_MAP_OBJECT_REQUIRED");
  }
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!allowedFieldMapKeys.has(key)) throw new Error(`GRID3_SETTLEMENT_FIELD_MAP_KEY_INVALID:${key}`);
  }
  const output: Grid3SettlementFieldMap = {
    featureId: requiredFieldName(input.featureId ?? "$fid", "featureId"),
  };
  for (const key of [
    "buildingCount",
    "buildingDensity",
    "degreeUrbanisation",
    "populationEstimate",
    "falsePositiveProbability",
    "placeCode",
  ] as const) {
    if (input[key] !== undefined && input[key] !== null) {
      output[key] = requiredFieldName(input[key], key);
    }
  }
  const mappedColumns = Object.entries(output)
    .filter(([, field]) => field !== "$fid")
    .map(([, field]) => field);
  if (new Set(mappedColumns).size !== mappedColumns.length) {
    throw new Error("GRID3_SETTLEMENT_FIELD_MAP_DUPLICATE_SOURCE_COLUMN");
  }
  return output;
}

export function grid3SettlementFieldMapFingerprint(fieldMap: Grid3SettlementFieldMap): string {
  return createHash("sha256").update(canonicalJson(fieldMap), "utf8").digest("hex");
}

export function normalizeGrid3SettlementRadii(values: readonly number[]): number[] {
  const radii = [...new Set(values.map((value) => Number(value)))].sort((a, b) => a - b);
  if (
    radii.length === 0
    || radii.length > 8
    || radii.some((value) => !Number.isSafeInteger(value) || value < 50 || value > 5000)
  ) {
    throw new Error("GRID3_SETTLEMENT_RADII_INVALID");
  }
  return radii;
}

export function validateGrid3SettlementInspection(inspection: {
  workerVersion?: unknown;
  featureCount?: unknown;
  geometryType?: unknown;
  epsg?: unknown;
  fields?: unknown;
  boundsWgs84?: unknown;
}): void {
  if (inspection.workerVersion !== GRID3_SETTLEMENT_WORKER_VERSION) {
    throw new Error("GRID3_SETTLEMENT_WORKER_VERSION_MISMATCH");
  }
  if (!Number.isSafeInteger(inspection.featureCount) || Number(inspection.featureCount) < 1) {
    throw new Error("GRID3_SETTLEMENT_FEATURE_COUNT_INVALID");
  }
  const geometryType = String(inspection.geometryType ?? "").toLowerCase();
  if (!geometryType.includes("polygon")) throw new Error("GRID3_SETTLEMENT_POLYGON_GEOMETRY_REQUIRED");
  if (!Number.isSafeInteger(inspection.epsg) || Number(inspection.epsg) <= 0) {
    throw new Error("GRID3_SETTLEMENT_EPSG_REQUIRED");
  }
  if (!Array.isArray(inspection.fields)) throw new Error("GRID3_SETTLEMENT_FIELDS_REQUIRED");
  if (
    !Array.isArray(inspection.boundsWgs84)
    || inspection.boundsWgs84.length !== 4
    || inspection.boundsWgs84.some((value) => !Number.isFinite(Number(value)))
  ) {
    throw new Error("GRID3_SETTLEMENT_WGS84_BOUNDS_REQUIRED");
  }
}

export function assertGrid3SettlementFieldMapAgainstInspection(
  fieldMap: Grid3SettlementFieldMap,
  fields: readonly unknown[],
): void {
  const names = new Set(fields.map((field) => {
    if (!field || typeof field !== "object") return "";
    return String((field as { name?: unknown }).name ?? "");
  }).filter(Boolean));
  for (const [semantic, sourceField] of Object.entries(fieldMap)) {
    if (sourceField === "$fid") continue;
    if (!names.has(sourceField)) {
      throw new Error(`GRID3_SETTLEMENT_MAPPED_FIELD_MISSING:${semantic}:${sourceField}`);
    }
  }
}

export function settlementCompactness(areaM2: number, perimeterM: number): number | null {
  if (!Number.isFinite(areaM2) || !Number.isFinite(perimeterM) || areaM2 <= 0 || perimeterM <= 0) return null;
  return Math.min(1, (4 * Math.PI * areaM2) / (perimeterM * perimeterM));
}
