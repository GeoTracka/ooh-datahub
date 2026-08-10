import { describe, expect, it } from "vitest";
import {
  GRID3_RASTER_WORKER_VERSION,
  grid3RasterGridSignature,
  normalizeAccessibilityThresholds,
  normalizeMaxSearchRadius,
  normalizePopulationRadii,
  symmetricEdgeCostMinutes,
  validateGrid3RasterInspection,
  type RasterInspection,
} from "../../../src/enrichment/grid3Raster";

function inspection(overrides: Partial<RasterInspection> = {}): RasterInspection {
  return {
    workerVersion: GRID3_RASTER_WORKER_VERSION,
    driver: "GTiff",
    width: 100,
    height: 100,
    bandCount: 1,
    dataType: "Float32",
    epsg: 32632,
    geotransform: [500000, 30.005213, 0, 800000, 0, -30.005213],
    pixelSize: [30.005213, 30.005213],
    rotated: false,
    noData: -9999,
    unitType: null,
    boundsNative: [500000, 796999.4787, 503000.5213, 800000],
    boundsWgs84: [8.9, 7.2, 9.0, 7.3],
    pointInPixel: "center",
    ...overrides,
  };
}

describe("GRID3 raster contracts", () => {
  it("normalizes bounded thresholds, radii and search radius", () => {
    expect(normalizeAccessibilityThresholds([15, 5, 10, 5])).toEqual([5, 10, 15]);
    expect(normalizePopulationRadii([1000, 250, 500, 250])).toEqual([250, 500, 1000]);
    expect(normalizeMaxSearchRadius(30000)).toBe(30000);
    expect(() => normalizeMaxSearchRadius(50001)).toThrow("INVALID_GRID3_MAX_SEARCH_RADIUS_M");
    expect(() => normalizeAccessibilityThresholds([0, 10])).toThrow("INVALID_ACCESSIBILITY_THRESHOLD_MINUTES");
  });

  it("uses symmetric endpoint friction for deterministic 8-neighbour edge cost", () => {
    expect(symmetricEdgeCostMinutes(0.02, 0.04, 30)).toBeCloseTo(0.9, 12);
    expect(symmetricEdgeCostMinutes(0.04, 0.02, 30)).toBeCloseTo(0.9, 12);
    expect(symmetricEdgeCostMinutes(0.02, 0.04, Math.sqrt(2) * 30)).toBeCloseTo(0.9 * Math.sqrt(2), 12);
    expect(() => symmetricEdgeCostMinutes(0, 0.04, 30)).toThrow("INVALID_GRID3_EDGE_COST_INPUT");
  });

  it("requires role-specific CRS, resolution and explicit NoData", () => {
    expect(() => validateGrid3RasterInspection("walking_friction", inspection())).not.toThrow();
    expect(() => validateGrid3RasterInspection("mixed_friction", inspection())).not.toThrow();
    expect(() => validateGrid3RasterInspection("walking_friction", inspection({ epsg: 4326 })))
      .toThrow("GRID3_RASTER_EPSG_MISMATCH");
    expect(() => validateGrid3RasterInspection("walking_friction", inspection({ noData: null })))
      .toThrow("GRID3_RASTER_NODATA_REQUIRED");
    expect(() => validateGrid3RasterInspection("walking_friction", inspection({ pixelSize: [100, 100] })))
      .toThrow("GRID3_RASTER_RESOLUTION_MISMATCH");

    const population = inspection({
      epsg: 4326,
      geotransform: [3.3, 3 / 3600, 0, 6.7, 0, -(3 / 3600)],
      pixelSize: [3 / 3600, 3 / 3600],
      boundsNative: [3.3, 6.6166666667, 3.3833333333, 6.7],
      boundsWgs84: [3.3, 6.6166666667, 3.3833333333, 6.7],
    });
    expect(() => validateGrid3RasterInspection("population", population)).not.toThrow();
  });

  it("has a stable grid signature that changes when alignment changes", () => {
    const base = inspection();
    expect(grid3RasterGridSignature(base)).toBe(grid3RasterGridSignature({ ...base }));
    expect(grid3RasterGridSignature(base)).not.toBe(grid3RasterGridSignature({
      ...base,
      geotransform: [500030, 30.005213, 0, 800000, 0, -30.005213],
    }));
  });
});
