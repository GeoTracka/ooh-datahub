CREATE TABLE IF NOT EXISTS ooh_data.resolution_runs (
  run_id uuid PRIMARY KEY,
  resolver_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_detail text,
  CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS resolution_runs_version_status_idx
  ON ooh_data.resolution_runs (resolver_version, status, started_at DESC);

CREATE TABLE IF NOT EXISTS ooh_data.canonical_entities (
  entity_id text PRIMARY KEY,
  entity_type text NOT NULL CHECK (
    entity_type IN ('advertiser', 'brand', 'category', 'format', 'state', 'city')
  ),
  normalized_key text NOT NULL,
  canonical_name text NOT NULL,
  resolver_version text NOT NULL,
  representative_observation_count bigint NOT NULL DEFAULT 0 CHECK (representative_observation_count >= 0),
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  UNIQUE (entity_type, normalized_key, resolver_version)
);

CREATE TABLE IF NOT EXISTS ooh_data.canonical_entity_aliases (
  alias_id text PRIMARY KEY,
  entity_type text NOT NULL CHECK (
    entity_type IN ('advertiser', 'brand', 'category', 'format', 'state', 'city')
  ),
  source_literal text NOT NULL,
  normalized_key text NOT NULL,
  canonical_entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  mapping_method text NOT NULL CHECK (mapping_method IN ('exact_normalized', 'manual_review')),
  resolver_version text NOT NULL,
  observation_count bigint NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  first_observed_year integer,
  last_observed_year integer,
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  UNIQUE (entity_type, source_literal, resolver_version)
);

CREATE INDEX IF NOT EXISTS canonical_alias_lookup_idx
  ON ooh_data.canonical_entity_aliases (entity_type, normalized_key, resolver_version);

CREATE TABLE IF NOT EXISTS ooh_data.site_entities (
  site_id text PRIMARY KEY,
  strict_key text NOT NULL,
  resolver_version text NOT NULL,
  identity_status text NOT NULL DEFAULT 'candidate' CHECK (identity_status IN ('candidate', 'confirmed', 'rejected')),
  state_entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  city_entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  format_entity_id text NOT NULL REFERENCES ooh_data.canonical_entities (entity_id) ON DELETE RESTRICT,
  representative_address text NOT NULL,
  normalized_address text NOT NULL,
  representative_board_type text NOT NULL,
  normalized_board_type text NOT NULL,
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  UNIQUE (resolver_version, strict_key)
);

CREATE TABLE IF NOT EXISTS ooh_data.site_observation_assertions (
  resolver_version text NOT NULL,
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_record_id text NOT NULL,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  assertion_method text NOT NULL CHECK (assertion_method IN ('strict_normalized_location_format', 'manual_review')),
  assertion_status text NOT NULL CHECK (assertion_status IN ('candidate', 'confirmed', 'rejected')),
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  PRIMARY KEY (resolver_version, source_id, source_sha256, source_record_id),
  FOREIGN KEY (source_id, source_sha256, source_record_id)
    REFERENCES ooh_data.ooh_observations (source_id, source_sha256, source_record_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS site_observation_assertions_site_idx
  ON ooh_data.site_observation_assertions (site_id, resolver_version);

CREATE TABLE IF NOT EXISTS ooh_data.media_owner_entities (
  owner_id text PRIMARY KEY,
  canonical_name text NOT NULL,
  normalized_key text NOT NULL,
  registry_namespace text NOT NULL,
  registry_revision text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registry_namespace, registry_revision, normalized_key)
);

CREATE TABLE IF NOT EXISTS ooh_data.media_owner_aliases (
  alias_id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES ooh_data.media_owner_entities (owner_id) ON DELETE RESTRICT,
  source_literal text NOT NULL,
  normalized_key text NOT NULL,
  evidence_source_id text NOT NULL,
  evidence_revision text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, source_literal, evidence_source_id, evidence_revision)
);

CREATE TABLE IF NOT EXISTS ooh_data.site_media_owner_assertions (
  assertion_id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  owner_id text NOT NULL REFERENCES ooh_data.media_owner_entities (owner_id) ON DELETE RESTRICT,
  assertion_status text NOT NULL CHECK (assertion_status IN ('approved', 'revoked')),
  mapping_method text NOT NULL CHECK (mapping_method IN ('authoritative_registry', 'supplier_attestation', 'manual_review')),
  evidence_source_id text NOT NULL,
  evidence_revision text NOT NULL,
  asserted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, evidence_source_id, evidence_revision)
);

CREATE TABLE IF NOT EXISTS ooh_data.airport_entities (
  airport_id text PRIMARY KEY,
  normalized_name_key text NOT NULL,
  canonical_name text NOT NULL,
  state_normalized_key text,
  resolver_version text NOT NULL,
  identity_status text NOT NULL DEFAULT 'candidate' CHECK (identity_status IN ('candidate', 'confirmed', 'rejected')),
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  UNIQUE (resolver_version, normalized_name_key)
);

CREATE TABLE IF NOT EXISTS ooh_data.airport_aliases (
  alias_id text PRIMARY KEY,
  airport_id text NOT NULL REFERENCES ooh_data.airport_entities (airport_id) ON DELETE RESTRICT,
  source_literal text NOT NULL,
  normalized_key text NOT NULL,
  alias_kind text NOT NULL CHECK (alias_kind IN ('airport_name', 'state_anchor', 'airport_label', 'manual')),
  mapping_method text NOT NULL CHECK (mapping_method IN ('exact_normalized', 'unique_state_anchor', 'manual_review')),
  resolver_version text NOT NULL,
  observation_count bigint NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  UNIQUE (resolver_version, alias_kind, source_literal)
);

