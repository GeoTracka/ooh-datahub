import { z } from "zod";
import {
  coordinateAssertionId,
  mediaOwnerId,
  normalizeEntityLiteral,
  stableResolutionId,
} from "./normalize";

const SpatialRightsSchema = z.enum([
  "customer_captured",
  "open_licensed",
  "provider_derived",
  "unknown",
]);

const CoordinateAssertionInputSchema = z.object({
  siteId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  coordinateAccuracyM: z.number().nonnegative().nullable().optional(),
  sourceKind: z.enum(["customer_capture", "field_survey", "open_dataset", "licensed_provider"]),
  coordinateSourceId: z.string().min(1),
  sourceArtifactId: z.string().min(1).nullable().optional(),
  spatialRights: SpatialRightsSchema,
  spatialLicenseId: z.string().min(1).nullable().optional(),
  assertionStatus: z.enum(["pending", "approved", "rejected", "revoked"]),
  enrichmentRevision: z.string().min(1),
});

export type CoordinateAssertionInput = z.input<typeof CoordinateAssertionInputSchema>;

export type ValidCoordinateAssertion = {
  assertionId: string;
  siteId: string;
  latitude: number;
  longitude: number;
  coordinateAccuracyM: number | null;
  sourceKind: "customer_capture" | "field_survey" | "open_dataset" | "licensed_provider";
  coordinateSourceId: string;
  sourceArtifactId: string | null;
  spatialRights: "customer_captured" | "open_licensed" | "provider_derived" | "unknown";
  spatialLicenseId: string | null;
  assertionStatus: "pending" | "approved" | "rejected" | "revoked";
  rendererEligibility: "maplibre" | "provider_only" | "none";
  planningUse: "context_only";
  enrichmentRevision: string;
};

function assertSourceRightsAlignment(
  sourceKind: ValidCoordinateAssertion["sourceKind"],
  spatialRights: ValidCoordinateAssertion["spatialRights"],
  assertionStatus: ValidCoordinateAssertion["assertionStatus"],
): void {
  if (
    spatialRights === "customer_captured"
    && sourceKind !== "customer_capture"
    && sourceKind !== "field_survey"
  ) {
    throw new Error("CUSTOMER_CAPTURED_RIGHTS_REQUIRE_CAPTURE_OR_FIELD_SURVEY");
  }
  if (spatialRights === "open_licensed" && sourceKind !== "open_dataset") {
    throw new Error("OPEN_LICENSED_RIGHTS_REQUIRE_OPEN_DATASET");
  }
  if (spatialRights === "provider_derived" && sourceKind !== "licensed_provider") {
    throw new Error("PROVIDER_DERIVED_RIGHTS_REQUIRE_LICENSED_PROVIDER");
  }
  if (spatialRights === "unknown" && assertionStatus === "approved") {
    throw new Error("UNKNOWN_SPATIAL_RIGHTS_CANNOT_BE_APPROVED");
  }
}

export function validateCoordinateAssertion(input: unknown): ValidCoordinateAssertion {
  const parsed = CoordinateAssertionInputSchema.parse(input);
  assertSourceRightsAlignment(parsed.sourceKind, parsed.spatialRights, parsed.assertionStatus);
  const coordinateAccuracyM = parsed.coordinateAccuracyM ?? null;
  const sourceArtifactId = parsed.sourceArtifactId?.trim() || null;
  const spatialLicenseId = parsed.spatialLicenseId?.trim() || null;
  let rendererEligibility: ValidCoordinateAssertion["rendererEligibility"] = "none";

  if (parsed.assertionStatus === "approved") {
    if (coordinateAccuracyM === null) throw new Error("APPROVED_COORDINATE_ACCURACY_REQUIRED");
    if (!sourceArtifactId) throw new Error("APPROVED_COORDINATE_SOURCE_ARTIFACT_REQUIRED");
    if (parsed.spatialRights === "customer_captured" || parsed.spatialRights === "open_licensed") {
      if (!spatialLicenseId) throw new Error("APPROVED_MAPLIBRE_SPATIAL_LICENSE_REQUIRED");
      rendererEligibility = "maplibre";
    } else if (parsed.spatialRights === "provider_derived") {
      rendererEligibility = "provider_only";
    }
  }

  return {
    assertionId: coordinateAssertionId({
      siteId: parsed.siteId,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      coordinateSourceId: parsed.coordinateSourceId,
      sourceArtifactId,
      enrichmentRevision: parsed.enrichmentRevision,
    }),
    siteId: parsed.siteId,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    coordinateAccuracyM,
    sourceKind: parsed.sourceKind,
    coordinateSourceId: parsed.coordinateSourceId,
    sourceArtifactId,
    spatialRights: parsed.spatialRights,
    spatialLicenseId,
    assertionStatus: parsed.assertionStatus,
    rendererEligibility,
    planningUse: "context_only",
    enrichmentRevision: parsed.enrichmentRevision,
  };
}

