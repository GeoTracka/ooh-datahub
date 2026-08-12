export type ClaimCeiling =
  | "context"
  | "activity_potential"
  | "movement"
  | "general_ots"
  | "target_ots"
  | "scenario_target_reach"
  | "calibrated_target_reach";

export type ClaimAvailability = {
  geocode: "precise" | "low_precision" | "unknown" | "not_needed";
  fallbackFacts: "seeded" | "uploaded" | "none";
  runtimeFailure: "none" | "enrichment_unavailable" | "quota_exceeded";
  calibration: "inside" | "outside" | "missing" | "failed" | "bundle_mismatch";
  activityPotentialAvailable: boolean;
  movementAvailable: boolean;
  movementUnit: "vehicle_passages" | "person_passages" | null;
  personConversionAvailable: boolean;
  orientationAvailable: boolean;
  viewZoneAvailable: boolean;
  schedule: "compatible" | "assumed" | "missing";
  visibilityAndDeliveryAvailable: boolean;
  targetUniverseAvailable: boolean;
  targetAllocationAvailable: boolean;
  overlap: "qualified" | "assumed" | "missing";
  qiAvailable: boolean;
};

export type ClaimResolution = {
  highest: ClaimCeiling;
  influenceEligible: boolean;
  evidenceCap: "C" | "D";
  reasonCode: string | null;
  recoveryAction: string | null;
};

function activityOrContext(
  input: ClaimAvailability,
  reasonCode: string,
  recoveryAction: string,
): ClaimResolution {
  return {
    highest: input.activityPotentialAvailable ? "activity_potential" : "context",
    influenceEligible: false,
    evidenceCap: "D",
    reasonCode,
    recoveryAction,
  };
}

export function resolveClaimLadder(input: ClaimAvailability): ClaimResolution {
  if (input.geocode === "unknown") {
    return {
      highest: "context",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: "UNKNOWN_ADDRESS",
      recoveryAction: "Supply or correct the location coordinate",
    };
  }
  if (input.geocode === "low_precision") {
    return {
      highest: "context",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: "LOW_PRECISION_GEOCODE",
      recoveryAction: "Add a precise coordinate from a trusted source.",
    };
  }
  if (input.runtimeFailure !== "none" && input.fallbackFacts === "none") {
    return {
      highest: "context",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: input.runtimeFailure.toUpperCase(),
      recoveryAction: "Continue with the available inventory details.",
    };
  }
  if (input.calibration !== "inside") {
    return activityOrContext(
      input,
      "CALIBRATION_" + input.calibration.toUpperCase(),
      input.calibration === "bundle_mismatch"
        ? "Add audience-checking data that matches these location details."
        : "Use audience-checking data that covers this location.",
    );
  }
  if (!input.movementAvailable || input.movementUnit === null) {
    return activityOrContext(
      input,
      "MOVEMENT_UNAVAILABLE",
      "Add a usable movement count or movement estimate.",
    );
  }
  const movementOnly =
    !input.orientationAvailable ||
    !input.viewZoneAvailable ||
    input.schedule === "missing" ||
    !input.visibilityAndDeliveryAvailable ||
    (input.movementUnit === "vehicle_passages" && !input.personConversionAvailable);
  if (movementOnly) {
    return {
      highest: "movement",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: input.movementUnit === "vehicle_passages" && !input.personConversionAvailable
        ? "OCCUPANCY_CONVERSION_UNAVAILABLE"
        : "EXPOSURE_GEOMETRY_OR_SCHEDULE_UNAVAILABLE",
      recoveryAction: "Check the media location's viewing direction, visible area, campaign availability, and any vehicle-to-person conversion.",
    };
  }
  if (!input.targetUniverseAvailable || !input.targetAllocationAvailable) {
    return {
      highest: "general_ots",
      influenceEligible: false,
      evidenceCap: input.schedule === "assumed" ? "D" : "C",
      reasonCode: "TARGET_BASIS_UNAVAILABLE",
      recoveryAction: "Add compatible audience size and audience-mix data.",
    };
  }
  if (input.overlap === "missing") {
    return {
      highest: "target_ots",
      influenceEligible: false,
      evidenceCap: input.schedule === "assumed" ? "D" : "C",
      reasonCode: "OVERLAP_MODEL_UNAVAILABLE",
      recoveryAction: "Add usable audience-overlap data or show a clearly labelled estimate range.",
    };
  }
  const assumed = input.overlap === "assumed" || input.schedule === "assumed";
  return {
    highest: assumed ? "scenario_target_reach" : "calibrated_target_reach",
    influenceEligible: input.qiAvailable,
    evidenceCap: assumed ? "D" : "C",
    reasonCode: input.qiAvailable ? null : "QI_UNAVAILABLE",
    recoveryAction: input.qiAvailable
      ? null
      : "Add a named priority-audience data source for this sector.",
  };
}
