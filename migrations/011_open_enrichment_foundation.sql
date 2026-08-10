CREATE TABLE IF NOT EXISTS ooh_data.enrichment_artifacts (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  source_release text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  access_uri text NOT NULL,
  storage_uri text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  license_id text NOT NULL,
  attribution_text text NOT NULL,
  share_alike boolean NOT NULL,
  commercial_use_status text NOT NULL CHECK (commercial_use_status IN ('permitted', 'restricted', 'unknown')),
  acquisition_mode text NOT NULL CHECK (acquisition_mode IN ('snapshot', 'daily', 'monthly', 'api')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, artifact_sha256)
);

CREATE TABLE IF NOT EXISTS ooh_data.enrichment_runs (
  run_id uuid PRIMARY KEY,
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  adapter_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_detail text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS enrichment_runs_source_status_idx
  ON ooh_data.enrichment_runs (source_id, status, completed_at DESC);

CREATE TABLE IF NOT EXISTS ooh_data.open_airport_references (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  reference_id text NOT NULL,
  ident text NOT NULL,
  airport_type text NOT NULL,
  name text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  elevation_ft integer,
  continent text,
  iso_country text NOT NULL,
  iso_region text,
  municipality text,
  scheduled_service boolean NOT NULL,
  gps_code text,
  iata_code text,
  local_code text,
  home_link text,
  wikipedia_link text,
  keywords text,
  raw_record jsonb NOT NULL,
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, reference_id),
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS open_airport_references_country_name_idx
  ON ooh_data.open_airport_references (iso_country, name);
CREATE INDEX IF NOT EXISTS open_airport_references_iata_idx
  ON ooh_data.open_airport_references (iata_code) WHERE iata_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS open_airport_references_gps_idx
  ON ooh_data.open_airport_references (gps_code) WHERE gps_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS ooh_data.airport_open_reference_links (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  reference_id text NOT NULL,
  airport_id text NOT NULL REFERENCES ooh_data.airport_entities (airport_id) ON DELETE RESTRICT,
  link_method text NOT NULL CHECK (link_method IN ('exact_normalized_name', 'reviewed_code', 'manual_review')),
  link_status text NOT NULL CHECK (link_status IN ('candidate', 'confirmed', 'rejected')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  last_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, reference_id, airport_id),
  FOREIGN KEY (source_id, artifact_sha256, reference_id)
    REFERENCES ooh_data.open_airport_references (source_id, artifact_sha256, reference_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ooh_data.osm_advertising_candidates (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  osm_type text NOT NULL CHECK (osm_type IN ('node', 'way', 'relation', 'unknown')),
  osm_id text NOT NULL,
  geometry_type text NOT NULL,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  representative_method text NOT NULL CHECK (representative_method IN ('point', 'vertex_mean', 'unavailable')),
  advertising_type text NOT NULL,
  operator_name text,
  source_ref text,
  display_surface text,
  orientation text,
  direction text,
  size_text text,
  height_text text,
  lit text,
  luminous text,
  animated text,
  sides text,
  visibility text,
  message text,
  tags jsonb NOT NULL,
  geometry jsonb NOT NULL,
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, osm_type, osm_id),
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS osm_advertising_candidates_location_idx
  ON ooh_data.osm_advertising_candidates (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS osm_advertising_candidates_operator_idx
  ON ooh_data.osm_advertising_candidates (operator_name)
  WHERE operator_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS ooh_data.site_open_candidate_matches (
  source_id text NOT NULL,
  artifact_sha256 text NOT NULL,
  osm_type text NOT NULL,
  osm_id text NOT NULL,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  match_method text NOT NULL CHECK (match_method IN ('approved_coordinate_proximity', 'manual_review')),
  distance_m double precision CHECK (distance_m IS NULL OR distance_m >= 0),
  match_status text NOT NULL CHECK (match_status IN ('candidate', 'confirmed', 'rejected')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  last_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, osm_type, osm_id, site_id),
  FOREIGN KEY (source_id, artifact_sha256, osm_type, osm_id)
    REFERENCES ooh_data.osm_advertising_candidates (source_id, artifact_sha256, osm_type, osm_id)
    ON DELETE RESTRICT
);

CREATE OR REPLACE VIEW ooh_data.open_enrichment_attribution AS
SELECT DISTINCT
  source_id,
  artifact_sha256,
  source_release,
  license_id,
  attribution_text,
  share_alike,
  commercial_use_status,
  access_uri
FROM ooh_data.enrichment_artifacts;
