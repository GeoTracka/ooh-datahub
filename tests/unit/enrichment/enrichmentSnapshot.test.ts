import { describe, expect, it } from "vitest";
import type {
  EnrichedField,
  EnrichedFieldPolicy,
  EnrichmentRow,
  GeocodeResponse,
} from "@/contracts/enrichment";
import {
  applyUploadToDraft,
  confirmGeocodeIdentity,
  correctCoordinate,
  createLocalEnrichmentSnapshot,
  mergeProviderResponses,
  normalizeEnrichmentSnapshot,
} from "@/enrichment/enrichmentSnapshot";

const nowIso = "2026-08-03T12:00:00.000Z";
const policy: EnrichedFieldPolicy = {
  sourceProduct: "google.geocoding.v4",
  sourceField: "fixture",
  contentClass: "GOOGLE_MAPS_CONTENT",
  allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
  displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
  persistence: { kind: "DELETE_AT", expiresAt: "2026-09-02T12:00:00.000Z" },
  attributionId: "google-maps",
  policyVersion: "2026-08-03",
  receivedAt: nowIso,
};
const wrap = <T,>(value: T, sourceField: string): EnrichedField<T> => ({
  value,
  policy: { ...policy, sourceField },
});
const row: EnrichmentRow = {
  rowId: "asset-1",
  address: "Herbert Macaulay Way Yaba",
  spatialRights: "customer_captured",
};
const response: GeocodeResponse = {
  status: "REVIEW_REQUIRED",
  candidates: [
    {
      candidateToken: "candidate-0",
      providerPlaceId: wrap("place-1", "results.placeId"),
      coordinate: wrap(
        { latitude: 6.5158, longitude: 3.3792 },
        "results.location",
      ),
      granularity: wrap("APPROXIMATE" as const, "results.granularity"),
      formattedAddress: wrap("Yaba, Lagos, Nigeria", "results.formattedAddress"),
      resultTypes: wrap(["locality"], "results.types"),
      quality: {
        resultOrdinal: 0,
        resultCount: 1,
        countryMatches: true,
        localityMatches: true,
        viewportAmbiguous: true,
        partialMatch: "UNAVAILABLE_IN_V4",
      },
    },
  ],
};

describe("versioned enrichment snapshots", () => {
  it("keeps provider precision immutable when identity is confirmed", () => {
    const snapshot = normalizeEnrichmentSnapshot([row], [response], nowIso);
    const before = snapshot.rows[0].candidates[0].granularity;
    const confirmed = confirmGeocodeIdentity(snapshot, row.rowId, "candidate-0");
    expect(confirmed.rows[0].candidates[0].granularity).toEqual(before);
    expect(confirmed.rows[0].identityConfirmed).toBe(true);
    expect(confirmed.rows[0].modelEligible).toBe(false);
  });

  it("records a moved marker as a separate customer correction", () => {
    const snapshot = normalizeEnrichmentSnapshot([row], [response], nowIso);
    const corrected = correctCoordinate(
      snapshot,
      row.rowId,
      { latitude: 6.5159, longitude: 3.3794 },
      "customer-coordinate-attestation-1",
    );
    expect(corrected.rows[0].candidates).toEqual(snapshot.rows[0].candidates);
    expect(corrected.rows[0].customerCorrection?.policy.sourceProduct).toBe(
      "customer",
    );
    expect(corrected.id).not.toBe(snapshot.id);
  });

  it("creates a context revision with a new data revision, never false reach", () => {
    const snapshot = normalizeEnrichmentSnapshot([row], [response], nowIso);
    const draft = applyUploadToDraft(snapshot, [row.rowId]);
    expect(draft).toMatchObject({
      mode: "context_shortlist",
      enrichmentSnapshotId: snapshot.id,
      dataRevision: snapshot.dataRevision,
      planningFit: null,
    });
    expect(draft.claimResolution.highest).toBe("context");
    expect(draft.claimResolution.recoveryAction).toBeTruthy();
  });

  it("preserves commercial inventory fields into the planning context", () => {
    const commercialRow: EnrichmentRow = {
      rowId: "UP-001",
      assetId: "UP-001",
      address: "Herbert Macaulay Way Yaba Lagos",
      latitude: 6.5158,
      longitude: 3.3717,
      coordinateAccuracyM: 25,
      supplier: "Upload Media",
      format: "static",
      rateNgn: 3_200_000,
      orientation: "northbound",
      spatialRights: "customer_captured",
      spatialLicenseId: "customer-coordinate-attestation-1",
      sourceArtifactId: "upload-fixture-1",
    };
    const snapshot = createLocalEnrichmentSnapshot([commercialRow], nowIso);
    const draft = applyUploadToDraft(snapshot, [commercialRow.rowId]);
    expect(draft.selectedRows[0]).toMatchObject({
      assetId: "UP-001",
      supplier: "Upload Media",
      format: "static",
      rateNgn: 3_200_000,
      orientation: "northbound",
      address: "Herbert Macaulay Way Yaba Lagos",
    });
    expect(draft.selectedRows[0].coordinate?.value).toEqual([3.3717, 6.5158]);
  });

  it("creates a usable local snapshot before any provider response", () => {
    const localRow = {
      ...row,
      latitude: 6.5158,
      longitude: 3.3792,
      spatialRights: "customer_captured" as const,
      spatialLicenseId: "customer-coordinate-attestation-1",
      sourceArtifactId: "upload-fixture-1",
      coordinateAccuracyM: 25,
    };
    const local = createLocalEnrichmentSnapshot([localRow], nowIso);
    expect(local.rows[0].uploadedCoordinate?.policy.displaySurfaces).toContain(
      "MAPLIBRE",
    );
    expect(local.rows[0].customerCorrection).toBeNull();
    const merged = mergeProviderResponses(
      local,
      [response],
      "2026-08-03T12:01:00.000Z",
    );
    expect(merged.rows[0].uploadedCoordinate).toEqual(
      local.rows[0].uploadedCoordinate,
    );
    expect(merged.rows[0].candidates).toHaveLength(1);
    expect(merged.id).not.toBe(local.id);
  });
});
