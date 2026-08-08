import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { PlanningResult } from "@/contracts/domain";

function haversineKm(
  left: [number, number],
  right: [number, number],
): number {
  const radiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const [leftLon, leftLat] = left;
  const [rightLon, rightLat] = right;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLon = toRadians(rightLon - leftLon);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(leftLat)) * Math.cos(toRadians(rightLat)) *
    Math.sin(deltaLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizeFormat(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("digital") || normalized === "dooh") return "dooh";
  if (normalized.includes("static")) return "static";
  return normalized;
}

export type UploadedContextComparison = {
  rowId: string;
  assetId: string;
  supplier: string | null;
  address: string | null;
  format: string | null;
  rateNgn: number | null;
  nearestSelectedZone: { id: string; label: string; distanceKm: number } | null;
  formatFit: "matches_package" | "new_format" | "unknown";
  rateDeltaPercent: number | null;
  metadataCompleteness: number;
  decisionUse: "context_only";
  deliveryEligible: false;
};

export function selectUploadedContextComparisons(
  bundle: FrozenBundle,
  plan: PlanningResult,
): UploadedContextComparison[] {
  const revision = plan.contextRevision;
  if (!revision) return [];

  const selectedSites = plan.recommended.siteIds.flatMap((siteId) => {
    const site = bundle.sites.find((candidate) => candidate.id === siteId);
    return site ? [site] : [];
  });
  const selectedFormats = new Set(selectedSites.map((site) => normalizeFormat(site.format)));
  const medianRate = median(selectedSites.map((site) => site.rateNgn));
  const selectedZones = plan.selectedZoneIds.flatMap((zoneId) => {
    const zone = bundle.zones.find((candidate) => candidate.id === zoneId);
    return zone ? [zone] : [];
  });

  const rows = revision.selectedRows.map((row): UploadedContextComparison => {
    const nearestSelectedZone = row.coordinate && selectedZones.length > 0
      ? selectedZones
          .map((zone) => ({
            id: zone.id,
            label: zone.label,
            distanceKm: haversineKm(row.coordinate!.value, zone.center),
          }))
          .sort((left, right) => left.distanceKm - right.distanceKm ||
            left.id.localeCompare(right.id))[0]
      : null;
    const normalizedFormat = normalizeFormat(row.format);
    const formatFit = normalizedFormat === null
      ? "unknown" as const
      : selectedFormats.has(normalizedFormat)
        ? "matches_package" as const
        : "new_format" as const;
    const rateDeltaPercent = row.rateNgn === null || medianRate === null || medianRate === 0
      ? null
      : 100 * (row.rateNgn - medianRate) / medianRate;
    const metadataFields = [
      row.supplier,
      row.address,
      row.format,
      row.rateNgn,
      row.coordinate,
    ];
    const metadataCompleteness = metadataFields
      .filter((value) => value !== null && value !== undefined && value !== "")
      .length / metadataFields.length;

    return {
      rowId: row.rowId,
      assetId: row.assetId,
      supplier: row.supplier,
      address: row.address,
      format: row.format,
      rateNgn: row.rateNgn,
      nearestSelectedZone,
      formatFit,
      rateDeltaPercent,
      metadataCompleteness,
      decisionUse: "context_only",
      deliveryEligible: false,
    };
  });

  return rows.sort((left, right) => {
    const leftDistance = left.nearestSelectedZone?.distanceKm ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.nearestSelectedZone?.distanceKm ?? Number.POSITIVE_INFINITY;
    return Number(Boolean(right.nearestSelectedZone)) - Number(Boolean(left.nearestSelectedZone)) ||
      leftDistance - rightDistance ||
      Number(right.formatFit === "matches_package") - Number(left.formatFit === "matches_package") ||
      left.assetId.localeCompare(right.assetId);
  });
}
