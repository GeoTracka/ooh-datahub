export type SpatialRights =
  | "customer_captured"
  | "open_licensed"
  | "provider_derived"
  | "unknown";

export type MappedInventoryRow = {
  assetId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  coordinateAccuracyM?: number;
  supplier?: string;
  format?: string;
  rate?: number;
  orientation?: string;
  spatialRights?: SpatialRights;
  spatialLicenseId?: string;
  sourceArtifactId?: string;
  personName?: string;
  extras?: Record<string, unknown>;
};

export type ValidatedInventoryRow = MappedInventoryRow & {
  assetId: string;
  spatialRights: SpatialRights;
  modelEligible: boolean;
  mapLibreEligible: boolean;
  warningCodes: string[];
};

export function validateMappedRows(rows: MappedInventoryRow[]) {
  const accepted: ValidatedInventoryRow[] = [];
  const rejected: { row: MappedInventoryRow; reasonCodes: string[] }[] = [];
  const quarantined: { row: MappedInventoryRow; reasonCodes: string[] }[] = [];

  for (const row of rows) {
    const sensitiveExtra = Object.keys(row.extras ?? {}).some((key) =>
      /religion|health|ethnicity|political|biometric|national.?id|phone|email/i.test(key),
    );
    const privateResidentialAddress = /\b(private home|residential apartment|residential flat)\b/i
      .test(row.address ?? "");
    if (row.personName?.trim() || sensitiveExtra || privateResidentialAddress) {
      quarantined.push({ row, reasonCodes: ["APPARENT_PERSONAL_DATA"] });
      continue;
    }
    const hasCoordinate =
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude);
    const hasAddress = Boolean(row.address?.trim());
    const reasons: string[] = [];
    if (!row.assetId?.trim()) reasons.push("MISSING_ASSET_ID");
    if (!hasCoordinate && !hasAddress) reasons.push("MISSING_LOCATION");
    if (reasons.length > 0) {
      rejected.push({ row, reasonCodes: reasons });
      continue;
    }
    const spatialRights = row.spatialRights ?? "unknown";
    const eligibleCustomerSpatial =
      spatialRights === "customer_captured" ||
      spatialRights === "open_licensed";
    const spatialLicenseId = row.spatialLicenseId?.trim();
    const sourceArtifactId = row.sourceArtifactId?.trim();
    accepted.push({
      ...row,
      assetId: row.assetId!.trim(),
      spatialRights,
      spatialLicenseId,
      sourceArtifactId,
      modelEligible: false,
      mapLibreEligible: eligibleCustomerSpatial && hasCoordinate &&
        Boolean(spatialLicenseId) && Boolean(sourceArtifactId),
      warningCodes: [
        ...(spatialRights === "unknown" ? ["UNKNOWN_SPATIAL_PROVENANCE"] : []),
        ...(eligibleCustomerSpatial && hasCoordinate && !spatialLicenseId
          ? ["SPATIAL_LICENSE_OR_ATTESTATION_REQUIRED"]
          : []),
        ...(eligibleCustomerSpatial && hasCoordinate && !sourceArtifactId
          ? ["SOURCE_ARTIFACT_ID_REQUIRED"]
          : []),
        ...(hasCoordinate && !Number.isFinite(row.coordinateAccuracyM)
          ? ["COORDINATE_ACCURACY_UNDECLARED"]
          : []),
      ],
    });
  }
  return { accepted, rejected, quarantined };
}

export function selectRowsForEnrichment(
  accepted: ValidatedInventoryRow[],
  selectedAssetIds: string[],
): ValidatedInventoryRow[] {
  if (selectedAssetIds.length > 50) throw new Error("MAX_50_SELECTED_ROWS");
  const selected = new Set(selectedAssetIds);
  const rows = accepted.filter((row) => selected.has(row.assetId));
  if (rows.length !== selected.size) throw new Error("UNKNOWN_SELECTED_ASSET");
  return rows;
}
