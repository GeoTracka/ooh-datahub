CREATE TABLE IF NOT EXISTS ooh_data.site_raster_context_runs (
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

CREATE INDEX IF NOT EXISTS site_raster_context_runs_fingerprint_idx
  ON ooh_data.site_raster_context_runs (algorithm_version, input_fingerprint, status);

CREATE TABLE IF NOT EXISTS ooh_data.site_raster_context_snapshots (
  snapshot_id text PRIMARY KEY,
  algorithm_version text NOT NULL,
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  population_source_id text NOT NULL,
  population_artifact_sha256 text NOT NULL,
  walking_source_id text NOT NULL,
  walking_artifact_sha256 text NOT NULL,
  mixed_source_id text NOT NULL,
  mixed_artifact_sha256 text NOT NULL,
  radii_m integer[] NOT NULL CHECK (cardinality(radii_m) > 0),
  thresholds_minutes integer[] NOT NULL CHECK (cardinality(thresholds_minutes) > 0),
  max_search_radius_m integer NOT NULL CHECK (max_search_radius_m > 0 AND max_search_radius_m <= 50000),
  first_context_run_id uuid NOT NULL REFERENCES ooh_data.site_raster_context_runs (run_id) ON DELETE RESTRICT,
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (algorithm_version, input_fingerprint),
  FOREIGN KEY (population_source_id, population_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256) ON DELETE RESTRICT,
  FOREIGN KEY (walking_source_id, walking_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256) ON DELETE RESTRICT,
  FOREIGN KEY (mixed_source_id, mixed_artifact_sha256)
    REFERENCES ooh_data.enrichment_artifacts (source_id, artifact_sha256) ON DELETE RESTRICT,
  CHECK (walking_artifact_sha256 <> mixed_artifact_sha256)
);

ALTER TABLE ooh_data.site_raster_context_runs
  DROP CONSTRAINT IF EXISTS site_raster_context_runs_snapshot_fk;
ALTER TABLE ooh_data.site_raster_context_runs
  ADD CONSTRAINT site_raster_context_runs_snapshot_fk
  FOREIGN KEY (snapshot_id) REFERENCES ooh_data.site_raster_context_snapshots (snapshot_id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS ooh_data.site_population_radius_context (
  snapshot_id text NOT NULL REFERENCES ooh_data.site_raster_context_snapshots (snapshot_id) ON DELETE RESTRICT,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  coordinate_assertion_id text NOT NULL REFERENCES ooh_data.site_coordinate_assertions (assertion_id) ON DELETE RESTRICT,
  radius_m integer NOT NULL CHECK (radius_m > 0),
  population_estimate double precision NOT NULL CHECK (population_estimate >= 0),
  candidate_cell_count integer NOT NULL CHECK (candidate_cell_count >= 0),
  valid_population_cell_count integer NOT NULL CHECK (valid_population_cell_count >= 0),
  nodata_population_cell_count integer NOT NULL CHECK (nodata_population_cell_count >= 0),
  extent_fully_covered boolean NOT NULL,
  coverage_status text NOT NULL CHECK (coverage_status IN ('complete', 'partial_source_coverage')),
  semantic_label text NOT NULL DEFAULT 'resident_population_model_context'
    CHECK (semantic_label = 'resident_population_model_context'),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (snapshot_id, site_id, coordinate_assertion_id, radius_m),
  CHECK (coverage_status = CASE WHEN extent_fully_covered THEN 'complete' ELSE 'partial_source_coverage' END)
);

CREATE TABLE IF NOT EXISTS ooh_data.site_accessible_population_context (
  snapshot_id text NOT NULL REFERENCES ooh_data.site_raster_context_snapshots (snapshot_id) ON DELETE RESTRICT,
  site_id text NOT NULL REFERENCES ooh_data.site_entities (site_id) ON DELETE RESTRICT,
  coordinate_assertion_id text NOT NULL REFERENCES ooh_data.site_coordinate_assertions (assertion_id) ON DELETE RESTRICT,
  access_mode text NOT NULL CHECK (access_mode IN ('walking', 'mixed')),
  threshold_minutes integer NOT NULL CHECK (threshold_minutes > 0),
  population_estimate double precision NOT NULL CHECK (population_estimate >= 0),
  reachable_population_cell_count integer NOT NULL CHECK (reachable_population_cell_count >= 0),
  candidate_population_cell_count integer NOT NULL CHECK (candidate_population_cell_count >= 0),
  valid_population_cell_count integer NOT NULL CHECK (valid_population_cell_count >= 0),
  nodata_population_cell_count integer NOT NULL CHECK (nodata_population_cell_count >= 0),
  friction_unavailable_population_cell_count integer NOT NULL CHECK (friction_unavailable_population_cell_count >= 0),
  reached_friction_cell_count integer NOT NULL CHECK (reached_friction_cell_count >= 0),
  max_reached_minutes double precision NOT NULL CHECK (max_reached_minutes >= 0),
  population_extent_fully_covered boolean NOT NULL,
  friction_extent_fully_covered boolean NOT NULL,
  search_truncated boolean NOT NULL DEFAULT false CHECK (search_truncated = false),
  source_boundary_reached boolean NOT NULL,
  coverage_status text NOT NULL CHECK (coverage_status IN ('complete', 'partial_source_coverage')),
  semantic_label text NOT NULL DEFAULT 'friction_accessible_population_context_not_observed_travel'
    CHECK (semantic_label = 'friction_accessible_population_context_not_observed_travel'),
  decision_use text NOT NULL DEFAULT 'context_only' CHECK (decision_use = 'context_only'),
  PRIMARY KEY (snapshot_id, site_id, coordinate_assertion_id, access_mode, threshold_minutes),
  CHECK (
    coverage_status = CASE
      WHEN population_extent_fully_covered AND friction_extent_fully_covered AND NOT source_boundary_reached THEN 'complete'
      ELSE 'partial_source_coverage'
    END
  )
);

CREATE OR REPLACE FUNCTION ooh_data.validate_grid3_raster_snapshot_sources()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  pop_role text;
  walk_role text;
  mixed_role text;
  walk_grid text;
  mixed_grid text;
BEGIN
  IF NEW.population_source_id <> 'grid3-nigeria-population'
     OR NEW.walking_source_id <> 'grid3-nigeria-friction'
     OR NEW.mixed_source_id <> 'grid3-nigeria-friction' THEN
    RAISE EXCEPTION 'GRID3_RASTER_SNAPSHOT_SOURCE_MISMATCH';
  END IF;

  SELECT metadata->>'grid3ProductRole' INTO pop_role
  FROM ooh_data.enrichment_artifacts
  WHERE source_id=NEW.population_source_id AND artifact_sha256=NEW.population_artifact_sha256;
  SELECT metadata->>'grid3ProductRole', metadata->>'gridSignature' INTO walk_role, walk_grid
  FROM ooh_data.enrichment_artifacts
  WHERE source_id=NEW.walking_source_id AND artifact_sha256=NEW.walking_artifact_sha256;
  SELECT metadata->>'grid3ProductRole', metadata->>'gridSignature' INTO mixed_role, mixed_grid
  FROM ooh_data.enrichment_artifacts
  WHERE source_id=NEW.mixed_source_id AND artifact_sha256=NEW.mixed_artifact_sha256;

  IF pop_role IS DISTINCT FROM 'population'
     OR walk_role IS DISTINCT FROM 'walking_friction'
     OR mixed_role IS DISTINCT FROM 'mixed_friction' THEN
    RAISE EXCEPTION 'GRID3_RASTER_SNAPSHOT_ROLE_MISMATCH:%:%:%', pop_role, walk_role, mixed_role;
  END IF;
  IF walk_grid IS NULL OR mixed_grid IS NULL OR walk_grid <> mixed_grid THEN
    RAISE EXCEPTION 'GRID3_FRICTION_GRID_SIGNATURE_MISMATCH:%:%', walk_grid, mixed_grid;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS grid3_raster_snapshot_source_guard ON ooh_data.site_raster_context_snapshots;
CREATE TRIGGER grid3_raster_snapshot_source_guard
BEFORE INSERT ON ooh_data.site_raster_context_snapshots
FOR EACH ROW EXECUTE FUNCTION ooh_data.validate_grid3_raster_snapshot_sources();

CREATE OR REPLACE FUNCTION ooh_data.reject_raster_context_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'RASTER_CONTEXT_IMMUTABLE:%', TG_TABLE_NAME;
END;
$function$;

DROP TRIGGER IF EXISTS raster_context_snapshot_immutable ON ooh_data.site_raster_context_snapshots;
CREATE TRIGGER raster_context_snapshot_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_raster_context_snapshots
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_raster_context_mutation();

DROP TRIGGER IF EXISTS population_radius_context_immutable ON ooh_data.site_population_radius_context;
CREATE TRIGGER population_radius_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_population_radius_context
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_raster_context_mutation();

DROP TRIGGER IF EXISTS accessible_population_context_immutable ON ooh_data.site_accessible_population_context;
CREATE TRIGGER accessible_population_context_immutable
BEFORE UPDATE OR DELETE ON ooh_data.site_accessible_population_context
FOR EACH ROW EXECUTE FUNCTION ooh_data.reject_raster_context_mutation();

CREATE OR REPLACE VIEW ooh_data.site_raster_context_latest AS
WITH latest AS (
  SELECT DISTINCT ON (p.site_id, p.coordinate_assertion_id, p.radius_m)
    p.snapshot_id, p.site_id, p.coordinate_assertion_id, p.radius_m,
    p.population_estimate, p.valid_population_cell_count, p.nodata_population_cell_count,
    p.extent_fully_covered, p.coverage_status, s.created_at
  FROM ooh_data.site_population_radius_context p
  JOIN ooh_data.site_raster_context_snapshots s USING (snapshot_id)
  ORDER BY p.site_id, p.coordinate_assertion_id, p.radius_m, s.created_at DESC, p.snapshot_id DESC
)
SELECT * FROM latest;
