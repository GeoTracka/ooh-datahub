import { randomUUID } from "node:crypto";
import { migrateDatabase } from "./db-migrate";
import { runPsql } from "./data/psql";
import { sqlLiteral } from "./data/persistenceFormat";
import { OVERTURE_VECTOR_CONTEXT_VERSION } from "../src/enrichment/overture";
import {
  VECTOR_CONTEXT_DEFAULT_RADII_M,
  VECTOR_CONTEXT_HIGH_CONFIDENCE_THRESHOLD,
  normalizeVectorContextRadii,
} from "../src/enrichment/vectorContext";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function sha256Arg(name: string): string {
  const value = arg(name)?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`INVALID_${name.toUpperCase().replaceAll("-", "_")}`);
  return value;
}

function radiiArg(): number[] {
  const raw = arg("radii")?.trim();
  if (!raw) return [...VECTOR_CONTEXT_DEFAULT_RADII_M];
  return normalizeVectorContextRadii(raw.split(",").map((value) => Number(value.trim())));
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = (detail.split(":")[0] || "VECTOR_CONTEXT_FAILED").slice(0, 128);
  await runPsql(databaseUrl, `
UPDATE ooh_data.site_vector_context_runs
SET status='failed', completed_at=now(), error_code=${sqlLiteral(code)}, error_detail=${sqlLiteral(detail)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

export async function deriveOvertureVectorContext(): Promise<Record<string, unknown>> {
  const databaseUrl = requiredDatabaseUrl();
  const placesSha = sha256Arg("places-sha");
  const roadsSha = sha256Arg("roads-sha");
  const radii = radiiArg();
  const radiiSql = `ARRAY[${radii.join(",")}]::integer[]`;
  const runId = randomUUID();

  await migrateDatabase();
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.site_vector_context_runs (
  run_id, algorithm_version, status, decision_use
) VALUES (
  ${sqlLiteral(runId)}::uuid,
  ${sqlLiteral(OVERTURE_VECTOR_CONTEXT_VERSION)},
  'running',
  'context_only'
);
`);

  try {
    const result = await runPsql(databaseUrl, `
\\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $preflight$
DECLARE
  places_release text;
  roads_release text;
  places_bbox jsonb;
  roads_bbox jsonb;
BEGIN
  SELECT a.source_release, a.metadata->'bbox'
  INTO places_release, places_bbox
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id='overture-places' AND a.artifact_sha256=${sqlLiteral(placesSha)}
    AND EXISTS (
      SELECT 1 FROM ooh_data.enrichment_runs r
      WHERE r.source_id=a.source_id AND r.artifact_sha256=a.artifact_sha256 AND r.status='succeeded'
    );
  IF places_release IS NULL THEN RAISE EXCEPTION 'OVERTURE_PLACES_ARTIFACT_NOT_READY'; END IF;

  SELECT a.source_release, a.metadata->'bbox'
  INTO roads_release, roads_bbox
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id='overture-transportation' AND a.artifact_sha256=${sqlLiteral(roadsSha)}
    AND EXISTS (
      SELECT 1 FROM ooh_data.enrichment_runs r
      WHERE r.source_id=a.source_id AND r.artifact_sha256=a.artifact_sha256 AND r.status='succeeded'
    );
  IF roads_release IS NULL THEN RAISE EXCEPTION 'OVERTURE_ROADS_ARTIFACT_NOT_READY'; END IF;

  IF places_release <> roads_release THEN
    RAISE EXCEPTION 'OVERTURE_VECTOR_RELEASE_MISMATCH:%:%', places_release, roads_release;
  END IF;
  IF jsonb_typeof(places_bbox) <> 'array' OR jsonb_array_length(places_bbox) <> 4 THEN
    RAISE EXCEPTION 'OVERTURE_PLACES_BBOX_REQUIRED';
  END IF;
  IF jsonb_typeof(roads_bbox) <> 'array' OR jsonb_array_length(roads_bbox) <> 4 THEN
    RAISE EXCEPTION 'OVERTURE_ROADS_BBOX_REQUIRED';
  END IF;
  IF places_bbox <> roads_bbox THEN RAISE EXCEPTION 'OVERTURE_VECTOR_BBOX_MISMATCH'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM ooh_data.site_coordinate_assertions c
    JOIN ooh_data.site_entities s ON s.site_id=c.site_id
    WHERE s.identity_status='confirmed'
      AND c.assertion_status='approved'
      AND c.renderer_eligibility='maplibre'
      AND c.planning_use='context_only'
  ) THEN
    RAISE EXCEPTION 'VECTOR_CONTEXT_NO_ELIGIBLE_SITE_COORDINATES';
  END IF;
END;
$preflight$;

CREATE TEMP TABLE vector_context_meta (
  source_manifest jsonb NOT NULL,
  input_fingerprint text NOT NULL,
  snapshot_id text NOT NULL
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
  SELECT jsonb_build_object(
    'places', jsonb_build_object(
      'sourceId', p.source_id,
      'artifactSha256', p.artifact_sha256,
      'sourceRelease', p.source_release,
      'licenseId', p.license_id,
      'attributionText', p.attribution_text,
      'metadata', p.metadata
    ),
    'roads', jsonb_build_object(
      'sourceId', r.source_id,
      'artifactSha256', r.artifact_sha256,
      'sourceRelease', r.source_release,
      'licenseId', r.license_id,
      'attributionText', r.attribution_text,
      'metadata', r.metadata
    ),
    'siteCoordinates', cm.coordinates
  ) AS source_manifest
  FROM ooh_data.enrichment_artifacts p
  CROSS JOIN ooh_data.enrichment_artifacts r
  CROSS JOIN coordinate_manifest cm
  WHERE p.source_id='overture-places' AND p.artifact_sha256=${sqlLiteral(placesSha)}
    AND r.source_id='overture-transportation' AND r.artifact_sha256=${sqlLiteral(roadsSha)}
),
fingerprinted AS (
  SELECT
    source_manifest,
    encode(digest(
      jsonb_build_object(
        'algorithmVersion', ${sqlLiteral(OVERTURE_VECTOR_CONTEXT_VERSION)},
        'algorithmParameters', jsonb_build_object(
          'radiiM', to_jsonb(${radiiSql}),
          'highConfidenceThreshold', ${VECTOR_CONTEXT_HIGH_CONFIDENCE_THRESHOLD},
          'destinationStatusPolicy', 'open_or_unknown_only_for_current_mix',
          'majorRoadClasses', jsonb_build_array('motorway','trunk','primary','secondary'),
          'coveragePolicy', 'full_radius_buffer_inside_retained_bbox'
        ),
        'sourceManifest', source_manifest
      )::text,
      'sha256'
    ), 'hex') AS input_fingerprint
  FROM manifest
)
INSERT INTO vector_context_meta (source_manifest, input_fingerprint, snapshot_id)
SELECT source_manifest, input_fingerprint, 'vectorctx:' || input_fingerprint
FROM fingerprinted;

INSERT INTO ooh_data.site_vector_context_snapshots (
  snapshot_id, algorithm_version, input_fingerprint,
  places_source_id, places_artifact_sha256, roads_source_id, roads_artifact_sha256,
  radii_m, first_context_run_id, decision_use
)
SELECT
  m.snapshot_id,
  ${sqlLiteral(OVERTURE_VECTOR_CONTEXT_VERSION)},
  m.input_fingerprint,
  'overture-places', ${sqlLiteral(placesSha)},
  'overture-transportation', ${sqlLiteral(roadsSha)},
  ${radiiSql}, ${sqlLiteral(runId)}::uuid, 'context_only'
FROM vector_context_meta m
ON CONFLICT (algorithm_version, input_fingerprint) DO NOTHING;

CREATE TEMP TABLE vector_site_radii ON COMMIT DROP AS
WITH artifact_bounds AS (
  SELECT
    ST_MakeEnvelope(
      (p.metadata->'bbox'->>0)::double precision,
      (p.metadata->'bbox'->>1)::double precision,
      (p.metadata->'bbox'->>2)::double precision,
      (p.metadata->'bbox'->>3)::double precision,
      4326
    ) AS places_geom,
    ST_MakeEnvelope(
      (r.metadata->'bbox'->>0)::double precision,
      (r.metadata->'bbox'->>1)::double precision,
      (r.metadata->'bbox'->>2)::double precision,
      (r.metadata->'bbox'->>3)::double precision,
      4326
    ) AS roads_geom
  FROM ooh_data.enrichment_artifacts p
  CROSS JOIN ooh_data.enrichment_artifacts r
  WHERE p.source_id='overture-places' AND p.artifact_sha256=${sqlLiteral(placesSha)}
    AND r.source_id='overture-transportation' AND r.artifact_sha256=${sqlLiteral(roadsSha)}
),
eligible_coordinates AS (
  SELECT
    c.site_id,
    c.assertion_id AS coordinate_assertion_id,
    ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography AS site_geog
  FROM ooh_data.site_coordinate_assertions c
  JOIN ooh_data.site_entities s ON s.site_id=c.site_id
  WHERE s.identity_status='confirmed'
    AND c.assertion_status='approved'
    AND c.renderer_eligibility='maplibre'
    AND c.planning_use='context_only'
)
SELECT
  ec.site_id,
  ec.coordinate_assertion_id,
  ec.site_geog,
  radius_m,
  ST_Covers(ab.places_geom, ST_Buffer(ec.site_geog, radius_m)::geometry) AS places_covered,
  ST_Covers(ab.roads_geom, ST_Buffer(ec.site_geog, radius_m)::geometry) AS roads_covered
FROM eligible_coordinates ec
CROSS JOIN artifact_bounds ab
CROSS JOIN unnest(${radiiSql}) AS radius_m;

INSERT INTO ooh_data.site_vector_context_coverage (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  places_covered, roads_covered, coverage_status, decision_use
)
SELECT
  m.snapshot_id,
  sr.site_id,
  sr.coordinate_assertion_id,
  sr.radius_m,
  sr.places_covered,
  sr.roads_covered,
  CASE
    WHEN sr.places_covered AND sr.roads_covered THEN 'full'
    WHEN sr.places_covered THEN 'places_only'
    WHEN sr.roads_covered THEN 'roads_only'
    ELSE 'uncovered'
  END,
  'context_only'
FROM vector_site_radii sr
CROSS JOIN vector_context_meta m
ON CONFLICT (snapshot_id, site_id, coordinate_assertion_id, radius_m) DO NOTHING;

CREATE TEMP TABLE vector_place_hits ON COMMIT DROP AS
SELECT
  sr.site_id,
  sr.coordinate_assertion_id,
  sr.radius_m,
  p.feature_id,
  p.basic_category,
  p.taxonomy,
  p.confidence,
  p.operating_status
FROM vector_site_radii sr
JOIN ooh_data.overture_place_features p
  ON p.source_id='overture-places'
 AND p.artifact_sha256=${sqlLiteral(placesSha)}
 AND sr.places_covered
 AND ST_DWithin(sr.site_geog, p.geog, sr.radius_m);

WITH summary AS (
  SELECT
    site_id, coordinate_assertion_id, radius_m,
    count(*)::integer AS place_count,
    count(*) FILTER (WHERE operating_status IS NULL OR operating_status='open')::integer AS operating_or_unknown_count,
    count(*) FILTER (
      WHERE (operating_status IS NULL OR operating_status='open')
        AND confidence >= ${VECTOR_CONTEXT_HIGH_CONFIDENCE_THRESHOLD}
    )::integer AS high_confidence_count,
    count(*) FILTER (WHERE operating_status='temporarily_closed')::integer AS temporarily_closed_count,
    count(*) FILTER (WHERE operating_status='permanently_closed')::integer AS permanently_closed_count
  FROM vector_place_hits
  GROUP BY site_id, coordinate_assertion_id, radius_m
),
basic_counts AS (
  SELECT site_id, coordinate_assertion_id, radius_m, basic_category, count(*)::integer AS category_count
  FROM vector_place_hits
  WHERE (operating_status IS NULL OR operating_status='open') AND basic_category IS NOT NULL
  GROUP BY site_id, coordinate_assertion_id, radius_m, basic_category
),
basic_json AS (
  SELECT site_id, coordinate_assertion_id, radius_m,
    jsonb_object_agg(basic_category, category_count ORDER BY basic_category) AS category_counts
  FROM basic_counts
  GROUP BY site_id, coordinate_assertion_id, radius_m
),
l0_counts AS (
  SELECT
    site_id, coordinate_assertion_id, radius_m,
    taxonomy #>> '{hierarchy,0}' AS taxonomy_l0,
    count(*)::integer AS category_count
  FROM vector_place_hits
  WHERE (operating_status IS NULL OR operating_status='open')
    AND taxonomy #>> '{hierarchy,0}' IS NOT NULL
  GROUP BY site_id, coordinate_assertion_id, radius_m, taxonomy #>> '{hierarchy,0}'
),
l0_totals AS (
  SELECT site_id, coordinate_assertion_id, radius_m, sum(category_count)::double precision AS total_count
  FROM l0_counts
  GROUP BY site_id, coordinate_assertion_id, radius_m
),
l0_rollup AS (
  SELECT
    c.site_id, c.coordinate_assertion_id, c.radius_m,
    jsonb_object_agg(c.taxonomy_l0, c.category_count ORDER BY c.taxonomy_l0) AS category_counts,
    -sum(
      (c.category_count::double precision / t.total_count)
      * ln(c.category_count::double precision / t.total_count)
    ) AS entropy
  FROM l0_counts c
  JOIN l0_totals t USING (site_id, coordinate_assertion_id, radius_m)
  GROUP BY c.site_id, c.coordinate_assertion_id, c.radius_m
)
INSERT INTO ooh_data.site_destination_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  place_count, operating_or_unknown_count, high_confidence_count,
  temporarily_closed_count, permanently_closed_count,
  taxonomy_l0_counts, basic_category_counts, taxonomy_entropy, decision_use
)
SELECT
  m.snapshot_id,
  sr.site_id,
  sr.coordinate_assertion_id,
  sr.radius_m,
  coalesce(s.place_count, 0),
  coalesce(s.operating_or_unknown_count, 0),
  coalesce(s.high_confidence_count, 0),
  coalesce(s.temporarily_closed_count, 0),
  coalesce(s.permanently_closed_count, 0),
  coalesce(l.category_counts, '{}'::jsonb),
  coalesce(b.category_counts, '{}'::jsonb),
  l.entropy,
  'context_only'
FROM vector_site_radii sr
CROSS JOIN vector_context_meta m
LEFT JOIN summary s USING (site_id, coordinate_assertion_id, radius_m)
LEFT JOIN basic_json b USING (site_id, coordinate_assertion_id, radius_m)
LEFT JOIN l0_rollup l USING (site_id, coordinate_assertion_id, radius_m)
WHERE sr.places_covered
ON CONFLICT (snapshot_id, site_id, coordinate_assertion_id, radius_m) DO NOTHING;

CREATE TEMP TABLE vector_road_hits ON COMMIT DROP AS
SELECT
  sr.site_id,
  sr.coordinate_assertion_id,
  sr.radius_m,
  r.feature_id,
  r.road_class,
  r.connectors,
  ST_Distance(sr.site_geog, r.geog) AS distance_m
FROM vector_site_radii sr
JOIN ooh_data.overture_road_segments r
  ON r.source_id='overture-transportation'
 AND r.artifact_sha256=${sqlLiteral(roadsSha)}
 AND sr.roads_covered
 AND ST_DWithin(sr.site_geog, r.geog, sr.radius_m);

WITH summary AS (
  SELECT
    site_id, coordinate_assertion_id, radius_m,
    count(*)::integer AS road_segment_count,
    count(*) FILTER (WHERE road_class IN ('motorway','trunk','primary','secondary'))::integer AS major_road_segment_count
  FROM vector_road_hits
  GROUP BY site_id, coordinate_assertion_id, radius_m
),
class_counts AS (
  SELECT site_id, coordinate_assertion_id, radius_m, road_class, count(*)::integer AS class_count
  FROM vector_road_hits
  GROUP BY site_id, coordinate_assertion_id, radius_m, road_class
),
class_json AS (
  SELECT site_id, coordinate_assertion_id, radius_m,
    jsonb_object_agg(road_class, class_count ORDER BY road_class) AS road_class_counts
  FROM class_counts
  GROUP BY site_id, coordinate_assertion_id, radius_m
),
connector_counts AS (
  SELECT
    h.site_id, h.coordinate_assertion_id, h.radius_m,
    count(DISTINCT connector->>'connector_id')::integer AS distinct_connector_count
  FROM vector_road_hits h
  CROSS JOIN LATERAL jsonb_array_elements(h.connectors) connector
  WHERE connector ? 'connector_id' AND coalesce(connector->>'connector_id','') <> ''
  GROUP BY h.site_id, h.coordinate_assertion_id, h.radius_m
),
nearest AS (
  SELECT DISTINCT ON (site_id, coordinate_assertion_id, radius_m)
    site_id, coordinate_assertion_id, radius_m, distance_m AS nearest_road_m, road_class AS nearest_road_class
  FROM vector_road_hits
  ORDER BY site_id, coordinate_assertion_id, radius_m, distance_m, feature_id
),
nearest_major AS (
  SELECT DISTINCT ON (site_id, coordinate_assertion_id, radius_m)
    site_id, coordinate_assertion_id, radius_m,
    distance_m AS nearest_major_road_m, road_class AS nearest_major_road_class
  FROM vector_road_hits
  WHERE road_class IN ('motorway','trunk','primary','secondary')
  ORDER BY site_id, coordinate_assertion_id, radius_m, distance_m, feature_id
)
INSERT INTO ooh_data.site_network_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  road_segment_count, major_road_segment_count, distinct_connector_count,
  road_class_counts, nearest_road_m, nearest_road_class,
  nearest_major_road_m, nearest_major_road_class, decision_use
)
SELECT
  m.snapshot_id,
  sr.site_id,
  sr.coordinate_assertion_id,
  sr.radius_m,
  coalesce(s.road_segment_count, 0),
  coalesce(s.major_road_segment_count, 0),
  coalesce(cc.distinct_connector_count, 0),
  coalesce(cj.road_class_counts, '{}'::jsonb),
  n.nearest_road_m,
  n.nearest_road_class,
  nm.nearest_major_road_m,
  nm.nearest_major_road_class,
  'context_only'
FROM vector_site_radii sr
CROSS JOIN vector_context_meta m
LEFT JOIN summary s USING (site_id, coordinate_assertion_id, radius_m)
LEFT JOIN class_json cj USING (site_id, coordinate_assertion_id, radius_m)
LEFT JOIN connector_counts cc USING (site_id, coordinate_assertion_id, radius_m)
LEFT JOIN nearest n USING (site_id, coordinate_assertion_id, radius_m)
LEFT JOIN nearest_major nm USING (site_id, coordinate_assertion_id, radius_m)
WHERE sr.roads_covered
ON CONFLICT (snapshot_id, site_id, coordinate_assertion_id, radius_m) DO NOTHING;

UPDATE ooh_data.site_vector_context_runs run
SET
  status='succeeded',
  source_manifest=m.source_manifest,
  input_fingerprint=m.input_fingerprint,
  snapshot_id=m.snapshot_id,
  completed_at=now(),
  counts=jsonb_build_object(
    'eligibleCoordinateAssertions', (
      SELECT count(*) FROM (
        SELECT DISTINCT site_id, coordinate_assertion_id FROM vector_site_radii
      ) x
    ),
    'radiiM', to_jsonb(${radiiSql}),
    'coverageRows', (SELECT count(*) FROM ooh_data.site_vector_context_coverage c WHERE c.snapshot_id=m.snapshot_id),
    'destinationRows', (SELECT count(*) FROM ooh_data.site_destination_context d WHERE d.snapshot_id=m.snapshot_id),
    'networkRows', (SELECT count(*) FROM ooh_data.site_network_context n WHERE n.snapshot_id=m.snapshot_id),
    'placesFeatures', (
      SELECT count(*) FROM ooh_data.overture_place_features p
      WHERE p.source_id='overture-places' AND p.artifact_sha256=${sqlLiteral(placesSha)}
    ),
    'roadSegments', (
      SELECT count(*) FROM ooh_data.overture_road_segments r
      WHERE r.source_id='overture-transportation' AND r.artifact_sha256=${sqlLiteral(roadsSha)}
    ),
    'highConfidenceThreshold', ${VECTOR_CONTEXT_HIGH_CONFIDENCE_THRESHOLD}
  )
FROM vector_context_meta m
WHERE run.run_id=${sqlLiteral(runId)}::uuid AND run.status='running';

COMMIT;

SELECT json_build_object(
  'runId', run_id,
  'status', status,
  'snapshotId', snapshot_id,
  'inputFingerprint', input_fingerprint,
  'counts', counts
)::text
FROM ooh_data.site_vector_context_runs
WHERE run_id=${sqlLiteral(runId)}::uuid;
`, { tuplesOnly: true });

    const output = result.stdout.trim();
    if (!output) throw new Error("VECTOR_CONTEXT_RESULT_MISSING");
    return JSON.parse(output) as Record<string, unknown>;
  } catch (error) {
    try { await markFailed(databaseUrl, runId, error); } catch { /* preserve derivation failure */ }
    throw error;
  }
}

if (process.argv[1]?.endsWith("derive-overture-vector-context.ts")) {
  deriveOvertureVectorContext()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`data:derive:vector failed: ${message}\n`);
      process.exitCode = 1;
    });
}
