import {
  enrichmentSource,
  type CommercialUseStatus,
  type OpenEnrichmentSource,
} from "./sourceRegistry";

export type ArtifactLicenseOverride = {
  licenseId: string;
  attributionText: string;
  shareAlike: boolean;
  commercialUseStatus: CommercialUseStatus;
  reviewedAt: string;
  reviewReference: string;
};

export type EnrichmentArtifactRegistration = {
  sourceId: string;
  sourceRelease: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  accessUri: string;
  storageUri: string;
  retrievedAt: string;
  licenseId: string;
  attributionText: string;
  shareAlike: boolean;
  commercialUseStatus: CommercialUseStatus;
  acquisitionMode: OpenEnrichmentSource["acquisitionMode"];
  metadata: Record<string, unknown>;
};

function exactProductLicenseRequired(source: OpenEnrichmentSource): boolean {
  return source.licenseId.includes("PRODUCT-SPECIFIC")
    || source.licenseId.includes("REVIEW-REQUIRED")
    || source.licenseId === "TERMS-REVIEW-REQUIRED";
}

function validSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}

function requiredText(value: string, code: string): string {
  const text = value.trim();
  if (!text) throw new Error(code);
  return text;
}

export function buildArtifactRegistration(input: {
  sourceId: string;
  sourceRelease: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  accessUri: string;
  storageUri: string;
  retrievedAt: string;
  metadata?: Record<string, unknown>;
  licenseOverride?: ArtifactLicenseOverride;
}): EnrichmentArtifactRegistration {
  const source = enrichmentSource(input.sourceId);
  if (!source.productionEnabled) throw new Error(`ENRICHMENT_SOURCE_NOT_PRODUCTION_ENABLED:${source.id}`);
  if (source.commercialUseStatus !== "permitted") {
    throw new Error(`ENRICHMENT_COMMERCIAL_USE_NOT_APPROVED:${source.id}`);
  }
  if (!validSha256(input.sha256)) throw new Error("INVALID_ENRICHMENT_ARTIFACT_SHA256");
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 0) {
    throw new Error("INVALID_ENRICHMENT_ARTIFACT_BYTE_SIZE");
  }
  const retrieved = new Date(input.retrievedAt);
  if (!Number.isFinite(retrieved.getTime())) throw new Error("INVALID_ENRICHMENT_RETRIEVED_AT");

  let licenseId = source.licenseId;
  let attributionText = source.attributionText;
  let shareAlike = source.shareAlike;
  let commercialUseStatus = source.commercialUseStatus;
  const metadata: Record<string, unknown> = {
    registrySourceTitle: source.title,
    registryDocumentationUri: source.documentationUri,
    featureLevelLicense: source.featureLevelLicense,
    ...input.metadata,
  };

  if (exactProductLicenseRequired(source)) {
    const override = input.licenseOverride;
    if (!override) throw new Error(`ENRICHMENT_ARTIFACT_LICENSE_REVIEW_REQUIRED:${source.id}`);
    if (override.commercialUseStatus !== "permitted") {
      throw new Error(`ENRICHMENT_ARTIFACT_COMMERCIAL_USE_NOT_APPROVED:${source.id}`);
    }
    licenseId = requiredText(override.licenseId, "ENRICHMENT_ARTIFACT_LICENSE_ID_REQUIRED");
    attributionText = requiredText(override.attributionText, "ENRICHMENT_ARTIFACT_ATTRIBUTION_REQUIRED");
    shareAlike = override.shareAlike;
    commercialUseStatus = override.commercialUseStatus;
    metadata.licenseReview = {
      reviewedAt: requiredText(override.reviewedAt, "ENRICHMENT_ARTIFACT_LICENSE_REVIEW_DATE_REQUIRED"),
      reviewReference: requiredText(override.reviewReference, "ENRICHMENT_ARTIFACT_LICENSE_REVIEW_REFERENCE_REQUIRED"),
    };
  }

  if (source.featureLevelLicense && metadata.featureLicensePreserved !== true) {
    throw new Error(`ENRICHMENT_FEATURE_LICENSE_PROVENANCE_REQUIRED:${source.id}`);
  }

  return {
    sourceId: source.id,
    sourceRelease: requiredText(input.sourceRelease, "ENRICHMENT_SOURCE_RELEASE_REQUIRED"),
    fileName: requiredText(input.fileName, "ENRICHMENT_FILE_NAME_REQUIRED"),
    contentType: requiredText(input.contentType, "ENRICHMENT_CONTENT_TYPE_REQUIRED"),
    byteSize: input.byteSize,
    sha256: input.sha256,
    accessUri: requiredText(input.accessUri, "ENRICHMENT_ACCESS_URI_REQUIRED"),
    storageUri: requiredText(input.storageUri, "ENRICHMENT_STORAGE_URI_REQUIRED"),
    retrievedAt: retrieved.toISOString(),
    licenseId,
    attributionText,
    shareAlike,
    commercialUseStatus,
    acquisitionMode: source.acquisitionMode,
    metadata,
  };
}
