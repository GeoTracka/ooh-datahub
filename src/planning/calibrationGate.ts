export const MOVEMENT_CALIBRATION_GATE_VERSION = "movement-calibration-gate-v1" as const;

export type MovementCalibrationReport = {
  heldOutLocations: number;
  directionalBlocks: number;
  mdape: number;
  wape: number;
  intervalCoverage: number;
  absoluteSignedWape: number;
  worstEligibleStratumAbsoluteSignedWape: number;
  independentDateReplication: boolean;
  claimInputsComplete: boolean;
  insideApplicabilityEnvelope: boolean;
  downstreamProtocolRegistered: boolean;
};

export type CalibrationFailure =
  | "HELD_OUT_LOCATIONS"
  | "DIRECTIONAL_BLOCKS"
  | "INDEPENDENT_DATE_REPLICATION"
  | "MDAPE"
  | "WAPE"
  | "INTERVAL_COVERAGE"
  | "SIGNED_WAPE"
  | "STRATUM_BIAS"
  | "CLAIM_INPUTS"
  | "APPLICABILITY"
  | "DOWNSTREAM_PROTOCOL";

export function evaluateMovementCalibration(
  report: MovementCalibrationReport,
): { passed: boolean; failures: CalibrationFailure[] } {
  const failures: CalibrationFailure[] = [];
  if (report.heldOutLocations < 3) failures.push("HELD_OUT_LOCATIONS");
  if (report.directionalBlocks < 192) failures.push("DIRECTIONAL_BLOCKS");
  if (!report.independentDateReplication) failures.push("INDEPENDENT_DATE_REPLICATION");
  if (report.mdape > 0.35) failures.push("MDAPE");
  if (report.wape > 0.35) failures.push("WAPE");
  if (report.intervalCoverage < 0.70) failures.push("INTERVAL_COVERAGE");
  if (report.absoluteSignedWape > 0.15) failures.push("SIGNED_WAPE");
  if (report.worstEligibleStratumAbsoluteSignedWape > 0.25) failures.push("STRATUM_BIAS");
  if (!report.claimInputsComplete) failures.push("CLAIM_INPUTS");
  if (!report.insideApplicabilityEnvelope) failures.push("APPLICABILITY");
  if (!report.downstreamProtocolRegistered) failures.push("DOWNSTREAM_PROTOCOL");
  return { passed: failures.length === 0, failures };
}
