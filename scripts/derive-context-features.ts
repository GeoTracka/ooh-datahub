import { randomUUID } from "node:crypto";
import { migrateDatabase } from "./db-migrate";
import { runPsql } from "./data/psql";
import { sqlLiteral } from "./data/persistenceFormat";
import { ENTITY_RESOLVER_VERSION } from "../src/dataResolution/normalize";

export const CONTEXT_FEATURE_VERSION = "context-features-v1";

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function derivationSql(runId: string): string {
  const featureVersion = sqlLiteral(CONTEXT_FEATURE_VERSION);
  const resolverVersion = sqlLiteral(ENTITY_RESOLVER_VERSION);
  const run = `${sqlLiteral(runId)}::uuid`;
  return `
\\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;

CREATE TEMP TABLE context_basis AS
WITH latest_ingestion AS (
  SELECT run_id, completed_at
  FROM ooh_data.ingestion_runs
  WHERE status = 'succeeded'
  ORDER BY completed_at DESC NULLS LAST, run_id DESC
  LIMIT 1
),
latest_resolution AS (
  SELECT run_id, completed_at
  FROM ooh_data.resolution_runs
  WHERE status = 'succeeded'
    AND run_kind = 'rebuild'
    AND resolver_version = ${resolverVersion}
  ORDER BY completed_at DESC NULLS LAST, run_id DESC
  LIMIT 1
),
source_state AS (
  SELECT
    i.run_id AS source_ingestion_run_id,
    i.completed_at AS source_completed_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('sourceId', s.source_id, 'sha256', s.source_sha256)
          ORDER BY s.source_id, s.source_sha256
        )
        FROM ooh_data.ingestion_run_sources s
        WHERE s.run_id = i.run_id
      ),
      '[]'::jsonb
    ) AS source_manifest,
    md5(COALESCE((
      SELECT string_agg(s.source_id || ':' || s.source_sha256, '|' ORDER BY s.source_id, s.source_sha256)
      FROM ooh_data.ingestion_run_sources s
      WHERE s.run_id = i.run_id
    ), '')) AS source_fingerprint
  FROM latest_ingestion i
),
resolution_state AS (
  SELECT
    r.run_id AS resolution_rebuild_run_id,
    r.completed_at AS resolution_completed_at,
    jsonb_build_object(
      'rebuildRunId', r.run_id,
      'resolverVersion', ${resolverVersion},
      'canonicalAliasCount', (
        SELECT count(*) FROM ooh_data.canonical_entity_aliases a
        WHERE a.resolver_version = ${resolverVersion}
      ),
      'airportAssertionCount', (
        SELECT count(*) FROM ooh_data.faan_airport_assertions a
        WHERE a.resolver_version = ${resolverVersion}
      )
    ) AS resolution_manifest,
    md5(
      COALESCE((
        SELECT string_agg(a.alias_id || ':' || a.canonical_entity_id, '|' ORDER BY a.alias_id)
        FROM ooh_data.canonical_entity_aliases a
        WHERE a.resolver_version = ${resolverVersion}
      ), '')
      || '|'
      || COALESCE((
        SELECT string_agg(
          a.record_scope || ':' || a.source_id || ':' || a.source_sha256 || ':' || a.source_record_id
          || ':' || a.airport_id || ':' || a.assertion_method,
          '|' ORDER BY a.record_scope, a.source_id, a.source_sha256, a.source_record_id
        )
        FROM ooh_data.faan_airport_assertions a
        WHERE a.resolver_version = ${resolverVersion}
      ), '')
    ) AS resolution_fingerprint
  FROM latest_resolution r
)
SELECT
  s.source_ingestion_run_id,
  s.source_completed_at,
  s.source_manifest,
  s.source_fingerprint,
  r.resolution_rebuild_run_id,
  r.resolution_completed_at,
  r.resolution_manifest,
  r.resolution_fingerprint,
  'context:' || md5(
    ${featureVersion} || '|' || ${resolverVersion} || '|'
    || s.source_fingerprint || '|' || r.resolution_fingerprint
  ) AS snapshot_id
FROM source_state s
CROSS JOIN resolution_state r;

DO $basis_guard$
DECLARE
  basis_count integer;
  source_count integer;
  source_completed timestamptz;
  resolution_completed timestamptz;
BEGIN
  SELECT count(*) INTO basis_count FROM context_basis;
  IF basis_count <> 1 THEN
    RAISE EXCEPTION 'CONTEXT_INPUT_BASIS_UNAVAILABLE';
  END IF;

  SELECT jsonb_array_length(source_manifest), source_completed_at, resolution_completed_at
  INTO source_count, source_completed, resolution_completed
  FROM context_basis;

  IF source_count = 0 THEN
    RAISE EXCEPTION 'CONTEXT_SOURCE_MANIFEST_EMPTY';
  END IF;
  IF resolution_completed < source_completed THEN
    RAISE EXCEPTION 'CONTEXT_RESOLUTION_STALE_FOR_SOURCE_SNAPSHOT';
  END IF;
END;
$basis_guard$;

UPDATE ooh_data.context_feature_runs r
SET
  source_ingestion_run_id = b.source_ingestion_run_id,
  resolution_rebuild_run_id = b.resolution_rebuild_run_id,
  source_fingerprint = b.source_fingerprint,
  resolution_fingerprint = b.resolution_fingerprint,
  snapshot_id = b.snapshot_id
FROM context_basis b
WHERE r.run_id = ${run};

INSERT INTO ooh_data.context_feature_snapshots (
  snapshot_id, feature_version, resolver_version, source_ingestion_run_id,
  resolution_rebuild_run_id, source_fingerprint, resolution_fingerprint,
  source_manifest, resolution_manifest, decision_use
)
SELECT
  snapshot_id, ${featureVersion}, ${resolverVersion}, source_ingestion_run_id,
  resolution_rebuild_run_id, source_fingerprint, resolution_fingerprint,
  source_manifest, resolution_manifest, 'context_only'
FROM context_basis
ON CONFLICT (snapshot_id) DO NOTHING;

CREATE TEMP TABLE context_ooh_active AS
SELECT
  o.*,
  state_alias.canonical_entity_id AS state_entity_id,
  city_alias.canonical_entity_id AS city_entity_id,
  category_alias.canonical_entity_id AS category_entity_id,
  format_alias.canonical_entity_id AS format_entity_id,
  advertiser_alias.canonical_entity_id AS advertiser_entity_id,
  brand_alias.canonical_entity_id AS brand_entity_id,
  CASE
    WHEN o.period->>'kind' = 'month'
      AND jsonb_typeof(o.period->'months') = 'array'
      AND jsonb_array_length(o.period->'months') = 1
    THEN (o.period->'months'->>0)::integer
    ELSE NULL
  END AS month_number
FROM ooh_data.ooh_observations o
JOIN context_basis b ON TRUE
JOIN ooh_data.ingestion_run_sources src
  ON src.run_id = b.source_ingestion_run_id
 AND src.source_id = o.source_id
 AND src.source_sha256 = o.source_sha256
LEFT JOIN ooh_data.canonical_entity_aliases state_alias
  ON state_alias.resolver_version = ${resolverVersion}
 AND state_alias.entity_type = 'state'
 AND state_alias.source_literal = o.state
LEFT JOIN ooh_data.canonical_entity_aliases city_alias
  ON city_alias.resolver_version = ${resolverVersion}
 AND city_alias.entity_type = 'city'
 AND city_alias.source_literal = o.city
LEFT JOIN ooh_data.canonical_entity_aliases category_alias
  ON category_alias.resolver_version = ${resolverVersion}
 AND category_alias.entity_type = 'category'
 AND category_alias.source_literal = o.category
LEFT JOIN ooh_data.canonical_entity_aliases format_alias
  ON format_alias.resolver_version = ${resolverVersion}
 AND format_alias.entity_type = 'format'
 AND format_alias.source_literal = o.format_category
LEFT JOIN ooh_data.canonical_entity_aliases advertiser_alias
  ON advertiser_alias.resolver_version = ${resolverVersion}
 AND advertiser_alias.entity_type = 'advertiser'
 AND advertiser_alias.source_literal = o.advertiser
LEFT JOIN ooh_data.canonical_entity_aliases brand_alias
  ON brand_alias.resolver_version = ${resolverVersion}
 AND brand_alias.entity_type = 'brand'
 AND brand_alias.source_literal = o.brand
WHERE o.canonical_status = 'active';

DO $ooh_mapping_guard$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count
  FROM context_ooh_active
  WHERE state_entity_id IS NULL
     OR city_entity_id IS NULL
     OR category_entity_id IS NULL
     OR format_entity_id IS NULL
     OR advertiser_entity_id IS NULL
     OR brand_entity_id IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'CONTEXT_CANONICAL_MAPPING_INCOMPLETE:%', missing_count;
  END IF;
END;
$ooh_mapping_guard$;

WITH rate_rows AS (
  SELECT
    year, quarter,
    state_entity_id, city_entity_id, category_entity_id, format_entity_id,
    'annual_source_rate_ngn'::text AS rate_basis,
    annual_rate_ngn AS rate_value
  FROM context_ooh_active
  UNION ALL
  SELECT
    year, quarter,
    state_entity_id, city_entity_id, category_entity_id, format_entity_id,
    'monthly_source_rate_ngn'::text AS rate_basis,
    monthly_rate_ngn AS rate_value
  FROM context_ooh_active
),
rate_groups AS (
  SELECT
    'national_category_format'::text AS benchmark_level,
    year, quarter,
    NULL::text AS state_entity_id,
    NULL::text AS city_entity_id,
    category_entity_id, format_entity_id, rate_basis,
    count(*) AS source_observation_count,
    count(rate_value) AS rate_observation_count,
    count(*) - count(rate_value) AS missing_rate_count,
    min(rate_value) AS minimum_rate_ngn,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL) AS p25_rate_ngn,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL) AS median_rate_ngn,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL) AS p75_rate_ngn,
    max(rate_value) AS maximum_rate_ngn,
    avg(rate_value) AS average_rate_ngn
  FROM rate_rows
  GROUP BY year, quarter, category_entity_id, format_entity_id, rate_basis

  UNION ALL

  SELECT
    'state_category_format', year, quarter,
    state_entity_id, NULL::text,
    category_entity_id, format_entity_id, rate_basis,
    count(*), count(rate_value), count(*) - count(rate_value),
    min(rate_value),
    percentile_cont(0.25) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL),
    max(rate_value), avg(rate_value)
  FROM rate_rows
  GROUP BY year, quarter, state_entity_id, category_entity_id, format_entity_id, rate_basis

  UNION ALL

  SELECT
    'city_category_format', year, quarter,
    state_entity_id, city_entity_id,
    category_entity_id, format_entity_id, rate_basis,
    count(*), count(rate_value), count(*) - count(rate_value),
    min(rate_value),
    percentile_cont(0.25) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY rate_value) FILTER (WHERE rate_value IS NOT NULL),
    max(rate_value), avg(rate_value)
  FROM rate_rows
  GROUP BY year, quarter, state_entity_id, city_entity_id, category_entity_id, format_entity_id, rate_basis
)
INSERT INTO ooh_data.ooh_source_rate_benchmarks (
  benchmark_id, snapshot_id, benchmark_level, year, quarter_label,
  state_entity_id, city_entity_id, category_entity_id, format_entity_id,
  rate_basis, source_observation_count, rate_observation_count, missing_rate_count,
  minimum_rate_ngn, p25_rate_ngn, median_rate_ngn, p75_rate_ngn,
  maximum_rate_ngn, average_rate_ngn, semantic_label, decision_use
)
SELECT
  'rate:' || md5(
    b.snapshot_id || '|' || g.benchmark_level || '|' || g.year || '|' || g.quarter || '|'
    || COALESCE(g.state_entity_id, '-') || '|' || COALESCE(g.city_entity_id, '-') || '|'
    || g.category_entity_id || '|' || g.format_entity_id || '|' || g.rate_basis
  ),
  b.snapshot_id, g.benchmark_level, g.year, g.quarter,
  g.state_entity_id, g.city_entity_id, g.category_entity_id, g.format_entity_id,
  g.rate_basis, g.source_observation_count, g.rate_observation_count, g.missing_rate_count,
  g.minimum_rate_ngn, g.p25_rate_ngn, g.median_rate_ngn, g.p75_rate_ngn,
  g.maximum_rate_ngn, g.average_rate_ngn,
  'source_rate_distribution_not_booked_price', 'context_only'
FROM rate_groups g
CROSS JOIN context_basis b
ON CONFLICT (benchmark_id) DO NOTHING;

WITH entities AS (
  SELECT
    o.year,
    o.quarter,
    o.month_number,
    o.state_entity_id,
    o.city_entity_id,
    e.entity_type,
    e.entity_id
  FROM context_ooh_active o
  CROSS JOIN LATERAL (VALUES
    ('advertiser'::text, o.advertiser_entity_id),
    ('brand'::text, o.brand_entity_id),
    ('category'::text, o.category_entity_id),
    ('format'::text, o.format_entity_id)
  ) e(entity_type, entity_id)
),
activity_groups AS (
  SELECT 'quarter'::text AS period_grain, year, quarter, NULL::integer AS month,
         'national'::text AS geography_level, NULL::text AS state_entity_id, NULL::text AS city_entity_id,
         entity_type, entity_id, count(*) AS observation_count
  FROM entities GROUP BY year, quarter, entity_type, entity_id
  UNION ALL
  SELECT 'quarter', year, quarter, NULL::integer,
         'state', state_entity_id, NULL::text,
         entity_type, entity_id, count(*)
  FROM entities GROUP BY year, quarter, state_entity_id, entity_type, entity_id
  UNION ALL
  SELECT 'quarter', year, quarter, NULL::integer,
         'city', state_entity_id, city_entity_id,
         entity_type, entity_id, count(*)
  FROM entities GROUP BY year, quarter, state_entity_id, city_entity_id, entity_type, entity_id
  UNION ALL
  SELECT 'month', year, quarter, month_number,
         'national', NULL::text, NULL::text,
         entity_type, entity_id, count(*)
  FROM entities WHERE month_number IS NOT NULL
  GROUP BY year, quarter, month_number, entity_type, entity_id
  UNION ALL
  SELECT 'month', year, quarter, month_number,
         'state', state_entity_id, NULL::text,
         entity_type, entity_id, count(*)
  FROM entities WHERE month_number IS NOT NULL
  GROUP BY year, quarter, month_number, state_entity_id, entity_type, entity_id
  UNION ALL
  SELECT 'month', year, quarter, month_number,
         'city', state_entity_id, city_entity_id,
         entity_type, entity_id, count(*)
  FROM entities WHERE month_number IS NOT NULL
  GROUP BY year, quarter, month_number, state_entity_id, city_entity_id, entity_type, entity_id
)
INSERT INTO ooh_data.ooh_entity_activity_context (
  activity_id, snapshot_id, period_grain, year, quarter_label, month,
  geography_level, state_entity_id, city_entity_id, entity_type, entity_id,
  observation_count, semantic_label, decision_use
)
SELECT
  'activity:' || md5(
    b.snapshot_id || '|' || g.period_grain || '|' || g.year || '|' || g.quarter || '|'
    || COALESCE(g.month::text, '-') || '|' || g.geography_level || '|'
    || COALESCE(g.state_entity_id, '-') || '|' || COALESCE(g.city_entity_id, '-') || '|'
    || g.entity_type || '|' || g.entity_id
  ),
  b.snapshot_id, g.period_grain, g.year, g.quarter, g.month,
  g.geography_level, g.state_entity_id, g.city_entity_id, g.entity_type, g.entity_id,
  g.observation_count, 'historical_source_observation_activity', 'context_only'
FROM activity_groups g
CROSS JOIN context_basis b
ON CONFLICT (activity_id) DO NOTHING;

INSERT INTO ooh_data.ooh_period_coverage_context (
  coverage_id, snapshot_id, year, quarter_label, period_kind,
  observation_count, month_eligible, decision_use
)
SELECT
  'period:' || md5(b.snapshot_id || '|' || o.year || '|' || o.quarter || '|' || (o.period->>'kind')),
  b.snapshot_id, o.year, o.quarter, o.period->>'kind',
  count(*),
  (o.period->>'kind' = 'month'),
  'context_only'
FROM context_ooh_active o
CROSS JOIN context_basis b
GROUP BY b.snapshot_id, o.year, o.quarter, o.period->>'kind'
ON CONFLICT (coverage_id) DO NOTHING;

CREATE TEMP TABLE context_faan_monthly AS
SELECT
  f.*,
  a.airport_id,
  COALESCE(f.scope, 'unscoped') AS scope_key,
  CASE
    WHEN f.metric = 'passenger' THEN 'persons'
    WHEN f.metric = 'aircraft' THEN 'aircraft_movements'
    ELSE COALESCE(NULLIF(trim(f.unit), ''), 'source_unit_unspecified')
  END AS unit_key
FROM ooh_data.faan_monthly_observations f
JOIN context_basis b ON TRUE
JOIN ooh_data.ingestion_run_sources src
  ON src.run_id = b.source_ingestion_run_id
 AND src.source_id = f.source_id
 AND src.source_sha256 = f.source_sha256
LEFT JOIN ooh_data.faan_airport_assertions a
  ON a.resolver_version = ${resolverVersion}
 AND a.record_scope = 'monthly'
 AND a.source_id = f.source_id
 AND a.source_sha256 = f.source_sha256
 AND a.source_record_id = f.source_record_id;

INSERT INTO ooh_data.faan_resolution_coverage_context (
  coverage_id, snapshot_id, year, month, metric, scope_key, unit_key,
  source_record_count, resolved_airport_count, unresolved_airport_count,
  derived_available_count, source_total_mismatch_count, decision_use
)
SELECT
  'faan-coverage:' || md5(
    b.snapshot_id || '|' || f.year || '|' || f.month || '|' || f.metric || '|'
    || f.scope_key || '|' || f.unit_key
  ),
  b.snapshot_id, f.year, f.month, f.metric, f.scope_key, f.unit_key,
  count(*),
  count(*) FILTER (WHERE f.airport_id IS NOT NULL),
  count(*) FILTER (WHERE f.airport_id IS NULL),
  count(f.derived_total),
  count(*) FILTER (WHERE f.quality_flags ? 'reported_total_mismatch'),
  'context_only'
FROM context_faan_monthly f
CROSS JOIN context_basis b
GROUP BY b.snapshot_id, f.year, f.month, f.metric, f.scope_key, f.unit_key
ON CONFLICT (coverage_id) DO NOTHING;

INSERT INTO ooh_data.faan_airport_activity_context (
  context_id, snapshot_id, airport_id, year, month, metric, scope_key, unit_key,
  source_record_count, derived_available_count, missing_derived_count,
  derived_total_sum, source_reported_total_sum, source_total_mismatch_count,
  semantic_label, decision_use
)
SELECT
  'faan-context:' || md5(
    b.snapshot_id || '|' || f.airport_id || '|' || f.year || '|' || f.month || '|'
    || f.metric || '|' || f.scope_key || '|' || f.unit_key
  ),
  b.snapshot_id, f.airport_id, f.year, f.month, f.metric, f.scope_key, f.unit_key,
  count(*),
  count(f.derived_total),
  count(*) - count(f.derived_total),
  sum(f.derived_total) FILTER (WHERE f.derived_total IS NOT NULL),
  sum(f.reported_total) FILTER (WHERE f.reported_total IS NOT NULL),
  count(*) FILTER (WHERE f.quality_flags ? 'reported_total_mismatch'),
  'airport_directional_activity_context_not_billboard_footfall',
  'context_only'
FROM context_faan_monthly f
CROSS JOIN context_basis b
WHERE f.airport_id IS NOT NULL
GROUP BY b.snapshot_id, f.airport_id, f.year, f.month, f.metric, f.scope_key, f.unit_key
ON CONFLICT (context_id) DO NOTHING;

UPDATE ooh_data.context_feature_runs r
SET
  status = 'succeeded',
  completed_at = now(),
  counts = jsonb_build_object(
    'sourceRateBenchmarks', (SELECT count(*) FROM ooh_data.ooh_source_rate_benchmarks x WHERE x.snapshot_id = b.snapshot_id),
    'oohEntityActivity', (SELECT count(*) FROM ooh_data.ooh_entity_activity_context x WHERE x.snapshot_id = b.snapshot_id),
    'oohPeriodCoverage', (SELECT count(*) FROM ooh_data.ooh_period_coverage_context x WHERE x.snapshot_id = b.snapshot_id),
    'faanAirportContext', (SELECT count(*) FROM ooh_data.faan_airport_activity_context x WHERE x.snapshot_id = b.snapshot_id),
    'faanResolutionCoverage', (SELECT count(*) FROM ooh_data.faan_resolution_coverage_context x WHERE x.snapshot_id = b.snapshot_id)
  )
FROM context_basis b
WHERE r.run_id = ${run};

COMMIT;
`;
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = detail.split(":")[0] || "CONTEXT_DERIVATION_FAILED";
  await runPsql(databaseUrl, `
UPDATE ooh_data.context_feature_runs
SET status = 'failed', completed_at = now(),
    error_code = ${sqlLiteral(code)}, error_detail = ${sqlLiteral(detail)}
WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';
`);
}

