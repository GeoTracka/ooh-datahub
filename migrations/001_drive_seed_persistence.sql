CREATE SCHEMA IF NOT EXISTS ooh_data;

CREATE TABLE IF NOT EXISTS ooh_data.source_artifact_revisions (
  source_id text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, sha256)
);

CREATE TABLE IF NOT EXISTS ooh_data.source_artifact_locations (
  source_id text NOT NULL,
  sha256 text NOT NULL,
  storage_uri text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, sha256, storage_uri),
  FOREIGN KEY (source_id, sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ooh_data.ingestion_runs (
  run_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  catalog_version text NOT NULL,
  seed_schema_version integer NOT NULL,
  loader_version text NOT NULL,
  seed_report_sha256 text NOT NULL CHECK (seed_report_sha256 ~ '^[0-9a-f]{64}$'),
  staging_storage_uri text NOT NULL,
  staging_artifact_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  processed_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_flag_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_detail text,
  CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ingestion_runs_status_started_idx
  ON ooh_data.ingestion_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS ooh_data.ingestion_run_sources (
  run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE CASCADE,
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_run jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (run_id, source_id, source_sha256),
  FOREIGN KEY (source_id, source_sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ooh_data.ooh_observations (
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_record_id text NOT NULL,
  sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  first_ingestion_run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  canonical_status text NOT NULL CHECK (canonical_status IN ('active', 'superseded')),
  natural_key text NOT NULL,
  advertiser text NOT NULL,
  national_region text,
  state text NOT NULL,
  city text NOT NULL,
  address text,
  brand text NOT NULL,
  category text NOT NULL,
  board_type text NOT NULL,
  format_category text NOT NULL,
  classification text NOT NULL,
  annual_rate_ngn numeric,
  monthly_rate_ngn numeric,
  year integer NOT NULL,
  quarter text NOT NULL,
  period jsonb NOT NULL,
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(quality_flags) = 'array'),
  record_json jsonb NOT NULL,
  PRIMARY KEY (source_id, source_sha256, source_record_id),
  FOREIGN KEY (source_id, source_sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ooh_observations_query_idx
  ON ooh_data.ooh_observations (canonical_status, year, state, city);
CREATE INDEX IF NOT EXISTS ooh_observations_category_idx
  ON ooh_data.ooh_observations (category, brand, year);
CREATE INDEX IF NOT EXISTS ooh_observations_natural_key_idx
  ON ooh_data.ooh_observations (natural_key);

CREATE TABLE IF NOT EXISTS ooh_data.ooh_board_quality_observations (
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_record_id text NOT NULL,
  sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  first_ingestion_run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  natural_key text NOT NULL,
  company text NOT NULL,
  state text NOT NULL,
  city text NOT NULL,
  address text NOT NULL,
  brand text NOT NULL,
  category text NOT NULL,
  board_type text NOT NULL,
  board_quality text NOT NULL,
  classification text NOT NULL,
  annual_rate_ngn numeric,
  monthly_rate_ngn numeric,
  year integer NOT NULL,
  quarter text NOT NULL,
  period jsonb NOT NULL,
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(quality_flags) = 'array'),
  record_json jsonb NOT NULL,
  PRIMARY KEY (source_id, source_sha256, source_record_id),
  FOREIGN KEY (source_id, source_sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ooh_board_quality_query_idx
  ON ooh_data.ooh_board_quality_observations (year, state, city, board_quality);
CREATE INDEX IF NOT EXISTS ooh_board_quality_natural_key_idx
  ON ooh_data.ooh_board_quality_observations (natural_key);

CREATE TABLE IF NOT EXISTS ooh_data.faan_monthly_observations (
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_record_id text NOT NULL,
  sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  first_ingestion_run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  natural_key text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  month_label text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('passenger', 'aircraft', 'cargo', 'mail')),
  scope text CHECK (scope IS NULL OR scope IN ('domestic', 'international', 'hajj')),
  airport_state_label text,
  airport_name text,
  airport_label text,
  unit text,
  arrivals numeric,
  departures numeric,
  imports numeric,
  exports numeric,
  reported_total numeric,
  derived_total numeric,
  raw_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(quality_flags) = 'array'),
  record_json jsonb NOT NULL,
  PRIMARY KEY (source_id, source_sha256, source_record_id),
  FOREIGN KEY (source_id, source_sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS faan_monthly_metric_idx
  ON ooh_data.faan_monthly_observations (metric, year, month);
CREATE INDEX IF NOT EXISTS faan_monthly_airport_idx
  ON ooh_data.faan_monthly_observations (airport_state_label, airport_name, airport_label);
CREATE INDEX IF NOT EXISTS faan_monthly_natural_key_idx
  ON ooh_data.faan_monthly_observations (natural_key);

CREATE TABLE IF NOT EXISTS ooh_data.faan_annual_observations (
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_record_id text NOT NULL,
  sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  first_ingestion_run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  natural_key text NOT NULL,
  year integer NOT NULL,
  metric text NOT NULL CHECK (metric IN ('passenger', 'aircraft', 'cargo', 'mail')),
  scope text CHECK (scope IS NULL OR scope IN ('domestic', 'international', 'hajj')),
  airport_state_label text,
  airport_name text,
  airport_label text,
  unit text,
  arrivals numeric,
  departures numeric,
  imports numeric,
  exports numeric,
  reported_total numeric,
  derived_total numeric,
  prior_year_total numeric,
  growth_percent numeric,
  growth_difference numeric,
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(quality_flags) = 'array'),
  record_json jsonb NOT NULL,
  PRIMARY KEY (source_id, source_sha256, source_record_id),
  FOREIGN KEY (source_id, source_sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS faan_annual_metric_idx
  ON ooh_data.faan_annual_observations (metric, year);
CREATE INDEX IF NOT EXISTS faan_annual_airport_idx
  ON ooh_data.faan_annual_observations (airport_state_label, airport_name, airport_label);
CREATE INDEX IF NOT EXISTS faan_annual_natural_key_idx
  ON ooh_data.faan_annual_observations (natural_key);

CREATE TABLE IF NOT EXISTS ooh_data.quarantine_records (
  quarantine_id text PRIMARY KEY CHECK (quarantine_id ~ '^[0-9a-f]{64}$'),
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  sheet text NOT NULL,
  source_row integer NOT NULL CHECK (source_row > 0),
  reason text NOT NULL,
  raw jsonb NOT NULL,
  first_ingestion_run_id uuid NOT NULL REFERENCES ooh_data.ingestion_runs (run_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_id, source_sha256)
    REFERENCES ooh_data.source_artifact_revisions (source_id, sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS quarantine_source_reason_idx
  ON ooh_data.quarantine_records (source_id, source_sha256, reason);