CREATE TABLE IF NOT EXISTS ooh_data.faan_airport_assertions (
  resolver_version text NOT NULL,
  record_scope text NOT NULL CHECK (record_scope IN ('monthly', 'annual')),
  source_id text NOT NULL,
  source_sha256 text NOT NULL,
  source_record_id text NOT NULL,
  airport_id text NOT NULL REFERENCES ooh_data.airport_entities (airport_id) ON DELETE RESTRICT,
  assertion_method text NOT NULL CHECK (assertion_method IN ('exact_airport_name', 'exact_airport_label', 'unique_state_anchor', 'manual_review')),
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  PRIMARY KEY (resolver_version, record_scope, source_id, source_sha256, source_record_id)
);

CREATE INDEX IF NOT EXISTS faan_airport_assertions_airport_idx
  ON ooh_data.faan_airport_assertions (airport_id, resolver_version);

CREATE TABLE IF NOT EXISTS ooh_data.resolution_review_items (
  review_id text PRIMARY KEY,
  domain text NOT NULL CHECK (domain IN ('site_identity', 'airport_identity', 'media_owner')),
  resolver_version text NOT NULL,
  source_id text,
  source_sha256 text,
  record_scope text,
  source_record_id text,
  source_literal text,
  normalized_key text,
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'open' CHECK (review_status IN ('open', 'resolved', 'dismissed')),
  first_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  last_resolution_run_id uuid NOT NULL REFERENCES ooh_data.resolution_runs (run_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resolution_review_open_idx
  ON ooh_data.resolution_review_items (domain, review_status, resolver_version);

CREATE TABLE IF NOT EXISTS ooh_data.site_coordinate_assertions (
  assertion_id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  coordinate_accuracy_m double precision CHECK (coordinate_accuracy_m IS NULL OR coordinate_accuracy_m >= 0),
  source_kind text NOT NULL CHECK (source_kind IN ('customer_capture', 'field_survey', 'open_dataset', 'licensed_provider')),
  coordinate_source_id text NOT NULL,
  source_artifact_id text,
  spatial_rights text NOT NULL CHECK (spatial_rights IN ('customer_captured', 'open_licensed', 'provider_derived', 'unknown')),
  spatial_license_id text,
  assertion_status text NOT NULL CHECK (assertion_status IN ('pending', 'approved', 'rejected', 'revoked')),
  renderer_eligibility text NOT NULL CHECK (renderer_eligibility IN ('maplibre', 'provider_only', 'none')),
  planning_use text NOT NULL DEFAULT 'context_only' CHECK (planning_use = 'context_only'),
  enrichment_revision text NOT NULL,
  asserted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (assertion_status = 'approved' OR renderer_eligibility = 'none'),
  CHECK (
    assertion_status <> 'approved'
    OR (
      spatial_rights IN ('customer_captured', 'open_licensed')
      AND coordinate_accuracy_m IS NOT NULL
      AND spatial_license_id IS NOT NULL AND length(trim(spatial_license_id)) > 0
      AND source_artifact_id IS NOT NULL AND length(trim(source_artifact_id)) > 0
      AND renderer_eligibility = 'maplibre'
    )
    OR (
      spatial_rights = 'provider_derived'
      AND coordinate_accuracy_m IS NOT NULL
      AND source_artifact_id IS NOT NULL AND length(trim(source_artifact_id)) > 0
      AND renderer_eligibility = 'provider_only'
    )
  )
);

CREATE INDEX IF NOT EXISTS site_coordinate_assertions_site_status_idx
  ON ooh_data.site_coordinate_assertions (site_id, assertion_status);

CREATE OR REPLACE VIEW ooh_data.site_spatial_enrichment_queue AS
SELECT
  s.site_id,
  s.resolver_version,
  s.representative_address,
  st.canonical_name AS state_name,
  ct.canonical_name AS city_name,
  f.canonical_name AS format_name,
  s.identity_status,
  CASE
    WHEN s.identity_status <> 'confirmed' THEN 'site_identity_not_confirmed'
    ELSE 'approved_coordinate_missing'
  END AS reason
FROM ooh_data.site_entities s
JOIN ooh_data.canonical_entities st ON st.entity_id = s.state_entity_id
JOIN ooh_data.canonical_entities ct ON ct.entity_id = s.city_entity_id
JOIN ooh_data.canonical_entities f ON f.entity_id = s.format_entity_id
WHERE s.identity_status <> 'rejected'
  AND NOT EXISTS (
    SELECT 1
    FROM ooh_data.site_coordinate_assertions c
    WHERE c.site_id = s.site_id
      AND c.assertion_status = 'approved'
  );

CREATE OR REPLACE VIEW ooh_data.site_media_owner_status AS
SELECT
  s.site_id,
  COALESCE(o.owner_id, 'unknown') AS owner_id,
  COALESCE(o.canonical_name, 'Unknown') AS owner_name,
  CASE WHEN a.assertion_id IS NULL THEN 'unknown' ELSE a.assertion_status END AS owner_status
FROM ooh_data.site_entities s
LEFT JOIN LATERAL (
  SELECT assertion_id, owner_id, assertion_status
  FROM ooh_data.site_media_owner_assertions a
  WHERE a.site_id = s.site_id AND a.assertion_status = 'approved'
  ORDER BY a.asserted_at DESC, a.assertion_id
  LIMIT 1
) a ON TRUE
LEFT JOIN ooh_data.media_owner_entities o ON o.owner_id = a.owner_id;
