import { randomUUID } from "node:crypto";
import { canonicalCalibrationEvidencePackage } from "../src/planning/calibrationEvidence";
import { sqlLiteral } from "./data/persistenceFormat";
import { runPsql } from "./data/psql";
import { migrateDatabase } from "./db-migrate";
import { verifyCalibrationManifest } from "./calibration/manifest";

function argValue(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function textArray(values: readonly string[]): string {
  return `ARRAY[${values.map(sqlLiteral).join(",")}]::text[]`;
}

function jsonb(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

async function recordRejected(
  url: string,
  input: {
    runId: string;
    submittedDigest: string | null;
    evidenceEnvironment: string | null;
    packageFailures: readonly string[];
    promotionFailures: readonly string[];
    calibrationFailures: readonly string[];
    artifactFailures: readonly string[];
    submittedManifest: unknown;
  },
): Promise<void> {
  await runPsql(url, `
INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, policy_version, evidence_environment,
  validation_status, package_failure_codes, promotion_failure_codes,
  calibration_failure_codes, artifact_failure_codes,
  eligible_for_evidence_c, submitted_manifest
) VALUES (
  ${sqlLiteral(input.runId)}::uuid,
  ${input.submittedDigest ? sqlLiteral(input.submittedDigest) : "NULL"},
  'calibration-promotion-policy-v1',
  ${input.evidenceEnvironment ? sqlLiteral(input.evidenceEnvironment) : "NULL"},
  'rejected',
  ${textArray(input.packageFailures)},
  ${textArray(input.promotionFailures)},
  ${textArray(input.calibrationFailures)},
  ${textArray(input.artifactFailures)},
  false,
  ${jsonb(input.submittedManifest)}
);
`);
}

async function main(): Promise<void> {
  const url = databaseUrl();
  await migrateDatabase();
  const verified = await verifyCalibrationManifest(argValue("manifest"));
  const runId = randomUUID();
  const evidenceEnvironment = verified.package?.evidenceEnvironment ?? null;
  const artifactFailureCodes = verified.artifactFailures.map((failure) =>
    `${failure.code}:${failure.artifactId}`
  );

  if (!verified.registerable || !verified.package || !verified.packageDigest) {
    await recordRejected(url, {
      runId,
      submittedDigest: verified.packageDigest,
      evidenceEnvironment,
      packageFailures: verified.promotion.packageFailures,
      promotionFailures: verified.promotion.promotionFailures,
      calibrationFailures: verified.promotion.calibrationFailures,
      artifactFailures: artifactFailureCodes,
      submittedManifest: verified.packageInput,
    });
    process.stdout.write(`${JSON.stringify({
      runId,
      status: "rejected",
      packageDigest: verified.packageDigest,
      packageFailures: verified.promotion.packageFailures,
      artifactFailures: artifactFailureCodes,
    }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const pkg = verified.package;
  const digest = verified.packageDigest;
  const canonicalManifest = canonicalCalibrationEvidencePackage(pkg);
  const artifactValues = pkg.artifacts.map((artifact) => `(
    ${sqlLiteral(digest)}, ${sqlLiteral(artifact.artifactId)}, ${sqlLiteral(artifact.sha256)},
    ${sqlLiteral(artifact.kind)}, ${sqlLiteral(artifact.usage)}, ${sqlLiteral(artifact.provenanceUri)},
    ${sqlLiteral(artifact.retainedUri)}, ${sqlLiteral(artifact.licenseId)}, ${sqlLiteral(artifact.rightsReviewRef)},
    ${sqlLiteral(artifact.commercialUseStatus)}, ${sqlLiteral(artifact.periodStart)}::date, ${sqlLiteral(artifact.periodEnd)}::date
  )`).join(",\n");

  try {
    await runPsql(url, `
BEGIN;
INSERT INTO ooh_data.calibration_evidence_packages (
  package_digest, package_version, evidence_environment, model_version, replay_version,
  geography_id, applicability_scope, context_feature_snapshot_id, context_feature_version,
  resolver_version, source_fingerprint, resolution_fingerprint,
  movement_calibration_report, canonical_manifest
) VALUES (
  ${sqlLiteral(digest)}, ${sqlLiteral(pkg.packageVersion)}, ${sqlLiteral(pkg.evidenceEnvironment)},
  ${sqlLiteral(pkg.modelVersion)}, ${sqlLiteral(pkg.replayVersion)}, ${sqlLiteral(pkg.geographyId)},
  ${sqlLiteral(pkg.applicabilityScope)}, ${sqlLiteral(pkg.contextBinding.snapshotId)},
  ${sqlLiteral(pkg.contextBinding.featureVersion)}, ${sqlLiteral(pkg.contextBinding.resolverVersion)},
  ${sqlLiteral(pkg.contextBinding.sourceFingerprint)}, ${sqlLiteral(pkg.contextBinding.resolutionFingerprint)},
  ${jsonb(pkg.movementCalibrationReport)}, ${sqlLiteral(canonicalManifest)}::jsonb
)
ON CONFLICT (package_digest) DO NOTHING;

INSERT INTO ooh_data.calibration_evidence_artifacts (
  package_digest, artifact_id, artifact_sha256, evidence_kind, usage_role,
  provenance_uri, retained_uri, license_id, rights_review_ref, commercial_use_status,
  period_start, period_end
) VALUES
${artifactValues}
ON CONFLICT (package_digest, artifact_id) DO NOTHING;

INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, package_digest, policy_version, evidence_environment,
  validation_status, package_failure_codes, promotion_failure_codes,
  calibration_failure_codes, artifact_failure_codes,
  eligible_for_evidence_c, submitted_manifest
) VALUES (
  ${sqlLiteral(runId)}::uuid, ${sqlLiteral(digest)}, ${sqlLiteral(digest)},
  ${sqlLiteral(verified.promotion.policyVersion)}, ${sqlLiteral(pkg.evidenceEnvironment)},
  'accepted', ${textArray(verified.promotion.packageFailures)},
  ${textArray(verified.promotion.promotionFailures)}, ${textArray(verified.promotion.calibrationFailures)},
  ARRAY[]::text[], ${verified.eligibleForEvidenceC ? "true" : "false"},
  ${jsonb(pkg)}
);
COMMIT;
`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("CALIBRATION_CONTEXT_BINDING_MISMATCH") &&
        !message.includes("CALIBRATION_CONTEXT_SNAPSHOT_NOT_FOUND")) {
      throw error;
    }
    await recordRejected(url, {
      runId,
      submittedDigest: digest,
      evidenceEnvironment: pkg.evidenceEnvironment,
      packageFailures: [message.includes("MISMATCH")
        ? "CALIBRATION_CONTEXT_BINDING_MISMATCH"
        : "CALIBRATION_CONTEXT_SNAPSHOT_NOT_FOUND"],
      promotionFailures: verified.promotion.promotionFailures,
      calibrationFailures: verified.promotion.calibrationFailures,
      artifactFailures: [],
      submittedManifest: pkg,
    });
    process.stdout.write(`${JSON.stringify({
      runId,
      status: "rejected",
      packageDigest: digest,
      reason: message.includes("MISMATCH")
        ? "CALIBRATION_CONTEXT_BINDING_MISMATCH"
        : "CALIBRATION_CONTEXT_SNAPSHOT_NOT_FOUND",
    }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  process.stdout.write(`${JSON.stringify({
    runId,
    status: "accepted",
    packageDigest: digest,
    evidenceEnvironment: pkg.evidenceEnvironment,
    calibrationPassed: verified.promotion.calibrationPassed,
    eligibleForEvidenceC: verified.eligibleForEvidenceC,
    promotionFailures: verified.promotion.promotionFailures,
    calibrationFailures: verified.promotion.calibrationFailures,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`calibration evidence registration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
