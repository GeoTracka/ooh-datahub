import { describe, expect, it } from "vitest";
import type { MovementCalibrationReport } from "@/planning/calibrationGate";
import {
  MOVEMENT_CALIBRATION_EVALUATION_VERSION,
  MOVEMENT_CALIBRATION_PROTOCOL_VERSION,
  deriveMovementCalibrationReport,
  type MovementCalibrationEvaluationFile,
  type MovementCalibrationRecord,
} from "@/planning/movementCalibrationEvaluation";

const dayparts = ["AM", "Midday", "PM", "Evening"] as const;
const dayTypes = ["weekday", "weekend"] as const;

function buildEvaluation(heldOutLocations = 3): {
  training: MovementCalibrationEvaluationFile;
  heldOut: MovementCalibrationEvaluationFile;
  independent: MovementCalibrationEvaluationFile;
  report: MovementCalibrationReport;
} {
  const protocol = {
    protocolVersion: MOVEMENT_CALIBRATION_PROTOCOL_VERSION,
    protocolId: "lagos-pilot-v1",
    frozenAt: "2025-12-01T00:00:00Z",
    retainedUri: "s3://calibration/protocols/lagos-pilot-v1.json",
    lowCountHandling: "none" as const,
    denominatorPolicy: "all_included_held_out_blocks" as const,
    stratumMinBlocks: 8 as const,
    excludedRecords: [],
    excludedStrata: [],
  };
  const primary: MovementCalibrationRecord[] = [];
  const independent: MovementCalibrationRecord[] = [];
  for (let locationIndex = 0; locationIndex < 12; locationIndex += 1) {
    const split = locationIndex >= 12 - heldOutLocations ? "held_out" as const : "training" as const;
    for (const dayType of dayTypes) {
      for (const daypart of dayparts) {
        const observed = 100 + locationIndex * 10 + dayparts.indexOf(daypart) * 5;
        const roadClass = locationIndex % 2 === 0 ? "arterial" : "collector";
        const common = {
          locationId: `location:${locationIndex}`,
          faceId: `face:${locationIndex}`,
          countDirection: "forward",
          dayType,
          daypart,
          roadClass,
          split,
          observed,
          ...(split === "held_out" ? {
            predictedP50: observed * 1.1,
            predictedP10: observed * 0.8,
            predictedP90: observed * 1.2,
          } : {}),
        };
        primary.push({
          ...common,
          recordId: `primary:${locationIndex}:${dayType}:${daypart}`,
          observationDate: dayType === "weekday" ? "2026-01-05" : "2026-01-10",
          phase: "primary",
        });
        independent.push({
          ...common,
          recordId: `replication:${locationIndex}:${dayType}:${daypart}`,
          observationDate: dayType === "weekday" ? "2026-02-09" : "2026-02-14",
          phase: "independent_date",
        });
      }
    }
  }

  const trainingRecords = primary.filter((record) => record.split === "training");
  const heldOutRecords = primary.filter((record) => record.split === "held_out");
  const files = {
    training: { evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION, protocol, records: trainingRecords },
    heldOut: { evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION, protocol, records: heldOutRecords },
    independent: { evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION, protocol, records: independent },
  } satisfies Record<string, MovementCalibrationEvaluationFile>;

  return {
    ...files,
    report: {
      heldOutLocations,
      directionalBlocks: 192,
      mdape: 0.1,
      wape: 0.1,
      intervalCoverage: 1,
      absoluteSignedWape: 0.1,
      worstEligibleStratumAbsoluteSignedWape: 0.1,
      independentDateReplication: true,
      claimInputsComplete: true,
      insideApplicabilityEnvelope: true,
      downstreamProtocolRegistered: true,
    },
  };
}

function derive(fixture = buildEvaluation(), declaredReport = fixture.report) {
  return deriveMovementCalibrationReport({
    modelFrozenAt: "2026-01-31T23:59:59Z",
    artifacts: [
      { usage: "training", value: fixture.training },
      { usage: "held_out_validation", value: fixture.heldOut },
      { usage: "independent_date_replication", value: fixture.independent },
    ],
    governance: {
      claimInputsComplete: declaredReport.claimInputsComplete,
      insideApplicabilityEnvelope: declaredReport.insideApplicabilityEnvelope,
      downstreamProtocolRegistered: declaredReport.downstreamProtocolRegistered,
    },
    declaredReport,
  });
}

