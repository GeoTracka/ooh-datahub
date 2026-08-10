import { describe, expect, it } from "vitest";
import {
  CALIBRATION_EVIDENCE_PACKAGE_VERSION,
  evaluateCalibrationPromotion,
  validateCalibrationEvidencePackage,
  type CalibrationEvidenceArtifact,
  type CalibrationEvidencePackage,
} from "@/planning/calibrationEvidence";
import { calibrationEvidencePackageDigest } from "@/server/calibrationEvidenceDigest";

function artifact(
  artifactId: string,
  shaChar: string,
  kind: CalibrationEvidenceArtifact["kind"],
  usage: CalibrationEvidenceArtifact["usage"],
): CalibrationEvidenceArtifact {
  return {
    artifactId,
    sha256: shaChar.repeat(64),
    kind,
    usage,
    provenanceUri: `https://evidence.example/${artifactId}`,
    retainedUri: `s3://calibration-evidence/${artifactId}.json`,
    licenseId: "reviewed-commercial-evidence-v1",
    rightsReviewRef: `rights:${artifactId}`,
    commercialUseStatus: "permitted",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
  };
}

function packageFixture(
  overrides: Partial<CalibrationEvidencePackage> = {},
): CalibrationEvidencePackage {
  return {
    packageVersion: CALIBRATION_EVIDENCE_PACKAGE_VERSION,
    evidenceEnvironment: "production_reviewed",
    modelVersion: "movement-model-v2",
    replayVersion: "movement-replay-v2",
    geographyId: "nga-lagos",
    applicabilityScope: "reviewed Lagos OOH faces inside the declared movement-model envelope",
    contextBinding: {
      snapshotId: "context:fixture",
      featureVersion: "planner-context-v1",
      resolverVersion: "entity-resolver-v1",
      sourceFingerprint: "1".repeat(32),
      resolutionFingerprint: "2".repeat(32),
    },
    artifacts: [
      artifact("movement-holdout", "a", "movement_truth", "held_out_validation"),
      artifact("geometry-holdout", "b", "exposure_geometry_truth", "held_out_validation"),
      artifact("target-holdout", "c", "target_panel_truth", "held_out_validation"),
      artifact("downstream-holdout", "d", "downstream_validation_result", "held_out_validation"),
      artifact("movement-replication", "e", "movement_truth", "independent_date_replication"),
    ],
    movementCalibrationReport: {
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
    },
    ...overrides,
  };
}

describe("calibration evidence package", () => {
  it("requires a provenance-complete package and the existing movement gate to pass", () => {
    const result = evaluateCalibrationPromotion(packageFixture());
    expect(result).toMatchObject({
      packageValid: true,
      calibrationPassed: true,
      eligibleForEvidenceC: true,
      packageFailures: [],
      promotionFailures: [],
      calibrationFailures: [],
    });
  });

  it("produces an order-independent digest for the same evidence package", () => {
    const pkg = packageFixture();
    const reversed = packageFixture({ artifacts: [...pkg.artifacts].reverse() });
    expect(calibrationEvidencePackageDigest(reversed)).toBe(calibrationEvidencePackageDigest(pkg));
  });

  it("rejects one artifact revision masquerading as both training and holdout", () => {
    const pkg = packageFixture();
    const duplicatedSha = pkg.artifacts[0]!.sha256;
    const result = validateCalibrationEvidencePackage(packageFixture({
      artifacts: [
        ...pkg.artifacts,
        { ...artifact("movement-training", "f", "movement_truth", "training"), sha256: duplicatedSha },
      ],
    }));
    expect(result.failures).toContain("ARTIFACT_ROLE_COLLISION");
  });

  it("fails closed when reviewed provenance/rights metadata is missing", () => {
    const pkg = packageFixture() as unknown as Record<string, unknown>;
    const artifacts = [...(pkg.artifacts as CalibrationEvidenceArtifact[])];
    artifacts[0] = { ...artifacts[0]!, rightsReviewRef: "" };
    pkg.artifacts = artifacts;
    expect(validateCalibrationEvidencePackage(pkg).failures).toEqual(["INVALID_PACKAGE_SCHEMA"]);
  });

  it("requires an independent-date movement artifact when the existing report claims replication", () => {
    const pkg = packageFixture();
    const result = validateCalibrationEvidencePackage(packageFixture({
      artifacts: pkg.artifacts.filter((item) => item.usage !== "independent_date_replication"),
    }));
    expect(result.failures).toContain("MISSING_INDEPENDENT_DATE_REPLICATION_EVIDENCE");
  });

  it("uses the existing movement calibration gate rather than duplicating thresholds", () => {
    const pkg = packageFixture();
    const result = evaluateCalibrationPromotion(packageFixture({
      movementCalibrationReport: { ...pkg.movementCalibrationReport, directionalBlocks: 191 },
    }));
    expect(result.packageValid).toBe(true);
    expect(result.calibrationPassed).toBe(false);
    expect(result.calibrationFailures).toContain("DIRECTIONAL_BLOCKS");
    expect(result.eligibleForEvidenceC).toBe(false);
  });

  it("allows test fixtures to exercise the package contract but never promotes them", () => {
    const result = evaluateCalibrationPromotion(packageFixture({ evidenceEnvironment: "test_fixture" }));
    expect(result.packageValid).toBe(true);
    expect(result.calibrationPassed).toBe(true);
    expect(result.promotionFailures).toEqual(["TEST_FIXTURE_NOT_PROMOTABLE"]);
    expect(result.eligibleForEvidenceC).toBe(false);
  });
});
