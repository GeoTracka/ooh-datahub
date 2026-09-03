import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MOVEMENT_CALIBRATION_GATE_VERSION } from "@/planning/calibrationGate";
import { CALIBRATION_EVIDENCE_PACKAGE_VERSION } from "@/planning/calibrationEvidence";
import {
  MOVEMENT_CALIBRATION_EVALUATION_VERSION,
  MOVEMENT_CALIBRATION_PROTOCOL_VERSION,
} from "@/planning/movementCalibrationEvaluation";
import { verifyCalibrationManifest } from "../../../scripts/calibration/manifest";

const tempDirectories: string[] = [];
const dayparts = ["AM", "Midday", "PM", "Evening"] as const;
const dayTypes = ["weekday", "weekend"] as const;

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function movementFiles() {
  const protocol = {
    protocolVersion: MOVEMENT_CALIBRATION_PROTOCOL_VERSION,
    protocolId: "production-test-protocol",
    frozenAt: "2025-12-01T00:00:00Z",
    retainedUri: "s3://reviewed/protocol.json",
    lowCountHandling: "none",
    denominatorPolicy: "all_included_held_out_blocks",
    stratumMinBlocks: 8,
    excludedRecords: [],
    excludedStrata: [],
  };
  const primary = [] as Record<string, unknown>[];
  const replication = [] as Record<string, unknown>[];
  for (let locationIndex = 0; locationIndex < 12; locationIndex += 1) {
    const split = locationIndex >= 9 ? "held_out" : "training";
    for (const dayType of dayTypes) {
      for (const daypart of dayparts) {
        const observed = 100 + locationIndex * 10 + dayparts.indexOf(daypart) * 5;
        const common = {
          locationId: `location:${locationIndex}`,
          faceId: `face:${locationIndex}`,
          countDirection: "forward",
          dayType,
          daypart,
          roadClass: locationIndex % 2 === 0 ? "arterial" : "collector",
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
          phase: "primary",
          observationDate: dayType === "weekday" ? "2026-01-05" : "2026-01-10",
        });
        replication.push({
          ...common,
          recordId: `replication:${locationIndex}:${dayType}:${daypart}`,
          phase: "independent_date",
          observationDate: dayType === "weekday" ? "2026-02-09" : "2026-02-14",
        });
      }
    }
  }
  const wrap = (records: Record<string, unknown>[]) => JSON.stringify({
    evaluationVersion: MOVEMENT_CALIBRATION_EVALUATION_VERSION,
    protocol,
    records,
  });
  return {
    "movement-training": wrap(primary.filter((record) => record.split === "training")),
    "movement-holdout": wrap(primary.filter((record) => record.split === "held_out")),
    "movement-replication": wrap(replication),
  };
}

async function writeProductionManifest(declaredMdape = 0.1): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "ooh-production-calibration-"));
  tempDirectories.push(directory);
  const movement = movementFiles();
  const contents: Record<string, string> = {
    ...movement,
    "geometry-holdout": JSON.stringify({ reviewedGeometry: true }),
    "target-holdout": JSON.stringify({ reviewedTargetPanel: true }),
    "downstream-holdout": JSON.stringify({ downstreamValidation: true }),
  };
  const definitions = [
    ["movement-training", "movement_truth", "training", "2026-01-01", "2026-01-31"],
    ["movement-holdout", "movement_truth", "held_out_validation", "2026-01-01", "2026-01-31"],
    ["geometry-holdout", "exposure_geometry_truth", "held_out_validation", "2026-01-01", "2026-01-31"],
    ["target-holdout", "target_panel_truth", "held_out_validation", "2026-01-01", "2026-01-31"],
    ["downstream-holdout", "downstream_validation_result", "held_out_validation", "2026-01-01", "2026-01-31"],
    ["movement-replication", "movement_truth", "independent_date_replication", "2026-02-01", "2026-02-28"],
  ] as const;
  const artifactFiles: Record<string, string> = {};
  const artifacts = [];
  for (const [artifactId, kind, usage, periodStart, periodEnd] of definitions) {
    const fileName = `${artifactId}.json`;
    const content = contents[artifactId]!;
    await writeFile(join(directory, fileName), content, "utf8");
    artifactFiles[artifactId] = `./${fileName}`;
    artifacts.push({
      artifactId,
      sha256: sha256(content),
      kind,
      usage,
      provenanceUri: `https://review.example/${artifactId}`,
      retainedUri: `s3://reviewed/${fileName}`,
      licenseId: "reviewed-commercial-v1",
      rightsReviewRef: `rights:${artifactId}`,
      commercialUseStatus: "permitted",
      periodStart,
      periodEnd,
    });
  }
  const manifestPath = join(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    package: {
      packageVersion: CALIBRATION_EVIDENCE_PACKAGE_VERSION,
      movementCalibrationGateVersion: MOVEMENT_CALIBRATION_GATE_VERSION,
      evidenceEnvironment: "production_reviewed",
      modelVersion: "movement-model-v2",
      replayVersion: "movement-replay-v2",
      modelFrozenAt: "2026-01-31T23:59:59Z",
      geographyId: "nga-lagos",
      applicabilityScope: "test representation of a reviewed production package",
      contextBinding: {
        snapshotId: "context:test",
        featureVersion: "planner-context-v1",
        resolverVersion: "entity-resolver-v1",
        sourceFingerprint: "1".repeat(32),
        resolutionFingerprint: "2".repeat(32),
      },
      artifacts,
      movementCalibrationReport: {
        heldOutLocations: 3,
        directionalBlocks: 192,
        mdape: declaredMdape,
        wape: 0.1,
        intervalCoverage: 1,
        absoluteSignedWape: 0.1,
        worstEligibleStratumAbsoluteSignedWape: 0.1,
        independentDateReplication: true,
        claimInputsComplete: true,
        insideApplicabilityEnvelope: true,
        downstreamProtocolRegistered: true,
      },
    },
    artifactFiles,
  }), "utf8");
  return manifestPath;
}

describe("production calibration manifest semantic verification", () => {
  it("derives and verifies the movement report before production promotion", async () => {
    const result = await verifyCalibrationManifest(await writeProductionManifest());
    expect(result.artifactsVerified).toBe(true);
    expect(result.evaluationFailures).toEqual([]);
    expect(result.movementEvaluationVersion).toBe(MOVEMENT_CALIBRATION_EVALUATION_VERSION);
    expect(result.movementEvaluationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.derivedMovementCalibrationReport?.directionalBlocks).toBe(192);
    expect(result.promotion.movementEvaluationVerified).toBe(true);
    expect(result.promotion.calibrationPassed).toBe(true);
    expect(result.registerable).toBe(true);
    expect(result.eligibleForEvidenceC).toBe(true);
  });

  it("blocks a favorable declared summary when the derived raw-record metric disagrees", async () => {
    const result = await verifyCalibrationManifest(await writeProductionManifest(0.01));
    expect(result.artifactsVerified).toBe(true);
    expect(result.derivedMovementCalibrationReport?.mdape).toBeCloseTo(0.1, 12);
    expect(result.evaluationFailures).toContain("DECLARED_REPORT_MISMATCH");
    expect(result.promotion.movementEvaluationVerified).toBe(false);
    expect(result.registerable).toBe(false);
    expect(result.eligibleForEvidenceC).toBe(false);
  });
});