describe("movement calibration semantic derivation", () => {
  it("derives the normative movement gate report from block-level evidence", () => {
    const result = derive();
    expect(result.failures).toEqual([]);
    expect(result.evaluationCanonical).toContain(MOVEMENT_CALIBRATION_EVALUATION_VERSION);
    expect(result.report).not.toBeNull();
    expect(result.report).toMatchObject({
      heldOutLocations: 3,
      directionalBlocks: 192,
      intervalCoverage: 1,
      independentDateReplication: true,
    });
    expect(result.report!.mdape).toBeCloseTo(0.1, 12);
    expect(result.report!.wape).toBeCloseTo(0.1, 12);
    expect(result.report!.absoluteSignedWape).toBeCloseTo(0.1, 12);
    expect(result.report!.worstEligibleStratumAbsoluteSignedWape).toBeCloseTo(0.1, 12);
  });

  it("rejects a favorable hand-authored report that disagrees with the governed blocks", () => {
    const fixture = buildEvaluation();
    const declared = { ...fixture.report, mdape: 0.01, wape: 0.01 };
    const result = derive(fixture, declared);
    expect(result.report!.mdape).toBeCloseTo(0.1, 12);
    expect(result.failures).toContain("DECLARED_REPORT_MISMATCH");
  });

  it("uses inclusive P10/P90 interval boundaries", () => {
    const fixture = buildEvaluation();
    const heldOutRecords = fixture.heldOut.records.map((record, index) => index === 0
      ? { ...record, predictedP10: record.observed, predictedP50: record.observed, predictedP90: record.observed * 1.2 }
      : index === 1
        ? { ...record, predictedP10: record.observed * 0.8, predictedP50: record.observed, predictedP90: record.observed }
        : record);
    const independentRecords = fixture.independent.records.map((record) => record.split === "held_out"
      ? { ...record, predictedP10: record.observed * 0.8, predictedP50: record.observed, predictedP90: record.observed * 1.2 }
      : record);
    const changed = {
      ...fixture,
      heldOut: { ...fixture.heldOut, records: heldOutRecords },
      independent: { ...fixture.independent, records: independentRecords },
    };
    const result = deriveMovementCalibrationReport({
      modelFrozenAt: "2026-01-31T23:59:59Z",
      artifacts: [
        { usage: "training", value: changed.training },
        { usage: "held_out_validation", value: changed.heldOut },
        { usage: "independent_date_replication", value: changed.independent },
      ],
      governance: {
        claimInputsComplete: true,
        insideApplicabilityEnvelope: true,
        downstreamProtocolRegistered: true,
      },
    });
    expect(result.report?.intervalCoverage).toBe(1);
  });

  it("fails closed when an eligible bias stratum has a zero observed denominator", () => {
    const fixture = buildEvaluation(4);
    const zeroAm = (record: MovementCalibrationRecord): MovementCalibrationRecord =>
      record.split === "held_out" && record.daypart === "AM"
        ? { ...record, observed: 0, predictedP10: 0, predictedP50: 0, predictedP90: 0 }
        : record;
    const result = deriveMovementCalibrationReport({
      modelFrozenAt: "2026-01-31T23:59:59Z",
      artifacts: [
        { usage: "training", value: fixture.training },
        { usage: "held_out_validation", value: { ...fixture.heldOut, records: fixture.heldOut.records.map(zeroAm) } },
        { usage: "independent_date_replication", value: { ...fixture.independent, records: fixture.independent.records.map(zeroAm) } },
      ],
      governance: {
        claimInputsComplete: true,
        insideApplicabilityEnvelope: true,
        downstreamProtocolRegistered: true,
      },
    });
    expect(result.report).toBeNull();
    expect(result.failures).toContain("ZERO_TOTAL_ELIGIBLE_STRATUM");
  });

  it("detects whole-location holdout leakage", () => {
    const fixture = buildEvaluation();
    const leaked = [...fixture.independent.records];
    const firstTraining = leaked.findIndex((record) => record.split === "training");
    leaked[firstTraining] = { ...leaked[firstTraining]!, split: "held_out", predictedP10: 80, predictedP50: 100, predictedP90: 120 };
    const result = deriveMovementCalibrationReport({
      modelFrozenAt: "2026-01-31T23:59:59Z",
      artifacts: [
        { usage: "training", value: fixture.training },
        { usage: "held_out_validation", value: fixture.heldOut },
        { usage: "independent_date_replication", value: { ...fixture.independent, records: leaked } },
      ],
      governance: {
        claimInputsComplete: true,
        insideApplicabilityEnvelope: true,
        downstreamProtocolRegistered: true,
      },
    });
    expect(result.report).toBeNull();
    expect(result.failures).toContain("LOCATION_SPLIT_LEAKAGE");
  });

  it("derives independent-date replication from actual matching post-freeze cells", () => {
    const fixture = buildEvaluation();
    const result = deriveMovementCalibrationReport({
      modelFrozenAt: "2026-01-31T23:59:59Z",
      artifacts: [
        { usage: "training", value: fixture.training },
        { usage: "held_out_validation", value: fixture.heldOut },
        { usage: "independent_date_replication", value: { ...fixture.independent, records: fixture.independent.records.slice(1) } },
      ],
      governance: {
        claimInputsComplete: true,
        insideApplicabilityEnvelope: true,
        downstreamProtocolRegistered: true,
      },
    });
    expect(result.report?.independentDateReplication).toBe(false);
    expect(result.failures).toContain("INDEPENDENT_DATE_CELL_MISSING");
  });
});
