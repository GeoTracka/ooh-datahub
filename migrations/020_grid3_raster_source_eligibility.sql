CREATE OR REPLACE FUNCTION ooh_data.validate_grid3_raster_snapshot_sources()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  pop_role text;
  pop_grid text;
  pop_product_version text;
  pop_worker_version text;
  pop_license text;
  pop_commercial text;
  walk_role text;
  walk_grid text;
  walk_product_version text;
  walk_worker_version text;
  walk_license text;
  walk_commercial text;
  mixed_role text;
  mixed_grid text;
  mixed_product_version text;
  mixed_worker_version text;
  mixed_license text;
  mixed_commercial text;
BEGIN
  IF NEW.population_source_id <> 'grid3-nigeria-population'
     OR NEW.walking_source_id <> 'grid3-nigeria-friction'
     OR NEW.mixed_source_id <> 'grid3-nigeria-friction' THEN
    RAISE EXCEPTION 'GRID3_RASTER_SNAPSHOT_SOURCE_MISMATCH';
  END IF;

  SELECT
    metadata->>'grid3ProductRole',
    metadata->>'gridSignature',
    metadata->>'productVersion',
    metadata->>'workerVersion',
    license_id,
    commercial_use_status
  INTO
    pop_role, pop_grid, pop_product_version, pop_worker_version, pop_license, pop_commercial
  FROM ooh_data.enrichment_artifacts
  WHERE source_id=NEW.population_source_id
    AND artifact_sha256=NEW.population_artifact_sha256;

  SELECT
    metadata->>'grid3ProductRole',
    metadata->>'gridSignature',
    metadata->>'productVersion',
    metadata->>'workerVersion',
    license_id,
    commercial_use_status
  INTO
    walk_role, walk_grid, walk_product_version, walk_worker_version, walk_license, walk_commercial
  FROM ooh_data.enrichment_artifacts
  WHERE source_id=NEW.walking_source_id
    AND artifact_sha256=NEW.walking_artifact_sha256;

  SELECT
    metadata->>'grid3ProductRole',
    metadata->>'gridSignature',
    metadata->>'productVersion',
    metadata->>'workerVersion',
    license_id,
    commercial_use_status
  INTO
    mixed_role, mixed_grid, mixed_product_version, mixed_worker_version, mixed_license, mixed_commercial
  FROM ooh_data.enrichment_artifacts
  WHERE source_id=NEW.mixed_source_id
    AND artifact_sha256=NEW.mixed_artifact_sha256;

  IF pop_role IS DISTINCT FROM 'population'
     OR walk_role IS DISTINCT FROM 'walking_friction'
     OR mixed_role IS DISTINCT FROM 'mixed_friction' THEN
    RAISE EXCEPTION 'GRID3_RASTER_SNAPSHOT_ROLE_MISMATCH:%:%:%', pop_role, walk_role, mixed_role;
  END IF;

  IF pop_product_version IS DISTINCT FROM 'v3.0'
     OR walk_product_version IS DISTINCT FROM 'v1.0'
     OR mixed_product_version IS DISTINCT FROM 'v1.0' THEN
    RAISE EXCEPTION 'GRID3_RASTER_PRODUCT_VERSION_MISMATCH:%:%:%',
      pop_product_version, walk_product_version, mixed_product_version;
  END IF;

  IF pop_worker_version IS DISTINCT FROM 'grid3-accessibility-worker-v1'
     OR walk_worker_version IS DISTINCT FROM 'grid3-accessibility-worker-v1'
     OR mixed_worker_version IS DISTINCT FROM 'grid3-accessibility-worker-v1' THEN
    RAISE EXCEPTION 'GRID3_RASTER_INSPECTION_WORKER_MISMATCH:%:%:%',
      pop_worker_version, walk_worker_version, mixed_worker_version;
  END IF;

  IF pop_license IS DISTINCT FROM 'CC-BY-4.0'
     OR walk_license IS DISTINCT FROM 'CC-BY-SA-4.0'
     OR mixed_license IS DISTINCT FROM 'CC-BY-SA-4.0' THEN
    RAISE EXCEPTION 'GRID3_RASTER_LICENSE_MISMATCH:%:%:%', pop_license, walk_license, mixed_license;
  END IF;

  IF pop_commercial IS DISTINCT FROM 'permitted'
     OR walk_commercial IS DISTINCT FROM 'permitted'
     OR mixed_commercial IS DISTINCT FROM 'permitted' THEN
    RAISE EXCEPTION 'GRID3_RASTER_COMMERCIAL_USE_NOT_PERMITTED:%:%:%',
      pop_commercial, walk_commercial, mixed_commercial;
  END IF;

  IF pop_grid IS NULL OR walk_grid IS NULL OR mixed_grid IS NULL THEN
    RAISE EXCEPTION 'GRID3_RASTER_GRID_SIGNATURE_REQUIRED';
  END IF;

  IF walk_grid <> mixed_grid THEN
    RAISE EXCEPTION 'GRID3_FRICTION_GRID_SIGNATURE_MISMATCH:%:%', walk_grid, mixed_grid;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE VIEW ooh_data.site_accessible_population_latest AS
WITH latest AS (
  SELECT DISTINCT ON (
    a.site_id,
    a.coordinate_assertion_id,
    a.access_mode,
    a.threshold_minutes
  )
    a.snapshot_id,
    a.site_id,
    a.coordinate_assertion_id,
    a.access_mode,
    a.threshold_minutes,
    a.population_estimate,
    a.reachable_population_cell_count,
    a.candidate_population_cell_count,
    a.valid_population_cell_count,
    a.nodata_population_cell_count,
    a.friction_unavailable_population_cell_count,
    a.reached_friction_cell_count,
    a.max_reached_minutes,
    a.population_extent_fully_covered,
    a.friction_extent_fully_covered,
    a.source_boundary_reached,
    a.coverage_status,
    a.semantic_label,
    a.decision_use,
    s.algorithm_version,
    s.population_artifact_sha256,
    s.walking_artifact_sha256,
    s.mixed_artifact_sha256,
    s.created_at
  FROM ooh_data.site_accessible_population_context a
  JOIN ooh_data.site_raster_context_snapshots s USING (snapshot_id)
  ORDER BY
    a.site_id,
    a.coordinate_assertion_id,
    a.access_mode,
    a.threshold_minutes,
    s.created_at DESC,
    a.snapshot_id DESC
)
SELECT * FROM latest;
