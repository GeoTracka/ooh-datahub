export type DisplaySurface = "GOOGLE_MAP" | "NO_MAP_WITH_ATTRIBUTION" | "MAPLIBRE";
export type AllowedPurpose =
  | "LIVE_DISPLAY_CONTEXT"
  | "GEOCODE_REVIEW"
  | "CUSTOMER_VALUE_INPUT"
  | "CALIBRATION_INPUT";

export type EnrichedFieldPolicy = {
  sourceProduct:
    | "google.geocoding.v4"
    | "google.places-aggregate.v1"
    | "customer"
    | "open"
    | "synthetic";
  sourceField: string;
  contentClass:
    | "GOOGLE_MAPS_CONTENT"
    | "GOOGLE_POI_COUNT"
    | "CUSTOMER_VALUE"
    | "CUSTOMER_INPUT";
  allowedPurposes: AllowedPurpose[];
  displaySurfaces: DisplaySurface[];
  persistence:
    | { kind: "NEVER" }
    | { kind: "DELETE_AT"; expiresAt: string }
    | { kind: "INDEFINITE_PLACE_ID"; refreshDueAt?: string }
    | { kind: "CUSTOMER_POLICY"; policyId: string }
    | { kind: "APPROVED_DERIVED_VALUE"; approvalId: string };
  attributionId?: "google-maps";
  legalApprovalId?: string;
  policyVersion: string;
  receivedAt: string;
};

export type EnrichedField<T> = { value: T; policy: EnrichedFieldPolicy };

export type EnrichmentRow = {
  rowId: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  coordinateAccuracyM?: number;
  spatialLicenseId?: string;
  sourceArtifactId?: string;
  spatialRights:
    | "customer_captured"
    | "open_licensed"
    | "provider_derived"
    | "unknown";
  assetId?: string;
  supplier?: string;
  format?: string;
  rateNgn?: number;
};

export type GeocodeCandidate = {
  candidateToken: string;
  providerPlaceId: EnrichedField<string>;
  coordinate: EnrichedField<{ latitude: number; longitude: number }>;
  granularity: EnrichedField<
    | "ROOFTOP"
    | "RANGE_INTERPOLATED"
    | "GEOMETRIC_CENTER"
    | "APPROXIMATE"
    | "GRANULARITY_UNSPECIFIED"
  >;
  formattedAddress: EnrichedField<string>;
  resultTypes: EnrichedField<string[]>;
  quality: {
    resultOrdinal: number;
    resultCount: number;
    countryMatches: boolean;
    localityMatches: boolean | "NOT_CHECKED";
    viewportAmbiguous: boolean;
    partialMatch: "UNAVAILABLE_IN_V4";
  };
};

export type GeocodeResponse = {
  status: "NO_RESULTS" | "REVIEW_REQUIRED" | "PROVIDER_ERROR";
  candidates: GeocodeCandidate[];
};

export type EnrichmentSnapshotRow = {
  row: EnrichmentRow;
  candidates: GeocodeCandidate[];
  selectedCandidateToken: string | null;
  identityConfirmed: boolean;
  uploadedCoordinate:
    | EnrichedField<{
        latitude: number;
        longitude: number;
      }>
    | null;
  customerCorrection:
    | EnrichedField<{
        latitude: number;
        longitude: number;
      }>
    | null;
  modelEligible: false;
};

export type EnrichmentSnapshot = {
  id: string;
  dataRevision: string;
  createdAt: string;
  rows: EnrichmentSnapshotRow[];
};
