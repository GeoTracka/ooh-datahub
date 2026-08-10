import { describe, expect, it } from "vitest";
import { buildArtifactRegistration } from "../../../src/enrichment/artifactContract";
import {
  allEnrichmentSources,
  enrichmentSource,
  productionEnrichmentSource,
} from "../../../src/enrichment/sourceRegistry";

describe("open enrichment source registry", () => {
  it("keeps every production source commercially reviewed", () => {
    for (const source of allEnrichmentSources().filter((item) => item.productionEnabled)) {
      expect(source.commercialUseStatus).toBe("permitted");
      expect(source.allowedFeatureFamilies.length).toBeGreaterThan(0);
    }
  });

  it("fails closed for research-only/noncommercial sources", () => {
    expect(enrichmentSource("ookla-speedtest-research-only").commercialUseStatus).toBe("restricted");
    expect(() => productionEnrichmentSource("ookla-speedtest-research-only"))
      .toThrow("ENRICHMENT_SOURCE_NOT_PRODUCTION_ENABLED");
  });

  it("requires explicit product license review where the source family is mixed", () => {
    const common = {
      sourceId: "worldpop-nigeria-age-sex",
      sourceRelease: "fixture-r1",
      fileName: "nga.tif",
      contentType: "image/tiff",
      byteSize: 123,
      sha256: "a".repeat(64),
      accessUri: "https://example.test/nga.tif",
      storageUri: "s3://fixtures/nga.tif",
      retrievedAt: "2026-08-10T12:00:00Z",
    };
    expect(() => buildArtifactRegistration(common))
      .toThrow("ENRICHMENT_ARTIFACT_LICENSE_REVIEW_REQUIRED");

    const approved = buildArtifactRegistration({
      ...common,
      licenseOverride: {
        licenseId: "CC-BY-4.0",
        attributionText: "Fixture WorldPop product citation",
        shareAlike: false,
        commercialUseStatus: "permitted",
        reviewedAt: "2026-08-10",
        reviewReference: "review:fixture",
      },
    });
    expect(approved.licenseId).toBe("CC-BY-4.0");
  });

  it("requires feature-level license provenance for multi-source Overture data", () => {
    expect(() => buildArtifactRegistration({
      sourceId: "overture-places",
      sourceRelease: "2026-06-17.0",
      fileName: "places.parquet",
      contentType: "application/vnd.apache.parquet",
      byteSize: 123,
      sha256: "b".repeat(64),
      accessUri: "s3://overturemaps-us-west-2/release/2026-06-17.0/theme=places/",
      storageUri: "s3://fixtures/overture/places.parquet",
      retrievedAt: "2026-08-10T12:00:00Z",
    })).toThrow("ENRICHMENT_FEATURE_LICENSE_PROVENANCE_REQUIRED");
  });
});
