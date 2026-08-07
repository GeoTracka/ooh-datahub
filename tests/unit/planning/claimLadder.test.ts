import { describe, expect, it } from "vitest";
import {
  resolveClaimLadder,
  type ClaimAvailability,
} from "@/planning/claimLadder";

const complete: ClaimAvailability = {
  geocode: "precise",
  fallbackFacts: "seeded",
  runtimeFailure: "none",
  calibration: "inside",
  activityPotentialAvailable: true,
  movementAvailable: true,
  movementUnit: "person_passages",
  personConversionAvailable: true,
  orientationAvailable: true,
  viewZoneAvailable: true,
  schedule: "assumed",
  visibilityAndDeliveryAvailable: true,
  targetUniverseAvailable: true,
  targetAllocationAvailable: true,
  overlap: "assumed",
  qiAvailable: true,
};

const cases: Array<[
  string,
  Partial<ClaimAvailability>,
  string,
  string,
]> = [
  ["low geocode", { geocode: "low_precision" }, "context", "LOW_PRECISION_GEOCODE"],
  ["unknown address", { geocode: "unknown" }, "context", "UNKNOWN_ADDRESS"],
  ["provider quota with no facts", { runtimeFailure: "quota_exceeded", fallbackFacts: "none" }, "context", "QUOTA_EXCEEDED"],
  ["no bundle", { calibration: "missing" }, "activity_potential", "CALIBRATION_MISSING"],
  ["outside geography", { calibration: "outside" }, "activity_potential", "CALIBRATION_OUTSIDE"],
  ["failed validation", { calibration: "failed" }, "activity_potential", "CALIBRATION_FAILED"],
  ["bundle mismatch", { calibration: "bundle_mismatch" }, "activity_potential", "CALIBRATION_BUNDLE_MISMATCH"],
  ["no orientation", { orientationAvailable: false }, "movement", "EXPOSURE_GEOMETRY_OR_SCHEDULE_UNAVAILABLE"],
  ["no schedule", { schedule: "missing" }, "movement", "EXPOSURE_GEOMETRY_OR_SCHEDULE_UNAVAILABLE"],
  ["vehicle flow only", { movementUnit: "vehicle_passages", personConversionAvailable: false }, "movement", "OCCUPANCY_CONVERSION_UNAVAILABLE"],
  ["no universe", { targetUniverseAvailable: false }, "general_ots", "TARGET_BASIS_UNAVAILABLE"],
  ["no overlap", { overlap: "missing" }, "target_ots", "OVERLAP_MODEL_UNAVAILABLE"],
];

describe("resolveClaimLadder", () => {
  it.each(cases)("degrades %s with a recovery action", (_, change, highest, reason) => {
    const resolution = resolveClaimLadder({ ...complete, ...change });
    expect(resolution.highest).toBe(highest);
    expect(resolution.reasonCode).toBe(reason);
    expect(resolution.recoveryAction).toBeTruthy();
  });

  it("keeps unique reach but disables Influence when qi is absent", () => {
    const resolution = resolveClaimLadder({ ...complete, qiAvailable: false });
    expect(resolution.highest).toBe("scenario_target_reach");
    expect(resolution.influenceEligible).toBe(false);
    expect(resolution.reasonCode).toBe("QI_UNAVAILABLE");
  });

  it("continues on seeded facts when enrichment is unavailable", () => {
    const resolution = resolveClaimLadder({
      ...complete,
      runtimeFailure: "enrichment_unavailable",
    });
    expect(resolution.highest).toBe("scenario_target_reach");
  });
});
