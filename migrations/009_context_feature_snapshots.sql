CREATE TABLE IF NOT EXISTS ooh_data.context_feature_snapshots (
  snapshot_id text PRIMARY KEY,
  feature_version text NOT NULL,
  resolver_version text NOT NULL,
  source_ingestion_run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  resolution_rebuild_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{32}$'),
  resolution_fingerprint text NOT NULL CHECK (resolution_fingerprint ~ '^[0-9a-f]{32}$'),
  source_manifest jsonb NOT NULL,
  resolution_manifest jsonb NOT NULL,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature_version, resolver_version, source_fingerprint, resolution_fingerprint)
);

CREATE TABLE IF NOT EXISTS ooh_data.context_feature_runs (
  run_id uuid PRIMARY KEY,
  feature_version text NOT NULL,
  resolver_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  source_ingestion_run_id uuid REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  resolution_rebuild_run_id uuid REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  source_fingerprint text CHECK (source_fingerprint IS NULL OR source_fingerprint ~ '^[0-9a-f]{32}$'),
  resolution_fingerprint text CHECK (resolution_fingerprint IS NULL OR resolution_fingerprint ~ '^[0-9a-f]{32}$'),
  snapshot_id text REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_code text,
  error_detail text,
  CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS context_feature_runs_status_idx
  ON ooh_data.context_feature_runs (feature_version, resolver_version, status, started_at DESC);

CREATE TABLE IF NOT EXISTS ooh_data.ooh_source_rate_benchmarks (
  benchmark_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  benchmark_level text NOT NULL CHECK (benchmark_level IN ('national_category_format', 'state_category_format', 'city_category_format')),
  year integer NOT NULL,
  quarter_label text NOT NULL,
  state_entity_id text REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  city_entity_id text REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  category_entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  format_entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  rate_basis text NOT NULL CHECK (rate_basis IN ('annual_source_rate_ngn', 'monthly_source_rate_ngn')),
  source_observation_count bigint NOT NULL CHECK (source_observation_count >= 0),
  rate_observation_count bigint NOT NULL CHECK (rate_observation_count >= 0),
  missing_rate_count bigint NOT NULL CHECK (missing_rate_count >= 0),
  minimum_rate_ngn numeric,
  p25_rate_ngn numeric,
  median_rate_ngn numeric,
  p75_rate_ngn numeric,
  maximum_rate_ngn numeric,
  average_rate_ngn numeric,
  semantic_label text NOT NULL DEFAULT 'source_rate_distribution_not_booked_price',
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  CHECK (rate_observation_count + missing_rate_count = source_observation_count)
);

CREATE INDEX IF NOT EXISTS ooh_source_rate_lookup_idx
  ON ooh_data.ooh_source_rate_benchmarks (
    snapshot_id, benchmark_level, year, quarter_label, category_entity_id, format_entity_id
  );

CREATE TABLE IF NOT EXISTS ooh_data.ooh_entity_activity_context (
  activity_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  period_grain text NOT NULL CHECK (period_grain IN ('quarter', 'month')),
  year integer NOT NULL,
  quarter_label text NOT NULL,
  month integer CHECK (month IS NULL OR month BETWEEN 1 AND 12),
  geography_level text NOT NULL CHECK (geography_level IN ('national', 'state', 'city')),
  state_entity_id text REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  city_entity_id text REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN ('advertiser', 'brand', 'category', 'format')),
  entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  observation_count bigint NOT NULL CHECK (observation_count > 0),
  semantic_label text NOT NULL DEFAULT 'historical_source_observation_activity',
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  CHECK ((period_grain = 'quarter' AND month IS NULL) OR (period_grain = 'month' AND month IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ooh_entity_activity_lookup_idx
  ON ooh_data.ooh_entity_activity_context (
    snapshot_id, entity_type, entity_id, period_grain, year, month
  );

CREATE TABLE IF NOT EXISTS ooh_data.ooh_period_coverage_context (
  coverage_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  year integer NOT NULL,
  quarter_label text NOT NULL,
  period_kind text NOT NULL CHECK (period_kind IN ('month', 'combined', 'quarter_only', 'unparsed')),
  observation_count bigint NOT NULL CHECK (observation_count >= 0),
  month_eligible boolean NOT NULL,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only')
);

CREATE INDEX IF NOT EXISTS ooh_period_coverage_lookup_idx
  ON ooh_data.ooh_period_coverage_context (snapshot_id, year, quarter_label, period_kind);

CREATE TABLE IF NOT EXISTS ooh_data.faan_airport_activity_context (
  context_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  airport_id text NOT NULL REFERENCES ooh_data.airport_entities (airport_id) ON DELETE RESTRICT,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  metric text NOT NULL CHECK (metric IN ('passenger', 'aircraft', 'cargo', 'mail')),
  scope_key text NOT NULL,
  unit_key text NOT NULL,
  source_record_count bigint NOT NULL CHECK (source_record_count > 0),
  derived_available_count bigint NOT NULL CHECK (derived_available_count >= 0),
  missing_derived_count bigint NOT NULL CHECK (missing_derived_count >= 0),
  derived_total_sum numeric,
  source_reported_total_sum numeric,
  source_total_mismatch_count bigint NOT NULL CHECK (source_total_mismatch_count >= 0),
  semantic_label text NOT NULL DEFAULT 'airport_directional_activity_context_not_billboard_footfall',
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  CHECK (derived_available_count + missing_derived_count = source_record_count)
);

CREATE INDEX IF NOT EXISTS faan_airport_context_lookup_idx
  ON ooh_data.faan_airport_activity_context (snapshot_id, airport_id, metric, year, month);

CREATE TABLE IF NOT EXISTS ooh_data.faan_resolution_coverage_context (
  coverage_id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES ooh_data.context_feature_snapshots (snapshot_id) ON DELETE RESTRICT,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  metric text NOT NULL CHECK (metric IN ('passenger', 'aircraft', 'cargo', 'mail')),
  scope_key text NOT NULL,
  unit_key text NOT NULL,
  source_record_count bigint NOT NULL CHECK (source_record_count >= 0),
  resolved_airport_count bigint NOT NULL CHECK (resolved_airport_count >= 0),
  unresolved_airport_count bigint NOT NULL CHECK (unresolved_airport_count >= 0),
  derived_available_count bigint NOT NULL CHECK (derived_available_count >= 0),
  source_total_mismatch_count bigint NOT NULL CHECK (source_total_mismatch_count >= 0),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  CHECK (resolved_airport_count + unresolved_airport_count = source_record_count)
);

CREATE INDEX IF NOT EXISTS faan_resolution_coverage_lookup_idx
  ON ooh_data.faan_resolution_coverage_context (snapshot_id, metric, year, month);

CREATE OR REPLACE VIEW ooh_data.latest_context_feature_snapshot AS
SELECT s.*
FROM ooh_data.context_feature_snapshots s
ORDER BY s.created_at DESC, s.snapshot_id DESC
LIMIT 1;
