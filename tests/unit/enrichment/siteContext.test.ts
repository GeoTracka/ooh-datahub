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
    coordinateEvidence: {
      latitude: 6.5,
      longitude: 3.4,
      accuracyM: 5,
      sourceKind: "open_dataset",
      coordinateSourceId: `fixture:${id}`,
      sourceArtifactId: `fixture:${id}:artifact`,
      spatialRights: "open_licensed",
      spatialLicenseId: "CC-BY-4.0",
      enrichmentRevision: "fixture-r1",
    },
    vectorProvenance: {
      snapshotId: `vectorctx:${id}`,
      algorithmVersion: "overture-vector-context-v1",
      inputFingerprint: "1".repeat(64),
      sourceArtifacts: [
        { sourceId: "overture-places", artifactSha256: "a".repeat(64) },
        { sourceId: "overture-transportation", artifactSha256: "b".repeat(64) },
      ],
    },
    rasterProvenance: {
      snapshotId: `rasterctx:${id}`,
      algorithmVersion: "grid3-accessibility-context-v1",
      inputFingerprint: "2".repeat(64),
      sourceArtifacts: [
        { sourceId: "grid3-nigeria-population", artifactSha256: "c".repeat(64) },
        { sourceId: "grid3-nigeria-friction", artifactSha256: "d".repeat(64) },
        { sourceId: "grid3-nigeria-friction", artifactSha256: "e".repeat(64) },
      ],
    },
    settlementProvenance: {
      snapshotId: `settlementctx:${id}`,
      algorithmVersion: "grid3-settlement-context-v1",
      inputFingerprint: "3".repeat(64),
      sourceArtifacts: [
        { sourceId: "grid3-nigeria-settlements", artifactSha256: "f".repeat(64) },
      ],
    },
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
    expect(result.contrasts.find((item) => item.metric === "nearest_major_road_distance_m")?.direction).toBe("left_lower");
    expect(result.contrasts.find((item) => item.metric === "nearest_major_road_distance_m")?.text).toContain("Left site is closer");
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
      vectorProvenance: null,
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

  it("preserves materially different approved coordinate assertions for the same site", () => {
    const left = context("coordinate-a", {
      siteId: "site:shared",
      coordinateAssertionId: "coordinate:shared:a",
      vectorContext: [{
        radiusM: 500,
        placesCovered: true,
        roadsCovered: true,
        coverageStatus: "full",
        placeCount: 95,
        taxonomyEntropy: 1.8,
        nearestMajorRoadM: 25,
        majorRoadDensityKmPerKm2: 9,
      }],
    });
    const right = context("coordinate-b", {
      siteId: "site:shared",
      coordinateAssertionId: "coordinate:shared:b",
      vectorContext: [{
        radiusM: 500,
        placesCovered: true,
        roadsCovered: true,
        coverageStatus: "full",
        placeCount: 20,
        taxonomyEntropy: 0.7,
        nearestMajorRoadM: 180,
        majorRoadDensityKmPerKm2: 2,
      }],
    });

    const result = compareSiteContext(left, right);
    expect(result.leftCoordinateAssertionId).toBe("coordinate:shared:a");
    expect(result.rightCoordinateAssertionId).toBe("coordinate:shared:b");
    expect(result.contrasts.find((item) => item.metric === "destination_presence")?.direction).toBe("left_higher");
    expect(result.contrasts.find((item) => item.metric === "nearest_major_road_distance_m")?.direction).toBe("left_lower");
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
