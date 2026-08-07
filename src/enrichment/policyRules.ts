import type {
  AllowedPurpose,
  DisplaySurface,
  EnrichedField,
  EnrichedFieldPolicy,
} from "@/contracts/enrichment";

export function isExpired<T>(field: EnrichedField<T>, now: Date): boolean {
  return (
    field.policy.persistence.kind === "DELETE_AT" &&
    new Date(field.policy.persistence.expiresAt).getTime() <= now.getTime()
  );
}

function isApprovedGoogleDerivedValue(policy: EnrichedFieldPolicy): boolean {
  return (
    policy.sourceProduct === "google.places-aggregate.v1" &&
    policy.contentClass === "GOOGLE_POI_COUNT" &&
    policy.persistence.kind === "APPROVED_DERIVED_VALUE" &&
    Boolean(policy.legalApprovalId) &&
    policy.persistence.approvalId === policy.legalApprovalId
  );
}

export function isRendererEligible<T>(
  field: EnrichedField<T>,
  surface: DisplaySurface,
  now: Date,
): boolean {
  const policy = field.policy;
  if (isExpired(field, now) || !policy.displaySurfaces.includes(surface))
    return false;
  if (surface === "MAPLIBRE" && policy.sourceProduct.startsWith("google.")) {
    return isApprovedGoogleDerivedValue(policy);
  }
  if (
    surface === "MAPLIBRE" &&
    policy.contentClass === "GOOGLE_MAPS_CONTENT"
  ) {
    return false;
  }
  if (policy.contentClass === "GOOGLE_MAPS_CONTENT" && !policy.attributionId) {
    return false;
  }
  return true;
}

export function canProjectField<T>(
  field: EnrichedField<T>,
  surface: DisplaySurface,
  purpose: AllowedPurpose,
  now: Date,
): boolean {
  const policy = field.policy;
  if (!isRendererEligible(field, surface, now)) return false;
  if (!policy.allowedPurposes.includes(purpose)) return false;
  return true;
}
