import { resolve } from "node:path";
import { loadMigrations } from "./data/migrations";
import { runPsql } from "./data/psql";
import { migrateDatabase } from "./db-migrate";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseUrl = configuredDatabaseUrl;

async function scalar(sql: string): Promise<number> {
  const value = Number((await runPsql(databaseUrl, sql, { tuplesOnly: true })).stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${value}`);
  return value;
}

async function expectSqlFailure(sql: string, pattern: string): Promise<void> {
  try {
    await runPsql(databaseUrl, sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(pattern)) throw error;
    return;
  }
  throw new Error(`EXPECTED_SQL_FAILURE:${pattern}`);
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  if (migration.applied.join(",") !== manifest.map((item) => item.version).join(",")) {
    throw new Error("CALIBRATION_MIGRATION_MANIFEST_APPLICATION_FAILURE");
  }

  const ingestionRun = "11111111-1111-4111-8111-111111111111";
  const resolutionRun = "22222222-2222-4222-8222-222222222222";
  const sourceFingerprint = "1".repeat(32);
  const resolutionFingerprint = "2".repeat(32);
  const snapshotId = "context:calibration-fixture";
  const digest = "a".repeat(64);

  await runPsql(databaseUrl, `
INSERT INTO ooh_data.ingestion_runs (
  run_id, status, catalog_version, seed_schema_version, loader_version,
  seed_report_sha256, staging_storage_uri, completed_at
) VALUES (
  '${ingestionRun}'::uuid, 'succeeded', 'fixture-v1', 1, 'fixture-loader-v1',
  '${"9".repeat(64)}', 'file:///fixture/staging', now()
);

INSERT INTO ooh_data.resolution_runs (
  run_id, resolver_version, run_kind, status, completed_at
) VALUES (
  '${resolutionRun}'::uuid, 'entity-resolver-v1', 'rebuild', 'succeeded', now()
);

INSERT INTO ooh_data.context_feature_snapshots (
  snapshot_id, feature_version, resolver_version,
  source_ingestion_run_id, resolution_rebuild_run_id,
  source_fingerprint, resolution_fingerprint, source_manifest, resolution_manifest
) VALUES (
  '${snapshotId}', 'planner-context-v1', 'entity-resolver-v1',
  '${ingestionRun}'::uuid, '${resolutionRun}'::uuid,
  '${sourceFingerprint}', '${resolutionFingerprint}', '{}'::jsonb, '{}'::jsonb
);

INSERT INTO ooh_data.calibration_evidence_packages (
  package_digest, package_version, evidence_environment, model_version, replay_version,
  geography_id, applicability_scope, context_feature_snapshot_id, context_feature_version,
  resolver_version, source_fingerprint, resolution_fingerprint,
  movement_calibration_report, canonical_manifest
) VALUES (
  '${digest}', 'calibration-evidence-package-v1', 'test_fixture',
  'movement-model-v2', 'movement-replay-v2', 'nga-lagos', 'fixture-only',
  '${snapshotId}', 'planner-context-v1', 'entity-resolver-v1',
  '${sourceFingerprint}', '${resolutionFingerprint}',
  '{"heldOutLocations":3,"directionalBlocks":192}'::jsonb,
  '{"fixture":true}'::jsonb
);

INSERT INTO ooh_data.calibration_evidence_artifacts (
  package_digest, artifact_id, artifact_sha256, evidence_kind, usage_role,
  provenance_uri, retained_uri, license_id, rights_review_ref,
  commercial_use_status, period_start, period_end
) VALUES
  ('${digest}', 'movement-holdout', '${"1".repeat(64)}', 'movement_truth', 'held_out_validation',
   'https://evidence.example/movement', 'file:///retained/movement', 'fixture-license', 'fixture:rights:1', 'permitted', '2026-01-01', '2026-01-31'),
  ('${digest}', 'geometry-holdout', '${"2".repeat(64)}', 'exposure_geometry_truth', 'held_out_validation',
   'https://evidence.example/geometry', 'file:///retained/geometry', 'fixture-license', 'fixture:rights:2', 'permitted', '2026-01-01', '2026-01-31'),
  ('${digest}', 'target-holdout', '${"3".repeat(64)}', 'target_panel_truth', 'held_out_validation',
   'https://evidence.example/target', 'file:///retained/target', 'fixture-license', 'fixture:rights:3', 'permitted', '2026-01-01', '2026-01-31'),
  ('${digest}', 'downstream-holdout', '${"4".repeat(64)}', 'downstream_validation_result', 'held_out_validation',
   'https://evidence.example/downstream', 'file:///retained/downstream', 'fixture-license', 'fixture:rights:4', 'permitted', '2026-01-01', '2026-01-31'),
  ('${digest}', 'movement-replication', '${"5".repeat(64)}', 'movement_truth', 'independent_date_replication',
   'https://evidence.example/replication', 'file:///retained/replication', 'fixture-license', 'fixture:rights:5', 'permitted', '2026-02-01', '2026-02-28');

INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, package_digest, policy_version, evidence_environment,
  validation_status, eligible_for_evidence_c, submitted_manifest,
  promotion_failure_codes
) VALUES (
  '33333333-3333-4333-8333-333333333333'::uuid, '${digest}', '${digest}',
  'calibration-promotion-policy-v1', 'test_fixture', 'accepted', false,
  '{"fixture":true}'::jsonb, ARRAY['TEST_FIXTURE_NOT_PROMOTABLE']::text[]
);
`);

  await runPsql(databaseUrl, `
INSERT INTO ooh_data.calibration_evidence_packages (
  package_digest, package_version, evidence_environment, model_version, replay_version,
  geography_id, applicability_scope, context_feature_snapshot_id, context_feature_version,
  resolver_version, source_fingerprint, resolution_fingerprint,
  movement_calibration_report, canonical_manifest
)
SELECT package_digest, package_version, evidence_environment, model_version, replay_version,
       geography_id, applicability_scope, context_feature_snapshot_id, context_feature_version,
       resolver_version, source_fingerprint, resolution_fingerprint,
       movement_calibration_report, canonical_manifest
FROM ooh_data.calibration_evidence_packages
WHERE package_digest='${digest}'
ON CONFLICT (package_digest) DO NOTHING;
`);

  if (await scalar(`SELECT count(*) FROM ooh_data.calibration_evidence_packages WHERE package_digest='${digest}';`) !== 1) {
    throw new Error("CALIBRATION_PACKAGE_REPLAY_NOT_IDEMPOTENT");
  }
  if (await scalar(`SELECT count(*) FROM ooh_data.calibration_evidence_artifacts WHERE package_digest='${digest}';`) !== 5) {
    throw new Error("CALIBRATION_ARTIFACT_REGISTRATION_FAILURE");
  }

  await expectSqlFailure(
    `UPDATE ooh_data.calibration_evidence_packages SET model_version='mutated' WHERE package_digest='${digest}';`,
    "CALIBRATION_EVIDENCE_IMMUTABLE:calibration_evidence_packages",
  );
  await expectSqlFailure(
    `DELETE FROM ooh_data.calibration_evidence_artifacts WHERE package_digest='${digest}' AND artifact_id='movement-holdout';`,
    "CALIBRATION_EVIDENCE_IMMUTABLE:calibration_evidence_artifacts",
  );
  await expectSqlFailure(
    `UPDATE ooh_data.calibration_promotion_runs SET eligible_for_evidence_c=true WHERE run_id='33333333-3333-4333-8333-333333333333'::uuid;`,
    "CALIBRATION_EVIDENCE_IMMUTABLE:calibration_promotion_runs",
  );

  await expectSqlFailure(`
INSERT INTO ooh_data.calibration_evidence_packages (
  package_digest, package_version, evidence_environment, model_version, replay_version,
  geography_id, applicability_scope, context_feature_snapshot_id, context_feature_version,
  resolver_version, source_fingerprint, resolution_fingerprint,
  movement_calibration_report, canonical_manifest
) VALUES (
  '${"b".repeat(64)}', 'calibration-evidence-package-v1', 'test_fixture',
  'movement-model-v2', 'movement-replay-v2', 'nga-lagos', 'fixture-only',
  '${snapshotId}', 'planner-context-v1', 'entity-resolver-v1',
  '${"3".repeat(32)}', '${resolutionFingerprint}', '{}'::jsonb, '{}'::jsonb
);`, "CALIBRATION_CONTEXT_BINDING_MISMATCH");

  await runPsql(databaseUrl, `
INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, policy_version, evidence_environment, validation_status,
  package_failure_codes, eligible_for_evidence_c, submitted_manifest
) VALUES (
  '44444444-4444-4444-8444-444444444444'::uuid, '${"b".repeat(64)}',
  'calibration-promotion-policy-v1', 'test_fixture', 'rejected',
  ARRAY['CALIBRATION_CONTEXT_BINDING_MISMATCH']::text[], false, '{"fixture":true}'::jsonb
);
`);
  if (await scalar(`SELECT count(*) FROM ooh_data.calibration_promotion_runs WHERE validation_status='rejected';`) !== 1) {
    throw new Error("CALIBRATION_REJECTION_AUDIT_FAILURE");
  }

  await expectSqlFailure(`
INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, package_digest, policy_version, evidence_environment,
  validation_status, eligible_for_evidence_c, submitted_manifest
) VALUES (
  '55555555-5555-4555-8555-555555555555'::uuid, '${digest}', '${digest}',
  'calibration-promotion-policy-v1', 'test_fixture', 'accepted', true, '{"fixture":true}'::jsonb
);`, "calibration_promotion_runs_check");

  process.stdout.write(`${JSON.stringify({
    ok: true,
    migrationCount: manifest.length,
    packageDigest: digest,
    registeredArtifacts: 5,
    rejectedRuns: 1,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`calibration evidence integration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
