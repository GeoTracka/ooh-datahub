import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Brief } from "@/contracts/domain";
import type { EstimatePackageResult } from "@/contracts/metrics";
import { objectiveDeliveryComparabilityKey } from "@/planning/fingerprint";
import {
  influenceInputsCompatible,
  reachInputsCompatible,
  serviceabilityInputsCompatible,
  targetProfileSourceIds,
} from "@/planning/sourceEligibility";
import { PUBLIC_COPY } from "@/content/plainLanguage";

type ObjectiveDeliveryBase = {
  objective: Brief["objective"];
  metric: "target_reach" | "influence_weighted_reached_mass" | "serviceable_target_reach";
  label: string;
  unit: "people" | "influence_weighted_people";
  sourceIds: string[];
};

export type ObjectiveDelivery = ObjectiveDeliveryBase & ({
  status: "eligible";
  range: { low: number; base: number; high: number };
  value: number;
  evidence: NonNullable<EstimatePackageResult["evidence"]["uniqueReach"]>;
  comparabilityKey: string;
  reasonCode: null;
  recoveryAction: null;
} | {
  status: "unavailable";
  range: null;
  value: null;
  evidence: null;
  comparabilityKey: null;
  reasonCode: string;
  recoveryAction: string;
});

export function resolveObjectiveDelivery(
  bundle: FrozenBundle,
  brief: Brief,
  measurement: EstimatePackageResult,
): ObjectiveDelivery {
  const label = brief.objective === "influential_core"
    ? PUBLIC_COPY.metrics.priorityAudienceReach
    : brief.objective === "near_conversion"
      ? PUBLIC_COPY.metrics.likelyCustomerReach
      : PUBLIC_COPY.metrics.estimatedReach;
  const unit = brief.objective === "influential_core"
    ? "influence_weighted_people" as const
    : "people" as const;
  const metric = brief.objective === "influential_core"
    ? "influence_weighted_reached_mass" as const
    : brief.objective === "near_conversion"
      ? "serviceable_target_reach" as const
      : "target_reach" as const;
  const unavailable = (
    reasonCode: string,
    recoveryAction: string,
  ): ObjectiveDelivery => ({
    status: "unavailable",
    objective: brief.objective,
    metric,
    label,
    unit,
    range: null,
    value: null,
    evidence: null,
    sourceIds: [],
    comparabilityKey: null,
    reasonCode,
    recoveryAction,
  });
  if (!reachInputsCompatible(bundle, brief)) {
    return unavailable(
      "TARGET_BASIS_INCOMPATIBLE",
      "Add current audience size and audience-mix data that works with this package.",
    );
  }
  if (
    !["scenario_target_reach", "calibrated_target_reach"].includes(
      measurement.claim.kind,
    ) ||
    measurement.evidence.uniqueReach === null
  ) {
    return unavailable(
      "UNIQUE_REACH_UNAVAILABLE",
      measurement.stages.find((stage) => stage.id === "unique")?.recoveryAction ??
        "Add the audience data needed to estimate unique reach.",
    );
  }
  const profileSourceIds = brief.objective === "influential_core"
    ? targetProfileSourceIds(bundle, brief.sector, "qiSourceId")
    : brief.objective === "near_conversion"
      ? targetProfileSourceIds(bundle, brief.sector, "serviceabilitySourceId")
      : [];
  const assumptionIds = brief.objective === "influential_core"
    ? [
        bundle.manifest.influenceLinkageAssumptionId,
        bundle.manifest.influenceSensitivityId,
      ]
    : [];
  const valueFor = (id: "low" | "base" | "high") => {
    const scenario = measurement.scenarios.find((item) => item.id === id);
    return brief.objective === "influential_core"
      ? scenario?.influenceMass ?? null
      : brief.objective === "near_conversion"
        ? scenario?.serviceableReach ?? null
        : scenario?.reach ?? null;
  };
  const values = [valueFor("low"), valueFor("base"), valueFor("high")];
  if (brief.objective === "broad_reach") {
    // Reach eligibility above is sufficient.
  } else if (
    brief.objective === "influential_core" &&
    (!influenceInputsCompatible(bundle, brief) ||
      measurement.influence === null ||
      measurement.evidence.influence === null)
  ) {
    return unavailable(
      measurement.availability.influence.reasonCode ?? "INFLUENCE_PROFILE_INCOMPATIBLE",
      measurement.availability.influence.recoveryAction ??
        "Add current priority-audience data.",
    );
  } else if (
    brief.objective === "near_conversion" &&
    (!serviceabilityInputsCompatible(bundle, brief) ||
      measurement.evidence.serviceability === null)
  ) {
    return unavailable(
      measurement.availability.serviceability.reasonCode ??
        "SERVICEABILITY_PROFILE_INCOMPATIBLE",
      measurement.availability.serviceability.recoveryAction ??
        "Add current likely-customer data.",
    );
  }
  if (values.some((value) => value === null)) {
    return unavailable(
      "OBJECTIVE_DELIVERY_UNAVAILABLE",
      "Complete the missing audience-estimate step and update the plan.",
    );
  }
  const range = { low: values[0]!, base: values[1]!, high: values[2]! };
  const evidence = (brief.objective === "influential_core"
    ? measurement.evidence.influence
    : brief.objective === "near_conversion"
      ? measurement.evidence.serviceability
      : measurement.evidence.uniqueReach)!;
  if (!(range.low <= range.base && range.base <= range.high)) {
    return unavailable(
      "INCOHERENT_OBJECTIVE_RANGE",
      "Correct the estimate range before comparing package delivery.",
    );
  }
  return {
    status: "eligible",
    objective: brief.objective,
    metric,
    label,
    unit,
    range,
    value: range.base,
    evidence,
    sourceIds: [...evidence!.sourceIds],
    comparabilityKey: objectiveDeliveryComparabilityKey({
      reachComparabilityKey: measurement.comparabilityKey,
      objective: brief.objective,
      profileSourceIds,
      assumptionIds,
    }),
    reasonCode: null,
    recoveryAction: null,
  };
}
