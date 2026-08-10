import { describe, expect, it } from "vitest";
import { MOVEMENT_CALIBRATION_GATE_VERSION } from "@/planning/calibrationGate";
import {
  CALIBRATION_EVIDENCE_PACKAGE_VERSION,
  evaluateCalibrationPromotion,
  evaluateVerifiedCalibrationPromotion,
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
    movementCalibrationGateVersion: MOVEMENT_CALIBRATION_GATE_VERSION,
    evidenceEnvironment: "production_reviewed",
    modelVersion: "movement-model-v2",
    replayVersion: "movement-replay-v2",
    modelFrozenAt: "2026-01-31T23:59:59Z",
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
      { ...artifact("movement-training", "f", "movement_truth", "training"), periodStart: "2025-12-01", periodEnd: "2025-12-31" },
      artifact("movement-holdout", "a", "movement_truth", "held_out_validation"),
      artifact("geometry-holdout", "b", "exposure_geometry_truth", "held_out_validation"),
      artifact("target-holdout", "c", "target_panel_truth", "held_out_validation"),
      artifact("downstream-holdout", "d", "downstream_validation_result", "held_out_validation"),
      { ...artifact("movement-replication", "e", "movement_truth", "independent_date_replication"), periodStart: "2026-02-01", periodEnd: "2026-02-28" },
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
  it("never promotes a production package from its declared summary alone", () => {
    const result = evaluateCalibrationPromotion(packageFixture());
    expect(result).toMatchObject({
      movementCalibrationGateVersion: MOVEMENT_CALIBRATION_GATE_VERSION,
      packageValid: true,
      movementEvaluationVerified: false,
      calibrationPassed: true,
      eligibleForEvidenceC: false,
      packageFailures: [],
      promotionFailures: ["MOVEMENT_EVALUATION_NOT_VERIFIED"],
      calibrationFailures: [],
    });
  });

  it("promotes only after a separately derived report has been semantically verified", () => {
    const pkg = packageFixture();
    const result = evaluateVerifiedCalibrationPromotion({
      packageInput: pkg,
      derivedReport: pkg.movementCalibrationReport,
      evaluationFailures: [],
    });
    expect(result).toMatchObject({
      movementEvaluationVerified: true,
      calibrationPassed: true,
      eligibleForEvidenceC: true,
      promotionFailures: [],
      evaluationFailures: [],
    });
  });

  it("produces an order-independent digest for the same evidence package", () => {
    const pkg = packageFixture();
    const reversed = packageFixture({ artifacts: [...pkg.artifacts].reverse() });
    expect(calibrationEvidencePackageDigest(reversed)).toBe(calibrationEvidencePackageDigest(pkg));
  });

  it("requires explicit fitting evidence", () => {
    const pkg = packageFixture();
    const result = validateCalibrationEvidencePackage(packageFixture({
      artifacts: pkg.artifacts.filter((item) => item.usage !== "training"),
    }));
    expect(result.failures).toContain("MISSING_TRAINING_MOVEMENT_TRUTH");
  });

  it("rejects one artifact revision masquerading across evidence roles", () => {
    const pkg = packageFixture();
    const duplicatedSha = pkg.artifacts.find((item) => item.usage === "held_out_validation")!.sha256;
    const result = validateCalibrationEvidencePackage(packageFixture({
      artifacts: pkg.artifacts.map((item) =>
        item.artifactId === "movement-training" ? { ...item, sha256: duplicatedSha } : item),
    }));
    expect(result.failures).toContain("ARTIFACT_ROLE_COLLISION");
  });

  it("rejects a held-out revision reused as independent-date replication", () => {
    const pkg = packageFixture();
    const heldOutSha = pkg.artifacts.find((item) => item.artifactId === "movement-holdout")!.sha256;
    const result = validateCalibrationEvidencePackage(packageFixture({
      artifacts: pkg.artifacts.map((item) =>
        item.artifactId === "movement-replication" ? { ...item, sha256: heldOutSha } : item),
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

  it("rejects placeholder provenance instead of treating 'unknown' as reviewed metadata", () => {
    const pkg = packageFixture();
    const artifacts = [...pkg.artifacts];
    artifacts[0] = { ...artifacts[0]!, licenseId: "unknown" };
    const result = validateCalibrationEvidencePackage(packageFixture({ artifacts }));
    expect(result.failures).toContain("UNREVIEWED_PROVENANCE_OR_RIGHTS");
  });

  it("rejects impossible calendar periods", () => {
    const pkg = packageFixture();
    const artifacts = [...pkg.artifacts];
    artifacts[0] = { ...artifacts[0]!, periodEnd: "2026-02-31" };
    const result = validateCalibrationEvidencePackage(packageFixture({ artifacts }));
    expect(result.failures).toContain("ARTIFACT_PERIOD_INVALID");
  });

  it("requires an independent-date movement artifact when the existing report claims replication", () => {
    const pkg = packageFixture();
    const result = validateCalibrationEvidencePackage(packageFixture({
      artifacts: pkg.artifacts.filter((item) => item.usage !== "independent_date_replication"),
    }));
    expect(result.failures).toContain("MISSING_INDEPENDENT_DATE_REPLICATION_EVIDENCE");
  });

  it("requires independent-date evidence to post-date the declared model freeze", () => {
    const pkg = packageFixture();
    const artifacts = pkg.artifacts.map((item) =>
      item.artifactId === "movement-replication"
        ? { ...item, periodStart: "2026-01-15", periodEnd: "2026-01-20" }
        : item);
    const result = validateCalibrationEvidencePackage(packageFixture({ artifacts }));
    expect(result.failures).toContain("INDEPENDENT_DATE_NOT_POST_FREEZE");
  });

  it("still uses the existing movement calibration gate as the only threshold authority", () => {
    const pkg = packageFixture();
    const failingReport = { ...pkg.movementCalibrationReport, directionalBlocks: 191 };
    const result = evaluateVerifiedCalibrationPromotion({
      packageInput: packageFixture({ movementCalibrationReport: failingReport }),
      derivedReport: failingReport,
      evaluationFailures: [],
    });
    expect(result.packageValid).toBe(true);
    expect(result.movementEvaluationVerified).toBe(true);
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
