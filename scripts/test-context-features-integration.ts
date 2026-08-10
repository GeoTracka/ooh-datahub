import { resolve } from "node:path";
import { loadMigrations } from "./data/migrations";
import { runPsql } from "./data/psql";
import { sqlLiteral } from "./data/persistenceFormat";
import { migrateDatabase } from "./db-migrate";
import { rebuildEntityResolution } from "./rebuild-entity-resolution";
import { deriveContextFeatures } from "./derive-context-features";
import { summarizeSourceRates } from "../src/contextFeatures/semantics";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseUrl: string = configuredDatabaseUrl;

function json(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

async function scalar(sql: string): Promise<number> {
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${result.stdout}`);
  return value;
}

async function text(sql: string): Promise<string> {
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  return result.stdout.trim();
}

async function seedFixture(): Promise<{ latestRunId: string }> {
  const oldRun = "10000000-0000-4000-8000-000000000001";
  const latestRun = "20000000-0000-4000-8000-000000000002";
  const oldOohSha = "1".repeat(64);
  const oldFaanSha = "2".repeat(64);
  const newOohSha = "3".repeat(64);
  const newFaanSha = "4".repeat(64);
  const reportSha = "5".repeat(64);

  await runPsql(databaseUrl, `
INSERT INTO ooh_data.source_artifact_revisions
  (source_id, sha256, drive_file_id, file_name, file_size_bytes)
VALUES
  ('fixture-ooh', '${oldOohSha}', 'drive-ooh-old', 'fixture-ooh-old.xlsx', 100),
  ('fixture-faan', '${oldFaanSha}', 'drive-faan-old', 'fixture-faan-old.xlsx', 100),
  ('fixture-ooh', '${newOohSha}', 'drive-ooh-new', 'fixture-ooh-new.xlsx', 110),
  ('fixture-faan', '${newFaanSha}', 'drive-faan-new', 'fixture-faan-new.xlsx', 110);

INSERT INTO ooh_data.ingestion_runs (
  run_id, status, catalog_version, seed_schema_version, loader_version,
  seed_report_sha256, staging_storage_uri, completed_at
) VALUES
  ('${oldRun}'::uuid, 'succeeded', 'fixture-old', 1, 'fixture-loader', '${reportSha}', 'file:///fixture-old/', now() - interval '20 minutes'),
  ('${latestRun}'::uuid, 'succeeded', 'fixture-new', 1, 'fixture-loader', '${reportSha}', 'file:///fixture-new/', now() - interval '10 minutes');

INSERT INTO ooh_data.ingestion_run_sources (run_id, source_id, source_sha256, source_run)
VALUES
  ('${oldRun}'::uuid, 'fixture-ooh', '${oldOohSha}', '{}'::jsonb),
  ('${oldRun}'::uuid, 'fixture-faan', '${oldFaanSha}', '{}'::jsonb),
  ('${latestRun}'::uuid, 'fixture-ooh', '${newOohSha}', '{}'::jsonb),
  ('${latestRun}'::uuid, 'fixture-faan', '${newFaanSha}', '{}'::jsonb);

INSERT INTO ooh_data.ooh_observations (
  source_id, source_sha256, source_record_id, sheet, source_row,
  first_ingestion_run_id, canonical_status, natural_key, advertiser,
  national_region, state, city, address, brand, category, board_type,
  format_category, classification, annual_rate_ngn, monthly_rate_ngn,
  year, quarter, period, quality_flags, record_json
) VALUES
  ('fixture-ooh', '${oldOohSha}', 'fixture-ooh:old:1', 'DATA', 2, '${oldRun}'::uuid,
   'active', 'old-natural', 'Old Advertiser', 'South West', 'Lagos', 'Ikeja', 'Old Road',
   'Old Brand', 'Drinks', 'Billboard', 'Large Format', 'Premium', 999999, 999999,
   2024, 'Q1', ${json({ kind: "month", rawMonth: "January", months: [1] })}, '[]'::jsonb, ${json({ old: true })}),

  ('fixture-ooh', '${newOohSha}', 'fixture-ooh:new:1', 'DATA', 2, '${latestRun}'::uuid,
   'active', 'new-1', 'ACME Ltd.', 'South West', 'Lagos', 'Ikeja', '1 Allen Ave',
   'Spark', 'Drinks', 'Billboard', 'Large Format', 'Premium', 1200, 100,
   2024, 'Q1', ${json({ kind: "month", rawMonth: "January", months: [1] })}, '[]'::jsonb, ${json({ row: 1 })}),
  ('fixture-ooh', '${newOohSha}', 'fixture-ooh:new:2', 'DATA', 3, '${latestRun}'::uuid,
   'active', 'new-2', 'ACME Ltd.', 'South West', 'Lagos', 'Ikeja', '1 Allen Ave',
   'Spark', 'Drinks', 'Billboard', 'Large Format', 'Premium', 2400, 200,
   2024, 'Q1', ${json({ kind: "month", rawMonth: "February", months: [2] })}, '[]'::jsonb, ${json({ row: 2 })}),
  ('fixture-ooh', '${newOohSha}', 'fixture-ooh:new:3', 'DATA', 4, '${latestRun}'::uuid,
   'active', 'new-3', 'ACME Ltd.', 'South West', 'Lagos', 'Ikeja', '1 Allen Ave',
   'Spark', 'Drinks', 'Billboard', 'Large Format', 'Premium', 3600, 300,
   2024, 'Q1', ${json({ kind: "combined", rawMonth: "January/February", months: [1, 2] })}, '[]'::jsonb, ${json({ row: 3 })}),
  ('fixture-ooh', '${newOohSha}', 'fixture-ooh:new:4', 'DATA', 5, '${latestRun}'::uuid,
   'active', 'new-4', 'ACME Ltd.', 'South West', 'Lagos', 'Ikeja', '1 Allen Ave',
   'Spark', 'Drinks', 'Billboard', 'Large Format', 'Premium', 4800, 400,
   2024, 'Q1', ${json({ kind: "quarter_only", rawMonth: null, months: [] })}, '[]'::jsonb, ${json({ row: 4 })}),
  ('fixture-ooh', '${newOohSha}', 'fixture-ooh:new:5', 'DATA', 6, '${latestRun}'::uuid,
   'active', 'new-5', 'ACME Ltd.', 'South West', 'Lagos', 'Ikeja', '1 Allen Ave',
   'Spark', 'Drinks', 'Billboard', 'Large Format', 'Premium', 6000, NULL,
   2024, 'Q1', ${json({ kind: "unparsed", rawMonth: "Odd period", months: [] })}, ${json(["unparsed_period"])}, ${json({ row: 5 })}),
  ('fixture-ooh', '${newOohSha}', 'fixture-ooh:new:superseded', 'DATA', 7, '${latestRun}'::uuid,
   'superseded', 'new-superseded', 'ACME Ltd.', 'South West', 'Lagos', 'Ikeja', '1 Allen Ave',
   'Spark', 'Drinks', 'Billboard', 'Large Format', 'Premium', 120000, 10000,
   2023, 'Q1', ${json({ kind: "month", rawMonth: "January", months: [1] })}, '[]'::jsonb, ${json({ superseded: true })});

INSERT INTO ooh_data.faan_monthly_observations (
  source_id, source_sha256, source_record_id, sheet, source_row,
  first_ingestion_run_id, natural_key, year, month, month_label,
  metric, scope, airport_state_label, airport_name, airport_label, unit,
  arrivals, departures, imports, exports, reported_total, derived_total,
  raw_values, quality_flags, record_json
) VALUES
  ('fixture-faan', '${oldFaanSha}', 'fixture-faan:old', 'PASSENGER', 2, '${oldRun}'::uuid,
   'old-faan', 2024, 1, 'January', 'passenger', 'domestic', 'Lagos', 'Old Airport', NULL, NULL,
   5000, 5000, NULL, NULL, 10000, 10000, '{}'::jsonb, '[]'::jsonb, ${json({ old: true })}),

  ('fixture-faan', '${newFaanSha}', 'fixture-faan:lagos:complete', 'PASSENGER', 3, '${latestRun}'::uuid,
   'new-faan-1', 2024, 1, 'January', 'passenger', 'domestic', 'Lagos', 'Murtala Muhammed International Airport', NULL, NULL,
   100, 110, NULL, NULL, 999, 210, '{}'::jsonb, ${json(["reported_total_mismatch"])}, ${json({ row: 1 })}),
  ('fixture-faan', '${newFaanSha}', 'fixture-faan:lagos:missing', 'PASSENGER', 4, '${latestRun}'::uuid,
   'new-faan-2', 2024, 1, 'January', 'passenger', 'domestic', 'Lagos', 'Murtala Muhammed International Airport', NULL, NULL,
   70, NULL, NULL, NULL, 150, NULL, '{}'::jsonb, ${json(["direction_missing"])}, ${json({ row: 2 })}),
  ('fixture-faan', '${newFaanSha}', 'fixture-faan:mystery', 'CARGO', 5, '${latestRun}'::uuid,
   'new-faan-3', 2024, 1, 'January', 'cargo', NULL, NULL, NULL, 'Mystery Airport', 'KG',
   NULL, NULL, 20, 30, 50, 50, '{}'::jsonb, '[]'::jsonb, ${json({ row: 3 })});
`);

  return { latestRunId: latestRun };
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  const expectedVersions = manifest.map((item) => item.version);
  if (migration.applied.join(",") !== expectedVersions.join(",")) {
    throw new Error(`MIGRATION_MANIFEST_APPLICATION_FAILURE:${migration.applied.join(",")}`);
  }

  const { latestRunId } = await seedFixture();
  await rebuildEntityResolution();

  const first = await deriveContextFeatures();
  const second = await deriveContextFeatures();
  if (second.snapshotId !== first.snapshotId) {
    throw new Error(`CONTEXT_SNAPSHOT_NOT_IDEMPOTENT:${first.snapshotId}:${second.snapshotId}`);
  }

  const snapshotCount = await scalar(`
SELECT count(*) FROM ooh_data.context_feature_snapshots WHERE snapshot_id=${sqlLiteral(first.snapshotId)};
`);
  if (snapshotCount !== 1) throw new Error(`CONTEXT_SNAPSHOT_DUPLICATED:${snapshotCount}`);
  const succeededRuns = await scalar(`
SELECT count(*) FROM ooh_data.context_feature_runs
WHERE snapshot_id=${sqlLiteral(first.snapshotId)} AND status='succeeded';
`);
  if (succeededRuns !== 2) throw new Error(`CONTEXT_RUN_AUDIT_FAILURE:${succeededRuns}`);
  const sourceRun = await text(`
SELECT source_ingestion_run_id::text
FROM ooh_data.context_feature_snapshots
WHERE snapshot_id=${sqlLiteral(first.snapshotId)};
`);
  if (sourceRun !== latestRunId) throw new Error(`LATEST_SOURCE_RUN_NOT_SELECTED:${sourceRun}`);

  const expectedRate = summarizeSourceRates([100, 200, 300, 400, null]);
  const rateRow = await text(`
SELECT
  source_observation_count || ':' || rate_observation_count || ':' || missing_rate_count || ':' ||
  p25_rate_ngn || ':' || median_rate_ngn || ':' || p75_rate_ngn || ':' || maximum_rate_ngn
FROM ooh_data.ooh_source_rate_benchmarks
WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  AND benchmark_level='city_category_format'
  AND year=2024 AND quarter_label='Q1'
  AND rate_basis='monthly_source_rate_ngn';
`);
  const expectedRateRow = [
    expectedRate.sourceObservationCount,
    expectedRate.rateObservationCount,
    expectedRate.missingRateCount,
    expectedRate.p25,
    expectedRate.median,
    expectedRate.p75,
    expectedRate.maximum,
  ].join(":");
  if (rateRow !== expectedRateRow) throw new Error(`SOURCE_RATE_STATISTICS_FAILURE:${rateRow}:${expectedRateRow}`);

  const extremeOldOrSuperseded = await scalar(`
SELECT count(*) FROM ooh_data.ooh_source_rate_benchmarks
WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  AND maximum_rate_ngn >= 999999;
`);
  if (extremeOldOrSuperseded !== 0) {
    throw new Error(`NONCANONICAL_SOURCE_RATE_LEAK:${extremeOldOrSuperseded}`);
  }

  const quarterActivity = await scalar(`
SELECT observation_count
FROM ooh_data.ooh_entity_activity_context a
JOIN ooh_data.canonical_entities e ON e.entity_id=a.entity_id
WHERE a.snapshot_id=${sqlLiteral(first.snapshotId)}
  AND a.period_grain='quarter'
  AND a.geography_level='national'
  AND a.entity_type='category'
  AND e.normalized_key='drinks'
  AND a.year=2024 AND a.quarter_label='Q1';
`);
  if (quarterActivity !== 5) throw new Error(`OOH_ACTIVE_ACTIVITY_COUNT_FAILURE:${quarterActivity}`);
  const monthlyActivity = await scalar(`
SELECT COALESCE(sum(observation_count), 0)
FROM ooh_data.ooh_entity_activity_context a
JOIN ooh_data.canonical_entities e ON e.entity_id=a.entity_id
WHERE a.snapshot_id=${sqlLiteral(first.snapshotId)}
  AND a.period_grain='month'
  AND a.geography_level='national'
  AND a.entity_type='category'
  AND e.normalized_key='drinks'
  AND a.year=2024;
`);
  if (monthlyActivity !== 2) throw new Error(`OOH_MONTH_FABRICATION_FAILURE:${monthlyActivity}`);

  const periodCoverage = await text(`
SELECT string_agg(period_kind || ':' || observation_count, ',' ORDER BY period_kind)
FROM ooh_data.ooh_period_coverage_context
WHERE snapshot_id=${sqlLiteral(first.snapshotId)} AND year=2024 AND quarter_label='Q1';
`);
  if (periodCoverage !== "combined:1,month:2,quarter_only:1,unparsed:1") {
    throw new Error(`OOH_PERIOD_COVERAGE_FAILURE:${periodCoverage}`);
  }

  const faanContext = await text(`
SELECT
  source_record_count || ':' || derived_available_count || ':' || missing_derived_count || ':' ||
  derived_total_sum || ':' || source_reported_total_sum || ':' || source_total_mismatch_count
FROM ooh_data.faan_airport_activity_context
WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  AND metric='passenger' AND scope_key='domestic'
  AND year=2024 AND month=1;
`);
  if (faanContext !== "2:1:1:210:1149:1") {
    throw new Error(`FAAN_DERIVED_TOTAL_POLICY_FAILURE:${faanContext}`);
  }
  const mysteryCoverage = await text(`
SELECT source_record_count || ':' || resolved_airport_count || ':' || unresolved_airport_count
FROM ooh_data.faan_resolution_coverage_context
WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  AND metric='cargo' AND year=2024 AND month=1;
`);
  if (mysteryCoverage !== "1:0:1") throw new Error(`FAAN_UNRESOLVED_COVERAGE_FAILURE:${mysteryCoverage}`);
  const mysteryContext = await scalar(`
SELECT count(*) FROM ooh_data.faan_airport_activity_context
WHERE snapshot_id=${sqlLiteral(first.snapshotId)} AND metric='cargo';
`);
  if (mysteryContext !== 0) throw new Error(`FAAN_UNRESOLVED_CONTEXT_LEAK:${mysteryContext}`);

  const decisionUses = await text(`
SELECT string_agg(DISTINCT decision_use, ',' ORDER BY decision_use)
FROM (
  SELECT decision_use FROM ooh_data.context_feature_snapshots WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  UNION ALL SELECT decision_use FROM ooh_data.ooh_source_rate_benchmarks WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  UNION ALL SELECT decision_use FROM ooh_data.ooh_entity_activity_context WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  UNION ALL SELECT decision_use FROM ooh_data.ooh_period_coverage_context WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  UNION ALL SELECT decision_use FROM ooh_data.faan_airport_activity_context WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
  UNION ALL SELECT decision_use FROM ooh_data.faan_resolution_coverage_context WHERE snapshot_id=${sqlLiteral(first.snapshotId)}
) uses;
`);
  if (decisionUses !== "context_only") throw new Error(`CONTEXT_ONLY_BOUNDARY_FAILURE:${decisionUses}`);

  process.stdout.write(JSON.stringify({
    ok: true,
    migrationCount: manifest.length,
    snapshotId: first.snapshotId,
    succeededRuns,
    sourceRun,
    rateRow,
    quarterActivity,
    monthlyActivity,
    periodCoverage,
    faanContext,
    mysteryCoverage,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`context feature integration failed: ${message}\n`);
  process.exitCode = 1;
});
