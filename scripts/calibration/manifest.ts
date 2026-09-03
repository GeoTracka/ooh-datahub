import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  evaluateCalibrationPromotion,
  evaluateVerifiedCalibrationPromotion,
  validateCalibrationEvidencePackage,
  type CalibrationEvidencePackage,
  type CalibrationPromotionDecision,
} from "../../src/planning/calibrationEvidence";
import {
  deriveMovementCalibrationReport,
  type MovementEvaluationFailure,
} from "../../src/planning/movementCalibrationEvaluation";
import type { MovementCalibrationReport } from "../../src/planning/calibrationGate";
import { calibrationEvidencePackageDigest } from "../../src/server/calibrationEvidenceDigest";

export type CalibrationArtifactFileFailureCode =
  | "ARTIFACT_FILE_MAPPING_MISSING"
  | "ARTIFACT_FILE_UNREADABLE"
  | "ARTIFACT_SHA256_MISMATCH";

export type CalibrationArtifactFileFailure = {
  artifactId: string;
  code: CalibrationArtifactFileFailureCode;
  expectedSha256: string;
  actualSha256: string | null;
};

export type VerifiedCalibrationManifest = {
  packageInput: unknown;
  package: CalibrationEvidencePackage | null;
  packageDigest: string | null;
  promotion: CalibrationPromotionDecision;
  artifactFailures: CalibrationArtifactFileFailure[];
  evaluationFailures: MovementEvaluationFailure[];
  movementEvaluationVersion: string | null;
  movementEvaluationDigest: string | null;
  derivedMovementCalibrationReport: MovementCalibrationReport | null;
  artifactsVerified: boolean;
  registerable: boolean;
  eligibleForEvidenceC: boolean;
};

type ManifestEnvelope = {
  package: unknown;
  artifactFiles: Record<string, string>;
};

function parseEnvelope(input: unknown): ManifestEnvelope {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { package: input, artifactFiles: {} };
  }
  const record = input as Record<string, unknown>;
  const artifactFilesRaw = record.artifactFiles;
  const artifactFiles: Record<string, string> = {};
  if (artifactFilesRaw && typeof artifactFilesRaw === "object" && !Array.isArray(artifactFilesRaw)) {
    for (const [key, value] of Object.entries(artifactFilesRaw as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) artifactFiles[key] = value;
    }
  }
  return {
    package: Object.hasOwn(record, "package") ? record.package : input,
    artifactFiles,
  };
}

export async function verifyCalibrationManifest(manifestPath: string): Promise<VerifiedCalibrationManifest> {
  const absoluteManifestPath = resolve(manifestPath);
  const raw = JSON.parse(await readFile(absoluteManifestPath, "utf8")) as unknown;
  const envelope = parseEnvelope(raw);
  const validation = validateCalibrationEvidencePackage(envelope.package);
  let promotion = evaluateCalibrationPromotion(envelope.package);

  if (!validation.package) {
    return {
      packageInput: envelope.package,
      package: null,
      packageDigest: null,
      promotion,
      artifactFailures: [],
      evaluationFailures: [],
      movementEvaluationVersion: null,
      movementEvaluationDigest: null,
      derivedMovementCalibrationReport: null,
      artifactsVerified: false,
      registerable: false,
      eligibleForEvidenceC: false,
    };
  }

  const pkg = validation.package;
  const artifactFailures: CalibrationArtifactFileFailure[] = [];
  const artifactJson = new Map<string, unknown>();
  for (const artifact of pkg.artifacts) {
    const file = envelope.artifactFiles[artifact.artifactId];
    if (!file) {
      artifactFailures.push({
        artifactId: artifact.artifactId,
        code: "ARTIFACT_FILE_MAPPING_MISSING",
        expectedSha256: artifact.sha256,
        actualSha256: null,
      });
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(resolve(dirname(absoluteManifestPath), file));
    } catch {
      artifactFailures.push({
        artifactId: artifact.artifactId,
        code: "ARTIFACT_FILE_UNREADABLE",
        expectedSha256: artifact.sha256,
        actualSha256: null,
      });
      continue;
    }

    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== artifact.sha256) {
      artifactFailures.push({
        artifactId: artifact.artifactId,
        code: "ARTIFACT_SHA256_MISMATCH",
        expectedSha256: artifact.sha256,
        actualSha256,
      });
      continue;
    }

    try {
      artifactJson.set(artifact.artifactId, JSON.parse(bytes.toString("utf8")) as unknown);
    } catch {
      // Non-movement evidence may be binary or another retained format. Movement
      // semantics are validated below only for the governed movement_truth roles.
    }
  }

  const artifactsVerified = artifactFailures.length === 0;
  let evaluationFailures: MovementEvaluationFailure[] = [];
  let movementEvaluationVersion: string | null = null;
  let movementEvaluationDigest: string | null = null;
  let derivedMovementCalibrationReport: MovementCalibrationReport | null = null;

  if (pkg.evidenceEnvironment === "production_reviewed" && artifactsVerified) {
    const movementArtifacts = pkg.artifacts
      .filter((artifact) => artifact.kind === "movement_truth")
      .map((artifact) => ({
        usage: artifact.usage,
        value: artifactJson.get(artifact.artifactId),
      }));
    const derived = deriveMovementCalibrationReport({
      modelFrozenAt: pkg.modelFrozenAt,
      artifacts: movementArtifacts,
      governance: {
        claimInputsComplete: pkg.movementCalibrationReport.claimInputsComplete,
        insideApplicabilityEnvelope: pkg.movementCalibrationReport.insideApplicabilityEnvelope,
        downstreamProtocolRegistered: pkg.movementCalibrationReport.downstreamProtocolRegistered,
      },
      declaredReport: pkg.movementCalibrationReport,
    });
    evaluationFailures = derived.failures;
    movementEvaluationVersion = derived.evaluationVersion;
    movementEvaluationDigest = derived.evaluationCanonical
      ? createHash("sha256").update(derived.evaluationCanonical, "utf8").digest("hex")
      : null;
    derivedMovementCalibrationReport = derived.report;
    promotion = evaluateVerifiedCalibrationPromotion({
      packageInput: envelope.package,
      derivedReport: derived.report,
      evaluationFailures: derived.failures,
    });
  }

  const movementSemanticsVerified = pkg.evidenceEnvironment === "test_fixture"
    || (artifactsVerified
      && derivedMovementCalibrationReport !== null
      && evaluationFailures.length === 0);
  const registerable = validation.failures.length === 0
    && artifactsVerified
    && movementSemanticsVerified;

  return {
    packageInput: envelope.package,
    package: pkg,
    packageDigest: calibrationEvidencePackageDigest(pkg),
    promotion,
    artifactFailures,
    evaluationFailures,
    movementEvaluationVersion,
    movementEvaluationDigest,
    derivedMovementCalibrationReport,
    artifactsVerified,
    registerable,
    eligibleForEvidenceC: registerable && promotion.eligibleForEvidenceC,
  };
}
