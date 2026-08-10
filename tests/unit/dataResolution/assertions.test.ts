import { describe, expect, it } from "vitest";
import {
  validateAirportOverride,
  validateCoordinateAssertion,
  validateMediaOwnerAssertion,
} from "../../../src/dataResolution/assertions";
import { validateSiteIdentityDecision } from "../../../src/dataResolution/siteDecision";

describe("resolution assertions", () => {
  it("permits approved customer/open coordinates only with accuracy + evidence", () => {
    const assertion = validateCoordinateAssertion({
      siteId: "site:fixture",
      latitude: 6.6018,
      longitude: 3.3515,
      coordinateAccuracyM: 5,
      sourceKind: "field_survey",
      coordinateSourceId: "survey:2026-08",
      sourceArtifactId: "survey-file:123",
      spatialRights: "customer_captured",
      spatialLicenseId: "attestation:123",
      assertionStatus: "approved",
      enrichmentRevision: "survey-r1",
    });
    expect(assertion.rendererEligibility).toBe("maplibre");
    expect(assertion.planningUse).toBe("context_only");
    expect(assertion.assertionId).toMatch(/^coordinate:/);

    expect(() => validateCoordinateAssertion({
      ...assertion,
      assertionId: undefined,
      spatialRights: "unknown",
    })).toThrow("UNKNOWN_SPATIAL_RIGHTS_CANNOT_BE_APPROVED");
  });

  it("keeps provider-derived approved coordinates provider-only and context-only", () => {
    const assertion = validateCoordinateAssertion({
      siteId: "site:fixture",
      latitude: 6.6,
      longitude: 3.35,
      coordinateAccuracyM: 20,
      sourceKind: "licensed_provider",
      coordinateSourceId: "provider:geocode:abc",
      sourceArtifactId: "provider-record:abc",
      spatialRights: "provider_derived",
      assertionStatus: "approved",
      enrichmentRevision: "provider-r1",
    });
    expect(assertion.rendererEligibility).toBe("provider_only");
    expect(assertion.planningUse).toBe("context_only");
  });

  it("keeps unknown rights non-renderable when still pending", () => {
    const assertion = validateCoordinateAssertion({
      siteId: "site:fixture",
      latitude: 6.6,
      longitude: 3.35,
      sourceKind: "open_dataset",
      coordinateSourceId: "unreviewed-dataset",
      spatialRights: "unknown",
      assertionStatus: "pending",
      enrichmentRevision: "review-r1",
    });
    expect(assertion.rendererEligibility).toBe("none");
  });

  it("requires source artifact evidence for every approved coordinate", () => {
    expect(() => validateCoordinateAssertion({
      siteId: "site:fixture",
      latitude: 6.6,
      longitude: 3.35,
      coordinateAccuracyM: 10,
      sourceKind: "open_dataset",
      coordinateSourceId: "open-dataset",
      spatialRights: "open_licensed",
      spatialLicenseId: "ODbL",
      assertionStatus: "approved",
      enrichmentRevision: "r1",
    })).toThrow("APPROVED_COORDINATE_SOURCE_ARTIFACT_REQUIRED");
  });

  it("rejects source-kind / rights mismatches before persistence", () => {
    expect(() => validateCoordinateAssertion({
      siteId: "site:fixture",
      latitude: 6.6,
      longitude: 3.35,
      sourceKind: "licensed_provider",
      coordinateSourceId: "provider",
      spatialRights: "open_licensed",
      assertionStatus: "pending",
      enrichmentRevision: "r1",
    })).toThrow("OPEN_LICENSED_RIGHTS_REQUIRE_OPEN_DATASET");
    expect(() => validateCoordinateAssertion({
      siteId: "site:fixture",
      latitude: 6.6,
      longitude: 3.35,
      sourceKind: "open_dataset",
      coordinateSourceId: "dataset",
      spatialRights: "provider_derived",
      assertionStatus: "pending",
      enrichmentRevision: "r1",
    })).toThrow("PROVIDER_DERIVED_RIGHTS_REQUIRE_LICENSED_PROVIDER");
  });

  it("makes owner identity stable across registry revisions while evidence remains versioned", () => {
    const owner = validateMediaOwnerAssertion({
      siteId: "site:fixture",
      ownerName: "Example Media Ltd.",
      registryNamespace: "ooh-registry",
      registryRevision: "2026-08-10",
      evidenceSourceId: "registry-row:42",
      evidenceRevision: "rev-3",
      mappingMethod: "authoritative_registry",
      assertionStatus: "approved",
    });
    const laterRevision = validateMediaOwnerAssertion({
      siteId: "site:fixture-2",
      ownerName: "Example Media Ltd",
      registryNamespace: "ooh-registry",
      registryRevision: "2026-09-01",
      evidenceSourceId: "registry-row:99",
      evidenceRevision: "rev-4",
      mappingMethod: "authoritative_registry",
      assertionStatus: "approved",
    });
    expect(owner.normalizedKey).toBe("example media ltd");
    expect(owner.ownerId).toMatch(/^owner:/);
    expect(laterRevision.ownerId).toBe(owner.ownerId);
    expect(laterRevision.aliasId).not.toBe(owner.aliasId);

    const airport = validateAirportOverride({
      sourceLiteral: "Nnamdi Azikwe International Airport",
      targetAirportId: "airport:canonical",
      evidenceSourceId: "review:airports",
      evidenceRevision: "r2",
    });
    expect(airport.normalizedKey).toBe("nnamdi azikwe international airport");

    const decision = validateSiteIdentityDecision({
      siteId: "site:fixture",
      decisionStatus: "confirmed",
      decisionMethod: "field_verification",
      evidenceSourceId: "survey:site-1",
      evidenceRevision: "r1",
    });
    expect(decision.decisionId).toMatch(/^site-decision:/);
  });
});
