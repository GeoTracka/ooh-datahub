import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CALIBRATION_EVIDENCE_PACKAGE_VERSION } from "@/planning/calibrationEvidence";
import { verifyCalibrationManifest } from "../../../scripts/calibration/manifest";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeManifest(): Promise<{ manifestPath: string; artifactPath: string }> {
  const directory = await mkdtemp(join(tmpdir(), "ooh-calibration-"));
  tempDirectories.push(directory);
  const definitions = [
    ["movement-training", "movement_truth", "training"],
    ["movement-holdout", "movement_truth", "held_out_validation"],
    ["geometry-holdout", "exposure_geometry_truth", "held_out_validation"],
    ["target-holdout", "target_panel_truth", "held_out_validation"],
    ["downstream-holdout", "downstream_validation_result", "held_out_validation"],
    ["movement-replication", "movement_truth", "independent_date_replication"],
  ] as const;

  const artifactFiles: Record<string, string> = {};
  const artifacts = [];
  let firstArtifactPath = "";
  for (const [artifactId, kind, usage] of definitions) {
    const fileName = `${artifactId}.json`;
    const path = join(directory, fileName);
    const content = JSON.stringify({ artifactId, fixture: true });
    await writeFile(path, content, "utf8");
    if (!firstArtifactPath) firstArtifactPath = path;
    artifactFiles[artifactId] = `./${fileName}`;
    artifacts.push({
      artifactId,
      sha256: sha256(content),
      kind,
      usage,
      provenanceUri: `https://evidence.example/${artifactId}`,
      retainedUri: `file:///retained/${fileName}`,
      licenseId: "fixture-reviewed-license",
      rightsReviewRef: `fixture:rights:${artifactId}`,
      commercialUseStatus: "permitted",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
  }

  const manifestPath = join(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    package: {
      packageVersion: CALIBRATION_EVIDENCE_PACKAGE_VERSION,
      evidenceEnvironment: "test_fixture",
      modelVersion: "fixture-model-v1",
      replayVersion: "fixture-replay-v1",
      geographyId: "fixture",
      applicabilityScope: "fixture only",
      contextBinding: {
        snapshotId: "context:fixture",
        featureVersion: "planner-context-v1",
        resolverVersion: "entity-resolver-v1",
        sourceFingerprint: "1".repeat(32),
        resolutionFingerprint: "2".repeat(32),
      },
      artifacts,
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
    },
    artifactFiles,
  }), "utf8");

  return { manifestPath, artifactPath: firstArtifactPath };
}

describe("calibration manifest byte verification", () => {
  it("verifies every declared artifact before allowing registration", async () => {
    const { manifestPath } = await writeManifest();
    const result = await verifyCalibrationManifest(manifestPath);
    expect(result.packageDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.artifactsVerified).toBe(true);
    expect(result.artifactFailures).toEqual([]);
    expect(result.registerable).toBe(true);
    expect(result.eligibleForEvidenceC).toBe(false);
    expect(result.promotion.promotionFailures).toEqual(["TEST_FIXTURE_NOT_PROMOTABLE"]);
  });

  it("fails registration when retained bytes drift from their declared SHA-256", async () => {
    const { manifestPath, artifactPath } = await writeManifest();
    await writeFile(artifactPath, "mutated after review", "utf8");
    const result = await verifyCalibrationManifest(manifestPath);
    expect(result.artifactsVerified).toBe(false);
    expect(result.registerable).toBe(false);
    expect(result.artifactFailures).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ARTIFACT_SHA256_MISMATCH" }),
    ]));
  });
});