const MediaOwnerAssertionInputSchema = z.object({
  siteId: z.string().min(1),
  ownerName: z.string().min(1),
  sourceLiteral: z.string().min(1).optional(),
  registryNamespace: z.string().min(1),
  registryRevision: z.string().min(1),
  evidenceSourceId: z.string().min(1),
  evidenceRevision: z.string().min(1),
  mappingMethod: z.enum(["authoritative_registry", "supplier_attestation", "manual_review"]),
  assertionStatus: z.enum(["approved", "revoked"]),
});

export type ValidMediaOwnerAssertion = {
  assertionId: string;
  ownerId: string;
  canonicalName: string;
  normalizedKey: string;
  sourceLiteral: string;
  aliasId: string;
  siteId: string;
  registryNamespace: string;
  registryRevision: string;
  evidenceSourceId: string;
  evidenceRevision: string;
  mappingMethod: "authoritative_registry" | "supplier_attestation" | "manual_review";
  assertionStatus: "approved" | "revoked";
};

export function validateMediaOwnerAssertion(input: unknown): ValidMediaOwnerAssertion {
  const parsed = MediaOwnerAssertionInputSchema.parse(input);
  const normalizedKey = normalizeEntityLiteral(parsed.ownerName);
  if (!normalizedKey) throw new Error("MEDIA_OWNER_NORMALIZED_KEY_REQUIRED");
  const canonicalName = parsed.ownerName.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const sourceLiteral = (parsed.sourceLiteral ?? canonicalName).normalize("NFKC").trim().replace(/\s+/gu, " ");
  const ownerId = mediaOwnerId(normalizedKey, parsed.registryNamespace);
  return {
    assertionId: stableResolutionId(
      "owner-assertion",
      parsed.siteId,
      parsed.evidenceSourceId,
      parsed.evidenceRevision,
    ),
    ownerId,
    canonicalName,
    normalizedKey,
    sourceLiteral,
    aliasId: stableResolutionId(
      "owner-alias",
      ownerId,
      sourceLiteral,
      parsed.evidenceSourceId,
      parsed.evidenceRevision,
    ),
    siteId: parsed.siteId,
    registryNamespace: parsed.registryNamespace,
    registryRevision: parsed.registryRevision,
    evidenceSourceId: parsed.evidenceSourceId,
    evidenceRevision: parsed.evidenceRevision,
    mappingMethod: parsed.mappingMethod,
    assertionStatus: parsed.assertionStatus,
  };
}

const AirportOverrideInputSchema = z.object({
  sourceLiteral: z.string().min(1),
  targetAirportId: z.string().min(1),
  evidenceSourceId: z.string().min(1),
  evidenceRevision: z.string().min(1),
});

export type ValidAirportOverride = {
  aliasId: string;
  sourceLiteral: string;
  normalizedKey: string;
  targetAirportId: string;
  evidenceSourceId: string;
  evidenceRevision: string;
};

export function validateAirportOverride(input: unknown): ValidAirportOverride {
  const parsed = AirportOverrideInputSchema.parse(input);
  const sourceLiteral = parsed.sourceLiteral.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const normalizedKey = normalizeEntityLiteral(sourceLiteral);
  if (!normalizedKey) throw new Error("AIRPORT_OVERRIDE_NORMALIZED_KEY_REQUIRED");
  return {
    aliasId: stableResolutionId(
      "airport-manual-alias",
      parsed.targetAirportId,
      normalizedKey,
      parsed.evidenceSourceId,
      parsed.evidenceRevision,
    ),
    sourceLiteral,
    normalizedKey,
    targetAirportId: parsed.targetAirportId,
    evidenceSourceId: parsed.evidenceSourceId,
    evidenceRevision: parsed.evidenceRevision,
  };
}
