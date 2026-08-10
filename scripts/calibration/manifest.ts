import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  evaluateCalibrationPromotion,
  validateCalibrationEvidencePackage,
  type CalibrationEvidencePackage,
  type CalibrationPromotionDecision,
} from "../../src/planning/calibrationEvidence";
import {
  calibrationEvidencePackageDigest,
  sha256File,
} from "../../src/server/calibrationEvidenceDigest";

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
  const promotion = evaluateCalibrationPromotion(envelope.package);

  if (!validation.package) {
    return {
      packageInput: envelope.package,
      package: null,
      packageDigest: null,
      promotion,
      artifactFailures: [],
      artifactsVerified: false,
      registerable: false,
      eligibleForEvidenceC: false,
    };
  }

  const pkg = validation.package;
  const artifactFailures: CalibrationArtifactFileFailure[] = [];
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

    let actualSha256: string;
    try {
      actualSha256 = await sha256File(resolve(dirname(absoluteManifestPath), file));
    } catch {
      artifactFailures.push({
        artifactId: artifact.artifactId,
        code: "ARTIFACT_FILE_UNREADABLE",
        expectedSha256: artifact.sha256,
        actualSha256: null,
      });
      continue;
    }

    if (actualSha256 !== artifact.sha256) {
      artifactFailures.push({
        artifactId: artifact.artifactId,
        code: "ARTIFACT_SHA256_MISMATCH",
        expectedSha256: artifact.sha256,
        actualSha256,
      });
    }
  }

  const artifactsVerified = artifactFailures.length === 0;
  const registerable = validation.failures.length === 0 && artifactsVerified;
  return {
    packageInput: envelope.package,
    package: pkg,
    packageDigest: calibrationEvidencePackageDigest(pkg),
    promotion,
    artifactFailures,
    artifactsVerified,
    registerable,
    eligibleForEvidenceC: registerable && promotion.eligibleForEvidenceC,
  };
}
