import type { MetricClaim } from "@/contracts/metrics";

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
    unitLabel = "people · Low / Base / High scenario";
  } else if (claim.kind === "calibrated_target_reach") {
    valueText = [claim.range.p10, claim.range.p50, claim.range.p90].map(compact).join(" / ");
    unitLabel = "people · P10 / P50 / P90";
  } else if (
    claim.kind === "influence_capture" ||
    claim.kind === "influence_weighted_coverage"
  ) {
    const values = claim.range.type === "scenario"
      ? [claim.range.low, claim.range.base, claim.range.high]
      : [claim.range.p10, claim.range.p50, claim.range.p90];
    valueText = values.map((value) => Math.round(value) + "%").join(" / ");
    unitLabel = claim.range.type === "scenario"
      ? "percent · Low / Base / High scenario"
      : "percent · P10 / P50 / P90";
  } else if ("value" in claim) {
    valueText = compact(claim.value);
  } else {
    valueText = "Unavailable";
    unitLabel = "none";
  }
  return {
    label: claim.label,
    valueText,
    unitLabel,
    evidenceLabel: "Evidence " + claim.evidence,
    stateLabel: claim.state,
    caveats: claim.caveats,
    recoveryAction,
  };
}
