import { describe, expect, it } from "vitest";
import {
  assertGrid3SettlementFieldMapAgainstInspection,
  grid3SettlementFieldMapFingerprint,
  normalizeGrid3SettlementFieldMap,
  normalizeGrid3SettlementRadii,
  settlementCompactness,
  validateGrid3SettlementInspection,
} from "../../../src/enrichment/grid3Settlement";

describe("GRID3 settlement contract", () => {
  it("normalizes and fingerprints an explicit source-field map", () => {
    const fieldMap = normalizeGrid3SettlementFieldMap({
      featureId: "settlement_id",
      buildingCount: "bldg_count",
      degreeUrbanisation: "degurba",
    });
    expect(fieldMap).toEqual({
      featureId: "settlement_id",
      buildingCount: "bldg_count",
      degreeUrbanisation: "degurba",
    });
    expect(grid3SettlementFieldMapFingerprint(fieldMap)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects duplicate or guessed field mappings", () => {
    expect(() => normalizeGrid3SettlementFieldMap({ featureId: "id", buildingCount: "id" }))
      .toThrow("GRID3_SETTLEMENT_FIELD_MAP_DUPLICATE_SOURCE_COLUMN");
    expect(() => normalizeGrid3SettlementFieldMap({ featureId: "id", mysteryMetric: "x" }))
      .toThrow("GRID3_SETTLEMENT_FIELD_MAP_KEY_INVALID:mysteryMetric");
  });

  it("requires every declared source field to exist in the inspected schema", () => {
    const fieldMap = normalizeGrid3SettlementFieldMap({ featureId: "id", buildingDensity: "density" });
    expect(() => assertGrid3SettlementFieldMapAgainstInspection(fieldMap, [{ name: "id" }]))
      .toThrow("GRID3_SETTLEMENT_MAPPED_FIELD_MISSING:buildingDensity:density");
    expect(() => assertGrid3SettlementFieldMapAgainstInspection(fieldMap, [{ name: "id" }, { name: "density" }]))
      .not.toThrow();
  });

  it("bounds radii and keeps them deterministic", () => {
    expect(normalizeGrid3SettlementRadii([1000, 250, 500, 500])).toEqual([250, 500, 1000]);
    expect(() => normalizeGrid3SettlementRadii([25])).toThrow("GRID3_SETTLEMENT_RADII_INVALID");
    expect(() => normalizeGrid3SettlementRadii([6000])).toThrow("GRID3_SETTLEMENT_RADII_INVALID");
  });

  it("validates polygon inspections", () => {
    expect(() => validateGrid3SettlementInspection({
      workerVersion: "grid3-settlement-worker-v1",
      featureCount: 3,
      geometryType: "Multi Polygon",
      epsg: 4326,
      fields: [{ name: "id" }],
      boundsWgs84: [3, 6, 4, 7],
    })).not.toThrow();
    expect(() => validateGrid3SettlementInspection({
      workerVersion: "grid3-settlement-worker-v1",
      featureCount: 3,
      geometryType: "Point",
      epsg: 4326,
      fields: [],
      boundsWgs84: [3, 6, 4, 7],
    })).toThrow("GRID3_SETTLEMENT_POLYGON_GEOMETRY_REQUIRED");
  });

  it("computes scale-free polygon compactness", () => {
    expect(settlementCompactness(Math.PI * 100 * 100, 2 * Math.PI * 100)).toBeCloseTo(1, 10);
    expect(settlementCompactness(100, 100)).toBeCloseTo((4 * Math.PI * 100) / 10000, 10);
    expect(settlementCompactness(0, 10)).toBeNull();
  });
});
