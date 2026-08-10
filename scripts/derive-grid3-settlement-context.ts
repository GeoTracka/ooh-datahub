import { randomUUID } from "node:crypto";
import {
  GRID3_SETTLEMENT_CONTEXT_VERSION,
  GRID3_SETTLEMENT_DEFAULT_RADII_M,
  GRID3_SETTLEMENT_SOURCE_ID,
  normalizeGrid3SettlementRadii,
} from "../src/enrichment/grid3Settlement";
import { migrateDatabase } from "./db-migrate";
import { queryJsonRows } from "./data/queryJson";
import { runPsql } from "./data/psql";
import { sqlLiteral } from "./data/persistenceFormat";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function shaArg(name: string): string {
  const value = arg(name)?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`INVALID_${name.toUpperCase().replaceAll("-", "_")}`);
  return value;
}

function radiiArg(): number[] {
  const raw = arg("radii")?.trim();
  if (!raw) return [...GRID3_SETTLEMENT_DEFAULT_RADII_M];
  return normalizeGrid3SettlementRadii(raw.split(",").map((value) => Number(value.trim())));
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = (detail.split(":")[0] || "GRID3_SETTLEMENT_CONTEXT_FAILED").slice(0, 128);
  await runPsql(databaseUrl, `
UPDATE ooh_data.site_settlement_context_runs
SET status='failed', completed_at=now(), error_code=${sqlLiteral(code)}, error_detail=${sqlLiteral(detail)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

export async function deriveGrid3SettlementContext(): Promise<Record<string, unknown>> {
  const databaseUrl = requiredDatabaseUrl();
  const settlementSha = shaArg("settlement-sha");
  const radii = radiiArg();
  const radiiSql = `ARRAY[${radii.join(",")}]::integer[]`;
  const runId = randomUUID();

  await migrateDatabase();
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.site_settlement_context_runs (
  run_id, algorithm_version, status, decision_use
) VALUES (
  ${sqlLiteral(runId)}::uuid, ${sqlLiteral(GRID3_SETTLEMENT_CONTEXT_VERSION)}, 'running', 'context_only'
);
`);

  try {
    await runPsql(databaseUrl, `
\\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $preflight$
DECLARE
  role_value text;
  version_value text;
  bounds_value jsonb;
  field_map_fp text;
  commercial_status text;
  license_value text;
BEGIN
  SELECT
    a.metadata->>'grid3ProductRole', a.metadata->>'productVersion', a.metadata->'boundsWgs84',
    a.metadata->>'fieldMapFingerprint', a.commercial_use_status, a.license_id
  INTO role_value, version_value, bounds_value, field_map_fp, commercial_status, license_value
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
    AND a.artifact_sha256=${sqlLiteral(settlementSha)};

  IF role_value IS DISTINCT FROM 'settlement_extents' OR version_value IS DISTINCT FROM 'v4.1' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_ARTIFACT_NOT_READY';
  END IF;
  IF jsonb_typeof(bounds_value) <> 'array' OR jsonb_array_length(bounds_value) <> 4 THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_BOUNDS_REQUIRED';
  END IF;
  IF field_map_fp IS NULL OR field_map_fp !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_FIELD_MAP_FINGERPRINT_REQUIRED';
  END IF;
  IF commercial_status IS DISTINCT FROM 'permitted' OR license_value IS NULL OR license_value = '' THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_COMMERCIAL_LICENSE_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ooh_data.enrichment_runs r
    WHERE r.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
      AND r.artifact_sha256=${sqlLiteral(settlementSha)}
      AND r.adapter_version='grid3-settlement-adapter-v1'
      AND r.status='succeeded'
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_IMPORT_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ooh_data.grid3_settlement_features f
    WHERE f.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
      AND f.artifact_sha256=${sqlLiteral(settlementSha)}
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_FEATURES_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM ooh_data.site_coordinate_assertions c
    JOIN ooh_data.site_entities s ON s.site_id=c.site_id
    WHERE s.identity_status='confirmed'
      AND c.assertion_status='approved'
      AND c.renderer_eligibility='maplibre'
      AND c.planning_use='context_only'
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_NO_ELIGIBLE_SITE_COORDINATES';
  END IF;
END;
$preflight$;

CREATE TEMP TABLE settlement_context_meta (
  source_manifest jsonb NOT NULL,
  input_fingerprint text NOT NULL,
  snapshot_id text NOT NULL,
  field_map_fingerprint text NOT NULL
) ON COMMIT DROP;

WITH coordinate_manifest AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'siteId', c.site_id,
      'coordinateAssertionId', c.assertion_id,
      'latitude', c.latitude,
      'longitude', c.longitude,
      'accuracyM', c.coordinate_accuracy_m,
      'sourceKind', c.source_kind,
      'coordinateSourceId', c.coordinate_source_id,
      'sourceArtifactId', c.source_artifact_id,
      'spatialRights', c.spatial_rights,
      'spatialLicenseId', c.spatial_license_id,
      'enrichmentRevision', c.enrichment_revision
    ) ORDER BY c.site_id, c.assertion_id
  ) AS coordinates
  FROM ooh_data.site_coordinate_assertions c
  JOIN ooh_data.site_entities s ON s.site_id=c.site_id
  WHERE s.identity_status='confirmed'
    AND c.assertion_status='approved'
    AND c.renderer_eligibility='maplibre'
    AND c.planning_use='context_only'
),
manifest AS (
  SELECT
    jsonb_build_object(
      'settlements', jsonb_build_object(
        'sourceId', a.source_id,
        'artifactSha256', a.artifact_sha256,
        'sourceRelease', a.source_release,
        'licenseId', a.license_id,
        'attributionText', a.attribution_text,
        'shareAlike', a.share_alike,
        'commercialUseStatus', a.commercial_use_status,
        'metadata', a.metadata
      ),
      'siteCoordinates', cm.coordinates
    ) AS source_manifest,
    a.metadata->>'fieldMapFingerprint' AS field_map_fingerprint
  FROM ooh_data.enrichment_artifacts a
  CROSS JOIN coordinate_manifest cm
  WHERE a.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
    AND a.artifact_sha256=${sqlLiteral(settlementSha)}
),
fingerprinted AS (
  SELECT
    source_manifest,
    field_map_fingerprint,
    encode(digest(
      jsonb_build_object(
        'algorithmVersion', ${sqlLiteral(GRID3_SETTLEMENT_CONTEXT_VERSION)},
        'algorithmParameters', jsonb_build_object(
          'radiiM', to_jsonb(${radiiSql}),
          'primaryContainmentPolicy', 'smallest_containing_extent_area_then_feature_id',
          'coreDepthPolicy', 'geodesic_distance_to_primary_extent_boundary',
          'settledAreaPolicy', 'union_of_polygon_intersections_to_avoid_overlap_double_count',
          'patchDensityPolicy', 'intersecting_extent_count_per_buffer_sqkm',
          'coveragePolicy', 'full_radius_buffer_inside_retained_source_bounds'
        ),
        'sourceManifest', source_manifest
      )::text,
      'sha256'
    ), 'hex') AS input_fingerprint
  FROM manifest
)
INSERT INTO settlement_context_meta (source_manifest, input_fingerprint, snapshot_id, field_map_fingerprint)
SELECT source_manifest, input_fingerprint, 'settlementctx:' || input_fingerprint, field_map_fingerprint
FROM fingerprinted;

INSERT INTO ooh_data.site_settlement_context_snapshots (
  snapshot_id, algorithm_version, input_fingerprint,
  settlement_source_id, settlement_artifact_sha256, field_map_fingerprint,
  radii_m, first_context_run_id, decision_use
)
SELECT
  m.snapshot_id, ${sqlLiteral(GRID3_SETTLEMENT_CONTEXT_VERSION)}, m.input_fingerprint,
  ${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}, ${sqlLiteral(settlementSha)}, m.field_map_fingerprint,
  ${radiiSql}, ${sqlLiteral(runId)}::uuid, 'context_only'
FROM settlement_context_meta m
ON CONFLICT (algorithm_version, input_fingerprint) DO NOTHING;

CREATE TEMP TABLE settlement_coords ON COMMIT DROP AS
SELECT
  c.site_id,
  c.assertion_id AS coordinate_assertion_id,
  ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326) AS site_geom,
  ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography AS site_geog
FROM ooh_data.site_coordinate_assertions c
JOIN ooh_data.site_entities s ON s.site_id=c.site_id
WHERE s.identity_status='confirmed'
  AND c.assertion_status='approved'
  AND c.renderer_eligibility='maplibre'
  AND c.planning_use='context_only';

CREATE TEMP TABLE settlement_coord_summary ON COMMIT DROP AS
WITH containing AS (
  SELECT
    c.site_id,
    c.coordinate_assertion_id,
    f.feature_id,
    f.geom,
    f.building_count,
    f.building_density,
    f.degree_urbanisation,
    f.population_estimate,
    f.false_positive_probability,
    f.place_code,
    ST_Area(f.geom::geography) AS area_m2,
    ST_Perimeter(f.geom::geography) AS perimeter_m,
    row_number() OVER (
      PARTITION BY c.site_id, c.coordinate_assertion_id
      ORDER BY ST_Area(f.geom::geography), f.feature_id
    ) AS containment_rank,
    count(*) OVER (PARTITION BY c.site_id, c.coordinate_assertion_id) AS containing_count
  FROM settlement_coords c
  JOIN ooh_data.grid3_settlement_features f
    ON f.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
   AND f.artifact_sha256=${sqlLiteral(settlementSha)}
   AND ST_Covers(f.geom, c.site_geom)
),
primary_extent AS (
  SELECT * FROM containing WHERE containment_rank=1
),
nearest AS (
  SELECT
    c.site_id,
    c.coordinate_assertion_id,
    n.feature_id AS nearest_feature_id,
    n.nearest_m
  FROM settlement_coords c
  LEFT JOIN LATERAL (
    SELECT
      f.feature_id,
      ST_Distance(c.site_geog, f.geom::geography) AS nearest_m
    FROM ooh_data.grid3_settlement_features f
    WHERE f.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
      AND f.artifact_sha256=${sqlLiteral(settlementSha)}
    ORDER BY f.geom <-> c.site_geom, f.feature_id
    LIMIT 1
  ) n ON true
)
SELECT
  c.site_id,
  c.coordinate_assertion_id,
  (p.feature_id IS NOT NULL) AS inside_settlement,
  COALESCE(p.containing_count, 0)::integer AS containing_settlement_count,
  p.feature_id AS primary_settlement_feature_id,
  CASE WHEN p.feature_id IS NOT NULL THEN 0::double precision ELSE n.nearest_m END AS nearest_settlement_m,
  CASE WHEN p.feature_id IS NOT NULL
    THEN ST_Distance(c.site_geog, ST_Boundary(p.geom)::geography)
    ELSE NULL
  END AS core_depth_m,
  p.area_m2 AS primary_settlement_area_m2,
  p.perimeter_m AS primary_settlement_perimeter_m,
  CASE
    WHEN p.area_m2 > 0 AND p.perimeter_m > 0
      THEN LEAST(1::double precision, (4 * pi() * p.area_m2) / power(p.perimeter_m, 2))
    ELSE NULL
  END AS primary_settlement_compactness,
  p.building_count AS primary_building_count,
  p.building_density AS primary_building_density,
  p.degree_urbanisation AS primary_degree_urbanisation,
  p.population_estimate AS primary_population_estimate,
  p.false_positive_probability AS primary_false_positive_probability,
  p.place_code AS primary_place_code
FROM settlement_coords c
LEFT JOIN primary_extent p USING (site_id, coordinate_assertion_id)
LEFT JOIN nearest n USING (site_id, coordinate_assertion_id);

CREATE TEMP TABLE settlement_site_radii ON COMMIT DROP AS
WITH source_bounds AS (
  SELECT ST_MakeEnvelope(
    (a.metadata->'boundsWgs84'->>0)::double precision,
    (a.metadata->'boundsWgs84'->>1)::double precision,
    (a.metadata->'boundsWgs84'->>2)::double precision,
    (a.metadata->'boundsWgs84'->>3)::double precision,
    4326
  ) AS bounds_geom
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
    AND a.artifact_sha256=${sqlLiteral(settlementSha)}
)
SELECT
  c.site_id,
  c.coordinate_assertion_id,
  radius_m,
  ST_Buffer(c.site_geog, radius_m)::geometry AS buffer_geom,
  ST_Area(ST_Buffer(c.site_geog, radius_m)) AS buffer_area_m2,
  ST_Covers(b.bounds_geom, ST_Buffer(c.site_geog, radius_m)::geometry) AS source_covered
FROM settlement_coords c
CROSS JOIN source_bounds b
CROSS JOIN unnest(${radiiSql}) AS radius_m;

CREATE TEMP TABLE settlement_radius_agg ON COMMIT DROP AS
WITH intersections AS (
  SELECT
    sr.site_id,
    sr.coordinate_assertion_id,
    sr.radius_m,
    sr.buffer_area_m2,
    sr.source_covered,
    f.feature_id,
    ST_Intersection(f.geom, sr.buffer_geom) AS intersection_geom
  FROM settlement_site_radii sr
  LEFT JOIN ooh_data.grid3_settlement_features f
    ON f.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
   AND f.artifact_sha256=${sqlLiteral(settlementSha)}
   AND ST_Intersects(f.geom, sr.buffer_geom)
),
per_buffer AS (
  SELECT
    site_id,
    coordinate_assertion_id,
    radius_m,
    buffer_area_m2,
    source_covered,
    count(feature_id)::integer AS intersecting_settlement_count,
    COALESCE(
      ST_Area(ST_UnaryUnion(ST_Collect(intersection_geom))::geography),
      0::double precision
    ) AS settled_area_m2,
    COALESCE(max(ST_Area(intersection_geom::geography)), 0::double precision) AS largest_intersection_area_m2
  FROM intersections
  GROUP BY site_id, coordinate_assertion_id, radius_m, buffer_area_m2, source_covered
)
SELECT
  *,
  LEAST(1::double precision, settled_area_m2 / buffer_area_m2) AS settled_area_share,
  intersecting_settlement_count / (buffer_area_m2 / 1000000.0) AS patch_density_per_sqkm,
  CASE WHEN settled_area_m2 > 0
    THEN LEAST(1::double precision, largest_intersection_area_m2 / settled_area_m2)
    ELSE NULL
  END AS largest_settlement_share
FROM per_buffer;

INSERT INTO ooh_data.site_settlement_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  source_covered, coverage_status, inside_settlement, containing_settlement_count,
  primary_settlement_feature_id, nearest_settlement_m, core_depth_m,
  primary_settlement_area_m2, primary_settlement_perimeter_m, primary_settlement_compactness,
  primary_building_count, primary_building_density, primary_degree_urbanisation,
  primary_population_estimate, primary_false_positive_probability, primary_place_code,
  buffer_area_m2, settled_area_m2, settled_area_share, intersecting_settlement_count,
  patch_density_per_sqkm, largest_intersection_area_m2, largest_settlement_share,
  semantic_label, decision_use
)
SELECT
  m.snapshot_id,
  r.site_id,
  r.coordinate_assertion_id,
  r.radius_m,
  r.source_covered,
  CASE WHEN r.source_covered THEN 'complete' ELSE 'partial_source_coverage' END,
  c.inside_settlement,
  c.containing_settlement_count,
  c.primary_settlement_feature_id,
  c.nearest_settlement_m,
  c.core_depth_m,
  c.primary_settlement_area_m2,
  c.primary_settlement_perimeter_m,
  c.primary_settlement_compactness,
  c.primary_building_count,
  c.primary_building_density,
  c.primary_degree_urbanisation,
  c.primary_population_estimate,
  c.primary_false_positive_probability,
  c.primary_place_code,
  r.buffer_area_m2,
  r.settled_area_m2,
  r.settled_area_share,
  r.intersecting_settlement_count,
  r.patch_density_per_sqkm,
  r.largest_intersection_area_m2,
  r.largest_settlement_share,
  'settlement_morphology_context_not_land_use_or_audience',
  'context_only'
FROM settlement_radius_agg r
JOIN settlement_coord_summary c USING (site_id, coordinate_assertion_id)
CROSS JOIN settlement_context_meta m;

UPDATE ooh_data.site_settlement_context_runs r
SET
  status='succeeded',
  source_manifest=m.source_manifest,
  input_fingerprint=m.input_fingerprint,
  snapshot_id=m.snapshot_id,
  counts=jsonb_build_object(
    'coordinates', (SELECT count(*) FROM settlement_coords),
    'radii', ${radii.length},
    'rows', (SELECT count(*) FROM settlement_radius_agg),
    'insideCoordinates', (SELECT count(*) FROM settlement_coord_summary WHERE inside_settlement),
    'partialCoverageRows', (SELECT count(*) FROM settlement_radius_agg WHERE NOT source_covered)
  ),
  completed_at=now()
FROM settlement_context_meta m
WHERE r.run_id=${sqlLiteral(runId)}::uuid;

COMMIT;
`);

    const rows = await queryJsonRows<{
      snapshotId: string;
      inputFingerprint: string;
      counts: Record<string, unknown>;
    }>(databaseUrl, `
SELECT jsonb_build_object(
  'snapshotId', snapshot_id,
  'inputFingerprint', input_fingerprint,
  'counts', counts
)
FROM ooh_data.site_settlement_context_runs
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='succeeded';
`);
    if (rows.length !== 1) throw new Error("GRID3_SETTLEMENT_CONTEXT_RUN_RESULT_MISSING");
    return { runId, ...rows[0] };
  } catch (error) {
    try { await markFailed(databaseUrl, runId, error); } catch { /* preserve derivation failure */ }
    throw error;
  }
}

if (process.argv[1]?.endsWith("derive-grid3-settlement-context.ts")) {
  deriveGrid3SettlementContext()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`grid3-settlement:derive failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
