import type { PlanContextRevision } from "@/contracts/domain";
import type {
  EnrichedField,
  EnrichmentRow,
  EnrichmentSnapshot,
  EnrichmentSnapshotRow,
  GeocodeResponse,
} from "@/contracts/enrichment";
import { canProjectField } from "@/enrichment/policyRules";
import { resolveClaimLadder } from "@/planning/claimLadder";
import { canonicalJson } from "@/shared/canonicalJson";

function jsonSafe(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => item === undefined ? null : jsonSafe(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, jsonSafe(item)]),
    );
  }
  return value;
}

function stableId(value: unknown): string {
  let hash = 0x811c9dc5;
  for (const character of canonicalJson(jsonSafe(value))) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function versionSnapshot(
  createdAt: string,
  rows: EnrichmentSnapshotRow[],
): EnrichmentSnapshot {
  const digest = stableId({ createdAt, rows });
  return {
    id: "enrichment-" + digest,
    dataRevision: "upload-" + digest,
    createdAt,
    rows,
  };
}

export function createLocalEnrichmentSnapshot(
  rows: EnrichmentRow[],
  createdAt: string,
): EnrichmentSnapshot {
  return versionSnapshot(
    createdAt,
    rows.map((row) => {
      const hasCoordinate =
        Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
      const eligibleRights =
        (row.spatialRights === "customer_captured" ||
          row.spatialRights === "open_licensed") &&
        Boolean(row.spatialLicenseId) &&
        Boolean(row.sourceArtifactId);
      const uploadedCoordinate: EnrichmentSnapshotRow["uploadedCoordinate"] =
        hasCoordinate && eligibleRights
          ? {
              value: {
                latitude: row.latitude!,
                longitude: row.longitude!,
              },
              policy: {
                sourceProduct:
                  row.spatialRights === "open_licensed" ? "open" : "customer",
                sourceField: "uploadedCoordinate/" + row.sourceArtifactId,
                contentClass:
                  row.spatialRights === "open_licensed"
                    ? "CUSTOMER_VALUE"
                    : "CUSTOMER_INPUT",
                allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
                displaySurfaces: [
                  "GOOGLE_MAP",
                  "NO_MAP_WITH_ATTRIBUTION",
                  "MAPLIBRE",
                ],
                persistence: {
                  kind: "CUSTOMER_POLICY",
                  policyId: row.spatialLicenseId!,
                },
                legalApprovalId: row.spatialLicenseId,
                policyVersion: "2026-08-03",
                receivedAt: createdAt,
              },
            }
          : null;
      return {
        row,
        candidates: [],
        selectedCandidateToken: null,
        identityConfirmed: false,
        uploadedCoordinate,
        customerCorrection: null,
        modelEligible: false as const,
      };
    }),
  );
}

export function mergeProviderResponses(
  localSnapshot: EnrichmentSnapshot,
  responses: GeocodeResponse[],
  createdAt: string,
): EnrichmentSnapshot {
  if (localSnapshot.rows.length !== responses.length) {
    throw new Error("ENRICHMENT_ROW_COUNT_MISMATCH");
  }
  return versionSnapshot(
    createdAt,
    localSnapshot.rows.map((item, index) => ({
      ...item,
      candidates: responses[index].candidates,
      selectedCandidateToken: null,
    })),
  );
}

export function normalizeEnrichmentSnapshot(
  rows: EnrichmentRow[],
  responses: GeocodeResponse[],
  createdAt: string,
): EnrichmentSnapshot {
  return mergeProviderResponses(
    createLocalEnrichmentSnapshot(rows, createdAt),
    responses,
    createdAt,
  );
}

export function confirmGeocodeIdentity(
  snapshot: EnrichmentSnapshot,
  rowId: string,
  candidateToken: string,
): EnrichmentSnapshot {
  return versionSnapshot(
    snapshot.createdAt,
    snapshot.rows.map((item) => {
      if (item.row.rowId !== rowId) return item;
      if (
        !item.candidates.some(
          (candidate) => candidate.candidateToken === candidateToken,
        )
      ) {
        throw new Error("UNKNOWN_GEOCODE_CANDIDATE");
      }
      return {
        ...item,
        selectedCandidateToken: candidateToken,
        identityConfirmed: true,
        modelEligible: false as const,
      };
    }),
  );
}

export function correctCoordinate(
  snapshot: EnrichmentSnapshot,
  rowId: string,
  coordinate: { latitude: number; longitude: number },
  correctionSourceId: string,
): EnrichmentSnapshot {
  const correction: EnrichedField<typeof coordinate> = {
    value: coordinate,
    policy: {
      sourceProduct: "customer",
      sourceField: "userCoordinateCorrection",
      contentClass: "CUSTOMER_INPUT",
      allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
      displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION", "MAPLIBRE"],
      persistence: { kind: "CUSTOMER_POLICY", policyId: correctionSourceId },
      legalApprovalId: correctionSourceId,
      policyVersion: "2026-08-03",
      receivedAt: snapshot.createdAt,
    },
  };
  return versionSnapshot(
    snapshot.createdAt,
    snapshot.rows.map((item) =>
      item.row.rowId === rowId
        ? {
            ...item,
            customerCorrection: correction,
            modelEligible: false as const,
          }
        : item,
    ),
  );
}

export type UploadPlanningDraft = PlanContextRevision;

function selectedContextCoordinate(
  item: EnrichmentSnapshotRow,
): PlanContextRevision["selectedRows"][number]["coordinate"] {
  const confirmedCandidate = item.identityConfirmed
    ? (item.candidates.find(
        (candidate) =>
          candidate.candidateToken === item.selectedCandidateToken,
      ) ?? null)
    : null;
  const field =
    item.customerCorrection ??
    item.uploadedCoordinate ??
    confirmedCandidate?.coordinate ??
    null;
  if (!field) return null;
  const provider = field.policy.sourceProduct.startsWith("google")
    ? ("google" as const)
    : field.policy.sourceProduct.startsWith("mapbox")
      ? ("mapbox" as const)
      : ("customer" as const);
  const surface = provider === "google" ? "GOOGLE_MAP" : "MAPLIBRE";
  if (
    !canProjectField(field, surface, "LIVE_DISPLAY_CONTEXT", new Date(field.policy.receivedAt))
  ) {
    return null;
  }
  const license =
    field.policy.legalApprovalId ??
    (field.policy.persistence.kind === "CUSTOMER_POLICY"
      ? field.policy.persistence.policyId
      : field.policy.attributionId) ??
    "display-only/" + field.policy.policyVersion;
  return {
    value: [field.value.longitude, field.value.latitude],
    provider,
    accuracy:
      confirmedCandidate?.granularity.value ??
      (item.row.coordinateAccuracyM
        ? "customer-accuracy-" + item.row.coordinateAccuracyM + "m"
        : "customer-supplied"),
    license,
    sourceArtifactId: item.row.sourceArtifactId ?? field.policy.sourceField,
  };
}

export function applyUploadToDraft(
  snapshot: EnrichmentSnapshot,
  selectedRowIds: string[],
): UploadPlanningDraft {
  if (selectedRowIds.length === 0 || selectedRowIds.length > 50) {
    throw new Error("SELECT_1_TO_50_ROWS");
  }
  const known = new Set(snapshot.rows.map((item) => item.row.rowId));
  if (selectedRowIds.some((rowId) => !known.has(rowId))) {
    throw new Error("UNKNOWN_SELECTED_ROW");
  }
  const selectedRows = snapshot.rows.filter((item) =>
    selectedRowIds.includes(item.row.rowId),
  );
  const geocode = selectedRows.every(
    (item) => item.customerCorrection || item.uploadedCoordinate,
  )
    ? "precise"
    : selectedRows.some((item) => item.candidates.length > 0)
      ? "low_precision"
      : "unknown";
  const claimResolution = resolveClaimLadder({
    geocode,
    fallbackFacts: "uploaded",
    runtimeFailure: "none",
    calibration: "bundle_mismatch",
    activityPotentialAvailable: false,
    movementAvailable: false,
    movementUnit: null,
    personConversionAvailable: false,
    orientationAvailable: false,
    viewZoneAvailable: false,
    schedule: "missing",
    visibilityAndDeliveryAvailable: false,
    targetUniverseAvailable: false,
    targetAllocationAvailable: false,
    overlap: "missing",
    qiAvailable: false,
  });
  const selectedContextRows = selectedRows
    .map((item) => ({
      rowId: item.row.rowId,
      assetId: item.row.assetId ?? item.row.rowId,
      supplier: item.row.supplier ?? null,
      address: item.row.address ?? null,
      format: item.row.format ?? null,
      rateNgn: item.row.rateNgn ?? null,
      orientation: item.row.orientation ?? null,
      coordinate: selectedContextCoordinate(item),
    }))
    .sort((left, right) => left.rowId.localeCompare(right.rowId));
  const fingerprint =
    "context-selection-v1|" +
    canonicalJson({
      snapshotId: snapshot.id,
      dataRevision: snapshot.dataRevision,
      selectedRows: selectedContextRows,
    });
  return {
    mode: "context_shortlist",
    decisionUse: "context_only",
    selectedRowIds: [...selectedRowIds].sort(),
    selectedRows: selectedContextRows,
    enrichmentSnapshotId: snapshot.id,
    dataRevision: snapshot.dataRevision,
    fingerprint,
    claimResolution,
    planningFit: null,
  };
}
