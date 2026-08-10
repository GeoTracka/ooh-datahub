CREATE TABLE IF NOT EXISTS ooh_data.grid3_settlement_features (
  source_id text NOT NULL CHECK (source_id = 'grid3-nigeria-settlements'),
  artifact_sha256 text NOT NULL,
  feature_id text NOT NULL,
  source_feature_id text NOT NULL,
  original_geometry_valid boolean NOT NULL,
  geometry_repaired boolean NOT NULL,
  building_count double precision CHECK (building_count IS NULL OR building_count >= 0),
  building_density double precision CHECK (building_density IS NULL OR building_density >= 0),
  degree_urbanisation text,
  population_estimate double precision CHECK (population_estimate IS NULL OR population_estimate >= 0),
  false_positive_probability double precision CHECK (
    false_positive_probability IS NULL OR (false_positive_probability >= 0 AND false_positive_probability <= 1)
  ),
  place_code text,
  raw_properties jsonb NOT NULL CHECK (jsonb_typeof(raw_properties) = 'object'),
  geom geometry(MultiPolygon, 4326) NOT NULL CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom)),
  record_fingerprint text NOT NULL CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  first_enrichment_run_id uuid NOT NULL REFERENCES ooh_data.enrichment_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (source_id, artifact_sha256, feature_id),
  FOREIGN KEY (source_id, artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS grid3_settlement_features_geom_idx
  ON ooh_data.grid3_settlement_features USING gist (geom);
CREATE INDEX IF NOT EXISTS grid3_settlement_features_place_code_idx
  ON ooh_data.grid3_settlement_features (place_code) WHERE place_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS ooh_data.site_settlement_context_runs (
  run_id uuid PRIMARY KEY,
  algorithm_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  source_manifest jsonb,
  input_fingerprint text CHECK (input_fingerprint IS NULL OR input_fingerprint ~ '^[0-9a-f]{64}$'),
  snapshot_id text,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_detail text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    status <> 'succeeded'
    OR (
      source_manifest IS NOT NULL
      AND input_fingerprint IS NOT NULL
      AND snapshot_id IS NOT NULL
      AND completed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS site_settlement_context_runs_fingerprint_idx
  ON ooh_data.site_settlement_context_runs (algorithm_version, input_fingerprint, status);

CREATE TABLE IF NOT EXISTS ooh_data.site_settlement_context_snapshots (
  snapshot_id text PRIMARY KEY,
  algorithm_version text NOT NULL,
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  settlement_source_id text NOT NULL CHECK (settlement_source_id = 'grid3-nigeria-settlements'),
  settlement_artifact_sha256 text NOT NULL,
  field_map_fingerprint text NOT NULL CHECK (field_map_fingerprint ~ '^[0-9a-f]{64}$'),
  radii_m integer[] NOT NULL CHECK (cardinality(radii_m) > 0),
  first_context_run_id uuid NOT NULL REFERENCES ooh_data.site_settlement_context_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (algorithm_version, input_fingerprint),
  FOREIGN KEY (settlement_source_id, settlement_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256) ON DELETE RESTRICT
);

ALTER TABLE ooh_data.site_settlement_context_runs
  DROP CONSTRAINT IF EXISTS site_settlement_context_runs_snapshot_fk;
ALTER TABLE ooh_data.site_settlement_context_runs
  ADD CONSTRAINT site_settlement_context_runs_snapshot_fk
  FOREIGN KEY (snapshot_id) REFERENCES ooh_data.site_settlement_context_snapshots (snapshot_id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS ooh_data.site_settlement_context (
  snapshot_id text NOT NULL REFERENCES ooh_data.site_settlement_context_snapshots (snapshot_id) ON DELETE RESTRICT,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  coordinate_assertion_id text NOT NULL REFERENCES ooh_data.site_coordinate_assertions (assertion_id) ON DELETE RESTRICT,
  radius_m integer NOT NULL CHECK (radius_m > 0),
  source_covered boolean NOT NULL,
  coverage_status text NOT NULL CHECK (coverage_status IN ('complete', 'partial_source_coverage')),
  inside_settlement boolean NOT NULL,
  containing_settlement_count integer NOT NULL CHECK (containing_settlement_count >= 0),
  primary_settlement_feature_id text,
  nearest_settlement_m double precision CHECK (nearest_settlement_m IS NULL OR nearest_settlement_m >= 0),
  core_depth_m double precision CHECK (core_depth_m IS NULL OR core_depth_m >= 0),
  primary_settlement_area_m2 double precision CHECK (primary_settlement_area_m2 IS NULL OR primary_settlement_area_m2 > 0),
  primary_settlement_perimeter_m double precision CHECK (primary_settlement_perimeter_m IS NULL OR primary_settlement_perimeter_m > 0),
  primary_settlement_compactness double precision CHECK (
    primary_settlement_compactness IS NULL OR (primary_settlement_compactness >= 0 AND primary_settlement_compactness <= 1)
  ),
  primary_building_count double precision CHECK (primary_building_count IS NULL OR primary_building_count >= 0),
  primary_building_density double precision CHECK (primary_building_density IS NULL OR primary_building_density >= 0),
  primary_degree_urbanisation text,
  primary_population_estimate double precision CHECK (primary_population_estimate IS NULL OR primary_population_estimate >= 0),
  primary_false_positive_probability double precision CHECK (
    primary_false_positive_probability IS NULL OR (primary_false_positive_probability >= 0 AND primary_false_positive_probability <= 1)
  ),
  primary_place_code text,
  buffer_area_m2 double precision NOT NULL CHECK (buffer_area_m2 > 0),
  settled_area_m2 double precision NOT NULL CHECK (settled_area_m2 >= 0),
  settled_area_share double precision NOT NULL CHECK (settled_area_share >= 0 AND settled_area_share <= 1.000000001),
  intersecting_source_extent_count integer NOT NULL CHECK (intersecting_source_extent_count >= 0),
  settled_component_count integer NOT NULL CHECK (settled_component_count >= 0),
  component_density_per_sqkm double precision NOT NULL CHECK (component_density_per_sqkm >= 0),
  largest_component_area_m2 double precision NOT NULL CHECK (largest_component_area_m2 >= 0),
  largest_component_share double precision CHECK (
    largest_component_share IS NULL OR (largest_component_share >= 0 AND largest_component_share <= 1.000000001)
  ),
  semantic_label text NOT NULL DEFAULT 'settlement_morphology_context_not_land_use_or_audience'
    CHECK (semantic_label = 'settlement_morphology_context_not_land_use_or_audience'),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (snapshot_id, site_id, coordinate_assertion_id, radius_m),
  CHECK (coverage_status = CASE WHEN source_covered THEN 'complete' ELSE 'partial_source_coverage' END),
  CHECK (inside_settlement = (containing_settlement_count > 0)),
  CHECK ((inside_settlement AND core_depth_m IS NOT NULL AND primary_settlement_feature_id IS NOT NULL)
    OR (NOT inside_settlement AND core_depth_m IS NULL)),
  CHECK (
    (settled_area_m2 = 0 AND settled_component_count = 0 AND largest_component_area_m2 = 0 AND largest_component_share IS NULL)
    OR (settled_area_m2 > 0 AND settled_component_count > 0 AND largest_component_area_m2 > 0 AND largest_component_share IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION ooh_data.validate_grid3_settlement_snapshot_source()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  product_role text;
  product_version text;
  artifact_field_map_fingerprint text;
  license_id_value text;
  commercial_status text;
  license_review jsonb;
BEGIN
  SELECT
    a.metadata->>'grid3ProductRole',
    a.metadata->>'productVersion',
    a.metadata->>'fieldMapFingerprint',
    a.license_id,
    a.commercial_use_status,
    a.metadata->'licenseReview'
  INTO
    product_role, product_version, artifact_field_map_fingerprint,
    license_id_value, commercial_status, license_review
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=NEW.settlement_source_id
    AND a.artifact_sha256=NEW.settlement_artifact_sha256;

  IF product_role IS DISTINCT FROM 'settlement_extents'
     OR product_version IS DISTINCT FROM 'v4.1' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_ARTIFACT_ROLE_OR_VERSION_MISMATCH:%:%', product_role, product_version;
  END IF;
  IF artifact_field_map_fingerprint IS NULL
     OR artifact_field_map_fingerprint <> NEW.field_map_fingerprint THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_FIELD_MAP_FINGERPRINT_MISMATCH';
  END IF;
  IF commercial_status IS DISTINCT FROM 'permitted'
     OR license_id_value IS NULL
     OR license_id_value = ''
     OR license_id_value LIKE '%REVIEW%'
     OR license_id_value LIKE '%UNKNOWN%'
     OR jsonb_typeof(license_review) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_LICENSE_REVIEW_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ooh_data.enrichment_runs r
    WHERE r.source_id=NEW.settlement_source_id
      AND r.artifact_sha256=NEW.settlement_artifact_sha256
      AND r.adapter_version='grid3-settlement-adapter-v1'
      AND r.status='succeeded'
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_IMPORT_NOT_READY';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS grid3_settlement_snapshot_source_guard ON ooh_data.site_settlement_context_snapshots;
CREATE TRIGGER grid3_settlement_snapshot_source_guard
BEFORE INSERT ON ooh_data.site_settlement_context_snapshots
FOR EACH ROW EXECUTE FUNCTION ooh_data.validate_grid3_settlement_snapshot_source();

CREATE OR REPLACE FUNCTION ooh_data.guard_grid3_settlement_feature_replay()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  existing ooh_data.grid3_settlement_features%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM ooh_data.grid3_settlement_features
  WHERE source_id=NEW.source_id AND artifact_sha256=NEW.artifact_sha256 AND feature_id=NEW.feature_id;
  IF FOUND THEN
    IF (to_jsonb(existing) - 'first_enrichment_run_id')
       IS DISTINCT FROM (to_jsonb(NEW) - 'first_enrichment_run_id') THEN
      RAISE EXCEPTION 'GRID3_SETTLEMENT_FEATURE_REPLAY_DRIFT:%', NEW.feature_id;
    END IF;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS grid3_settlement_feature_replay_guard ON ooh_data.grid3_settlement_features;
CREATE TRIGGER grid3_settlement_feature_replay_guard
BEFORE INSERT ON ooh_data.grid3_settlement_features
FOR EACH ROW EXECUTE FUNCTION ooh_data.guard_grid3_settlement_feature_replay();

CREATE OR REPLACE FUNCTION ooh_data.guard_site_settlement_context_replay()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  existing ooh_data.site_settlement_context%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM ooh_data.site_settlement_context
  WHERE snapshot_id=NEW.snapshot_id
    AND site_id=NEW.site_id
    AND coordinate_assertion_id=NEW.coordinate_assertion_id
    AND radius_m=NEW.radius_m;
  IF FOUND THEN
    IF to_jsonb(existing) IS DISTINCT FROM to_jsonb(NEW) THEN
      RAISE EXCEPTION 'GRID3_SETTLEMENT_CONTEXT_REPLAY_DRIFT:%:%:%', NEW.site_id, NEW.coordinate_assertion_id, NEW.radius_m;
    END IF;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS site_settlement_context_replay_guard ON ooh_data.site_settlement_context;
CREATE TRIGGER site_settlement_context_replay_guard
BEFORE INSERT ON ooh_data.site_settlement_context
FOR EACH ROW EXECUTE FUNCTION ooh_data.guard_site_settlement_context_replay();

CREATE OR REPLACE FUNCTION ooh_data.reject_settlement_context_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'SETTLEMENT_CONTEXT_IMMUTABLE:%', TG_TABLE_NAME;
END;
$function$;

DROP TRIGGER IF EXISTS grid3_settlement_feature_immutable ON ooh_data.grid3_settlement_features;
CREATE TRIGGER grid3_settlement_feature_immutable
BEFORE UPDATE OR DELETE ON ooh_data.grid3_settlement_features
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_settlement_context_mutation();

DROP TRIGGER IF EXISTS site_settlement_snapshot_immutable ON ooh_data.site_settlement_context_snapshots;
CREATE TRIGGER site_settlement_snapshot_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_settlement_context_snapshots
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_settlement_context_mutation();

DROP TRIGGER IF EXISTS site_settlement_context_immutable ON ooh_data.site_settlement_context;
CREATE TRIGGER site_settlement_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_settlement_context
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_settlement_context_mutation();

CREATE OR REPLACE VIEW ooh_data.site_settlement_context_latest AS
SELECT DISTINCT ON (c.site_id, c.coordinate_assertion_id, c.radius_m)
  c.*,
  s.created_at AS snapshot_created_at
FROM ooh_data.site_settlement_context c
JOIN ooh_data.site_settlement_context_snapshots s USING (snapshot_id)
ORDER BY c.site_id, c.coordinate_assertion_id, c.radius_m, s.created_at DESC, c.snapshot_id DESC;
