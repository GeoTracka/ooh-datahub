import { describe, expect, it } from "vitest";
import { evaluateMovementCalibration } from "@/planning/calibrationGate";

const passing = {
  heldOutLocations: 3,
  directionalBlocks: 192,
  mdape: 0.31,
  wape: 0.29,
  intervalCoverage: 0.74,
  absoluteSignedWape: 0.11,
  worstEligibleStratumAbsoluteSignedWape: 0.21,
  independentDateReplication: true,
  claimInputsComplete: true,
  insideApplicabilityEnvelope: true,
  downstreamProtocolRegistered: true,
};

describe("evaluateMovementCalibration", () => {
  it("passes only the complete Evidence-C movement gate", () => {
    expect(evaluateMovementCalibration(passing)).toEqual({ passed: true, failures: [] });
  });

  it("fails the original 96-block directional prototype", () => {
    expect(evaluateMovementCalibration({
      ...passing,
      directionalBlocks: 96,
      independentDateReplication: false,
    }).passed).toBe(false);
  });

  it("fails when interval coverage is below 70 percent", () => {
    expect(evaluateMovementCalibration({
      ...passing,
      intervalCoverage: 0.69,
    }).failures).toContain("INTERVAL_COVERAGE");
  });
});
