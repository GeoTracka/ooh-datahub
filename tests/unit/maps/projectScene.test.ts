import { describe, expect, it } from "vitest";
import type { EnrichedFieldPolicy } from "@/contracts/enrichment";
import type { SpatialFeature } from "@/contracts/renderer";
import { projectGoogleScene, projectMapLibreScene } from "@/maps/projectScene";

const syntheticPolicy: EnrichedFieldPolicy = {
  sourceProduct: "synthetic",
  sourceField: "zone.center",
  contentClass: "CUSTOMER_VALUE",
  allowedPurposes: ["LIVE_DISPLAY_CONTEXT"],
  displaySurfaces: ["MAPLIBRE"],
  persistence: { kind: "NEVER" },
  policyVersion: "2026-08-03",
  receivedAt: "2026-08-03T12:00:00.000Z",
};
const googlePolicy: EnrichedFieldPolicy = {
  sourceProduct: "google.geocoding.v4",
  sourceField: "results.location",
  contentClass: "GOOGLE_MAPS_CONTENT",
  allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
  displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
  persistence: { kind: "DELETE_AT", expiresAt: "2026-09-02T12:00:00.000Z" },
  attributionId: "google-maps",
  policyVersion: "2026-08-03",
  receivedAt: "2026-08-03T12:00:00.000Z",
};

const features = [
  {
    id: "synthetic-zone",
    coordinateField: {
      value: { longitude: 3.37, latitude: 6.51 },
      policy: syntheticPolicy,
    },
  },
  {
    id: "google-geocode",
    coordinateField: {
      value: { longitude: 3.38, latitude: 6.52 },
      policy: googlePolicy,
    },
  },
  {
    id: "spoofed-google-maplibre",
    coordinateField: {
      value: { longitude: 3.39, latitude: 6.53 },
      policy: {
        ...googlePolicy,
        displaySurfaces: ["MAPLIBRE"] as EnrichedFieldPolicy["displaySurfaces"],
      },
    },
  },
  {
    id: "customer-correction",
    coordinateField: {
      value: { longitude: 3.40, latitude: 6.54 },
      policy: {
        ...syntheticPolicy,
        sourceProduct: "customer" as const,
        sourceField: "userCoordinateCorrection",
        contentClass: "CUSTOMER_INPUT" as const,
        allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
        displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION", "MAPLIBRE"],
        persistence: { kind: "CUSTOMER_POLICY" as const, policyId: "fixture-attestation" },
      },
    },
  },
  {
    id: "spoofed-google-places-maplibre",
    coordinateField: {
      value: { longitude: 3.41, latitude: 6.55 },
      policy: {
        ...syntheticPolicy,
        sourceProduct: "google.places-aggregate.v1" as const,
        sourceField: "aggregate.count",
        contentClass: "GOOGLE_POI_COUNT" as const,
        displaySurfaces: ["MAPLIBRE"],
      },
    },
  },
  {
    id: "approved-google-derived-maplibre",
    coordinateField: {
      value: { longitude: 3.42, latitude: 6.56 },
      policy: {
        ...syntheticPolicy,
        sourceProduct: "google.places-aggregate.v1" as const,
        sourceField: "aggregate.approvedCount",
        contentClass: "GOOGLE_POI_COUNT" as const,
        displaySurfaces: ["MAPLIBRE"],
        persistence: {
          kind: "APPROVED_DERIVED_VALUE" as const,
          approvalId: "places-maplibre-approval-1",
        },
        legalApprovalId: "places-maplibre-approval-1",
      },
    },
  },
] satisfies SpatialFeature[];

describe("scene projection", () => {
  it("uses explicit allowlists for MapLibre", () => {
    expect(projectMapLibreScene(features, new Date("2026-08-04T00:00:00Z")).features.map((item) => item.id))
      .toEqual([
        "synthetic-zone",
        "customer-correction",
        "approved-google-derived-maplibre",
      ]);
  });

  it("keeps Google content and attribution in the Google scene", () => {
    const scene = projectGoogleScene(features, new Date("2026-08-04T00:00:00Z"));
    expect(scene.features.map((item) => item.id)).toEqual([
      "google-geocode",
      "customer-correction",
    ]);
    expect(scene.attributionIds).toEqual(["google-maps"]);
  });

  it("removes an expired field even when the caller asks for its surface", () => {
    expect(projectGoogleScene(
      features,
      new Date("2026-09-03T00:00:00Z"),
    ).features.map((item) => item.id)).toEqual(["customer-correction"]);
  });
});