export async function deriveContextFeatures(): Promise<{ runId: string; snapshotId: string }> {
  const databaseUrl = requiredDatabaseUrl();
  await migrateDatabase();
  const runId = randomUUID();
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.context_feature_runs (
  run_id, feature_version, resolver_version, status
) VALUES (
  ${sqlLiteral(runId)}::uuid,
  ${sqlLiteral(CONTEXT_FEATURE_VERSION)},
  ${sqlLiteral(ENTITY_RESOLVER_VERSION)},
  'running'
);
`);

  try {
    await runPsql(databaseUrl, derivationSql(runId));
  } catch (error) {
    try {
      await markFailed(databaseUrl, runId, error);
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : String(auditError);
      process.stderr.write(`data:derive failure-audit warning: ${auditMessage}\n`);
    }
    throw error;
  }

  const result = await runPsql(
    databaseUrl,
    `SELECT snapshot_id FROM ooh_data.context_feature_runs WHERE run_id=${sqlLiteral(runId)}::uuid;\n`,
    { tuplesOnly: true },
  );
  const snapshotId = result.stdout.trim();
  if (!snapshotId) throw new Error("CONTEXT_SNAPSHOT_ID_MISSING_AFTER_SUCCESS");
  return { runId, snapshotId };
}

if (process.argv[1]?.endsWith("derive-context-features.ts")) {
  deriveContextFeatures()
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`data:derive failed: ${message}\n`);
      process.exitCode = 1;
    });
}
