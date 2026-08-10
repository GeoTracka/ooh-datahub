import { describe, expect, it } from "vitest";
import {
  SITE_CONTEXT_READ_MODEL_VERSION,
  compareSiteContext,
  type SiteContextReadModel,
} from "../../../src/enrichment/siteContext";

function context(
  id: string,
  overrides: Partial<SiteContextReadModel> = {},
): SiteContextReadModel {
  return {
    readModelVersion: SITE_CONTEXT_READ_MODEL_VERSION,
    siteId: `site:${id}`,
    coordinateAssertionId: `coordinate:${id}`,
    coordinateCurrentlyEligible: true,
    vectorMissingReason: null,
    rasterMissingReason: null,
    settlementMissingReason: null,
    vectorContext: [{
      radiusM: 500,
      placesCovered: true,
      roadsCovered: true,
      coverageStatus: "full",
      placeCount: 40,
      taxonomyEntropy: 1.2,
      nearestMajorRoadM: 90,
      majorRoadDensityKmPerKm2: 5,
    }],
    populationRadiusContext: [{ radiusM: 1000, populationEstimate: 10_000, coverageStatus: "complete" }],
    accessibilityContext: [{
      accessMode: "walking",
      thresholdMinutes: 5,
      populationEstimate: 2_000,
      coverageStatus: "complete",
    }],
    settlementContext: [{
      radiusM: 500,
      coverageStatus: "complete",
      insideSettlement: true,
      coreDepthM: 180,
      settledAreaShare: 0.62,
      componentDensityPerSqkm: 4,
    }],
    ...overrides,
  };
}

describe("site context comparison", () => {
  it("surfaces vector information when raster and settlement facts are tied", () => {
    const result = compareSiteContext(context("left", {
      vectorContext: [{
        radiusM: 500,
        placesCovered: true,
        roadsCovered: true,
        coverageStatus: "full",
        placeCount: 80,
        taxonomyEntropy: 1.4,
        nearestMajorRoadM: 35,
        majorRoadDensityKmPerKm2: 8,
      }],
    }), context("right"));

    expect(result.complete).toBe(true);
    expect(result.contrasts.find((item) => item.metric === "destination_presence")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "major_road_proximity")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "resident_population")?.direction).toBe("similar");
    expect(result.contrasts.find((item) => item.metric === "settled_area_share")?.direction).toBe("similar");
  });

  it("surfaces raster information independently of vector and settlement", () => {
    const result = compareSiteContext(context("left", {
      populationRadiusContext: [{ radiusM: 1000, populationEstimate: 18_000, coverageStatus: "complete" }],
      accessibilityContext: [{
        accessMode: "walking",
        thresholdMinutes: 5,
        populationEstimate: 4_500,
        coverageStatus: "complete",
      }],
    }), context("right"));

    expect(result.contrasts.find((item) => item.metric === "resident_population")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "accessible_population")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "destination_presence")?.direction).toBe("similar");
  });

  it("surfaces settlement morphology independently when E2A and E2B1 are tied", () => {
    const result = compareSiteContext(context("left", {
      settlementContext: [{
        radiusM: 500,
        coverageStatus: "complete",
        insideSettlement: true,
        coreDepthM: 320,
        settledAreaShare: 0.88,
        componentDensityPerSqkm: 2,
      }],
    }), context("right"));

    expect(result.contrasts.find((item) => item.metric === "settled_area_share")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "settlement_core_depth")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "resident_population")?.direction).toBe("similar");
  });

  it("does not collapse disagreeing families into a universal score", () => {
    const result = compareSiteContext(context("left", {
      vectorContext: [{
        radiusM: 500,
        placesCovered: true,
        roadsCovered: true,
        coverageStatus: "full",
        placeCount: 90,
        taxonomyEntropy: 1.5,
        nearestMajorRoadM: 30,
        majorRoadDensityKmPerKm2: 8,
      }],
      populationRadiusContext: [{ radiusM: 1000, populationEstimate: 6_000, coverageStatus: "complete" }],
    }), context("right"));

    expect(result.contrasts.find((item) => item.metric === "destination_presence")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "resident_population")?.direction).toBe("right_higher");
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("winner");
  });

  it("marks missing/partial coverage incomplete and never manufactures a favourable contrast", () => {
    const result = compareSiteContext(context("left", {
      vectorMissingReason: "not_derived",
      vectorContext: [],
      populationRadiusContext: [{ radiusM: 1000, populationEstimate: 50_000, coverageStatus: "partial_source_coverage" }],
      accessibilityContext: [],
    }), context("right"));

    expect(result.complete).toBe(false);
    expect(result.incompleteReasons).toContain("vector:not_derived:available");
    expect(result.incompleteReasons).toContain("left_raster_partial_coverage");
    expect(result.contrasts.some((item) => item.family === "vector")).toBe(false);
    expect(result.contrasts.some((item) => item.metric === "resident_population")).toBe(false);
  });

  it("preserves coordinate identity and stops interpretation for revoked evidence", () => {
    const result = compareSiteContext(context("left", {
      coordinateAssertionId: "coordinate:left-a",
      coordinateCurrentlyEligible: false,
      vectorMissingReason: "coordinate_not_currently_eligible",
      rasterMissingReason: "coordinate_not_currently_eligible",
      settlementMissingReason: "coordinate_not_currently_eligible",
    }), context("right", { coordinateAssertionId: "coordinate:right-b" }));

    expect(result.leftCoordinateAssertionId).toBe("coordinate:left-a");
    expect(result.rightCoordinateAssertionId).toBe("coordinate:right-b");
    expect(result.complete).toBe(false);
    expect(result.incompleteReasons).toContain("left_coordinate_not_currently_eligible");
    expect(result.contrasts).toEqual([]);
  });
});
