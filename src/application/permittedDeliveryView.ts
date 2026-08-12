import type { MetricClaim } from "@/contracts/metrics";
import { PUBLIC_COPY, confidenceLabel } from "@/content/plainLanguage";

function compact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

export type PermittedDeliveryView = {
  label: string;
  valueText: string;
  unitLabel: string;
  evidenceLabel: string;
  stateLabel: string;
  caveats: string[];
  recoveryAction: string | null;
};

export function selectPermittedDeliveryView(
  claim: MetricClaim,
  recoveryAction: string | null = null,
): PermittedDeliveryView {
  let valueText: string;
  let unitLabel: string = claim.unit;
  if (claim.kind === "scenario_target_reach") {
    valueText = [claim.range.low, claim.range.base, claim.range.high].map(compact).join(" / ");
    unitLabel = "people · Lower / Expected / Upper";
  } else if (claim.kind === "calibrated_target_reach") {
    valueText = [claim.range.p10, claim.range.p50, claim.range.p90].map(compact).join(" / ");
    unitLabel = "people · Lower / Expected / Upper";
  } else if (
    claim.kind === "influence_capture" ||
    claim.kind === "influence_weighted_coverage"
  ) {
    const values = claim.range.type === "scenario"
      ? [claim.range.low, claim.range.base, claim.range.high]
      : [claim.range.p10, claim.range.p50, claim.range.p90];
    valueText = values.map((value) => Math.round(value) + "%").join(" / ");
    unitLabel = claim.range.type === "scenario"
      ? "percent · Lower / Expected / Upper"
      : "percent · Lower / Expected / Upper";
  } else if ("value" in claim) {
    valueText = compact(claim.value);
    unitLabel = claim.kind === "activity_potential"
      ? "score out of 100"
      : claim.kind === "movement"
        ? "people passing"
        : claim.kind === "general_ots" || claim.kind === "target_ots"
          ? "possible ad views"
          : "Value";
  } else {
    valueText = "Unavailable";
    unitLabel = "No estimate";
  }
  return {
    label: claim.kind === "scenario_target_reach" || claim.kind === "calibrated_target_reach"
      ? PUBLIC_COPY.metrics.estimatedReach
      : claim.kind === "influence_capture" || claim.kind === "influence_weighted_coverage"
        ? PUBLIC_COPY.metrics.priorityAudienceCoverage
        : claim.kind === "activity_potential"
          ? PUBLIC_COPY.metrics.areaActivity
          : claim.label,
    valueText,
    unitLabel,
    evidenceLabel: confidenceLabel(claim.evidence),
    stateLabel: claim.state === "unavailable"
      ? "Unavailable"
      : claim.state === "modelled"
        ? "Calculated estimate"
        : "Planning estimate",
    caveats: claim.caveats,
    recoveryAction,
  };
}
