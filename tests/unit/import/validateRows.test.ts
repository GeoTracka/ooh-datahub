import { describe, expect, it } from "vitest";
import {
  selectRowsForEnrichment,
  validateMappedRows,
} from "@/import/validateRows";

describe("validateMappedRows", () => {
  it("quarantines apparent personal data before transmission", () => {
    const result = validateMappedRows([{
      assetId: "P-1",
      address: "Private home",
      personName: "Ada Example",
      spatialRights: "unknown",
    }]);
    expect(result.quarantined[0].reasonCodes).toContain("APPARENT_PERSONAL_DATA");
  });

  it("keeps unknown-provenance coordinates context-only", () => {
    const result = validateMappedRows([{
      assetId: "P-2",
      latitude: 6.5,
      longitude: 3.4,
      spatialRights: "unknown",
    }]);
    expect(result.accepted[0].modelEligible).toBe(false);
    expect(result.accepted[0].mapLibreEligible).toBe(false);
  });

  it("normalizes invalid runtime spatial-rights values to unknown", () => {
    const result = validateMappedRows([{
      assetId: "P-2B",
      address: "Commercial media site",
      spatialRights: "mystery_source" as never,
    }]);
    expect(result.accepted[0].spatialRights).toBe("unknown");
    expect(result.accepted[0].warningCodes).toContain("INVALID_SPATIAL_RIGHTS_VALUE");
    expect(result.accepted[0].warningCodes).toContain("UNKNOWN_SPATIAL_PROVENANCE");
  });

  it("rejects duplicate asset IDs explicitly", () => {
    const result = validateMappedRows([
      { assetId: "DUP-1", address: "Site one", spatialRights: "unknown" },
      { assetId: "DUP-1", address: "Site two", spatialRights: "unknown" },
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reasonCodes).toContain("DUPLICATE_ASSET_ID");
  });

  it("requires a license or attestation ID for MapLibre and never auto-promotes model use", () => {
    const withoutId = validateMappedRows([{
      assetId: "P-3",
      latitude: 6.5,
      longitude: 3.4,
      spatialRights: "customer_captured",
    }]).accepted[0];
    expect(withoutId.mapLibreEligible).toBe(false);
    expect(withoutId.modelEligible).toBe(false);
    expect(withoutId.warningCodes)
      .toContain("SPATIAL_LICENSE_OR_ATTESTATION_REQUIRED");

    const attested = validateMappedRows([{
      assetId: "P-4",
      latitude: 6.5,
      longitude: 3.4,
      spatialRights: "customer_captured",
      spatialLicenseId: "customer-coordinate-attestation-1",
      sourceArtifactId: "upload-fixture-1",
      coordinateAccuracyM: 25,
    }]).accepted[0];
    expect(attested.mapLibreEligible).toBe(true);
    expect(attested.modelEligible).toBe(false);
  });

  it("parses larger files locally but refuses a selection above 50", () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      assetId: "A-" + index,
      address: "Media address " + index,
      spatialRights: "customer_captured" as const,
    }));
    const accepted = validateMappedRows(rows).accepted;
    expect(accepted).toHaveLength(51);
    expect(() => selectRowsForEnrichment(
      accepted,
      accepted.map((row) => row.assetId),
    )).toThrow("MAX_50_SELECTED_ROWS");
  });
});
