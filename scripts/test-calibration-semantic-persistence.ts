import { runPsql } from "./data/psql";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");

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

async function scalar(sql: string): Promise<number> {
  const value = Number((await runPsql(databaseUrl, sql, { tuplesOnly: true })).stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${value}`);
  return value;
}

async function main(): Promise<void> {
  const testDigest = "a".repeat(64);

  // T5A's integration fixture leaves one immutable test_fixture package in the
  // same CI database. A promotion run may not relabel that package as production.
  await expectSqlFailure(`
INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, package_digest, policy_version, movement_calibration_gate_version,
  evidence_environment, validation_status, movement_evaluation_version,
  movement_evaluation_digest, movement_report_verified, eligible_for_evidence_c,
  submitted_manifest
) VALUES (
  '66666666-6666-4666-8666-666666666666'::uuid,
  '${testDigest}', '${testDigest}', 'calibration-promotion-policy-v1', 'movement-calibration-gate-v1',
  'production_reviewed', 'accepted', 'movement-calibration-evaluation-v1',
  '${"7".repeat(64)}', true, true, '{"forged":true}'::jsonb
);`, "CALIBRATION_PROMOTION_PACKAGE_MISMATCH");

  // Even a package/run identity match cannot become eligible without an exact
  // semantic evaluation digest and verified report state.
  await expectSqlFailure(`
INSERT INTO ooh_data.calibration_promotion_runs (
  run_id, submitted_digest, package_digest, policy_version, movement_calibration_gate_version,
  evidence_environment, validation_status, movement_report_verified,
  eligible_for_evidence_c, submitted_manifest
) VALUES (
  '77777777-7777-4777-8777-777777777777'::uuid,
  '${testDigest}', '${testDigest}', 'calibration-promotion-policy-v1', 'movement-calibration-gate-v1',
  'test_fixture', 'accepted', false, true, '{"forged":true}'::jsonb
);`, "calibration_promotion_runs_check");

  if (await scalar(`
SELECT count(*)
FROM information_schema.columns
WHERE table_schema='ooh_data'
  AND table_name='calibration_promotion_runs'
  AND column_name IN (
    'movement_evaluation_version',
    'movement_evaluation_digest',
    'movement_report_verified',
    'evaluation_failure_codes'
  );`) !== 4) {
    throw new Error("CALIBRATION_SEMANTIC_AUDIT_COLUMNS_MISSING");
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    guardedPackageEnvironment: true,
    semanticAuditColumns: 4,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`calibration semantic persistence failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
