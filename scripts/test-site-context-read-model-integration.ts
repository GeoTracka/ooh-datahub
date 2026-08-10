import { resolve } from "node:path";
import { loadMigrations } from "./data/migrations";
import { runPsql } from "./data/psql";
import { migrateDatabase } from "./db-migrate";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseUrl = configuredDatabaseUrl;

async function scalar(sql: string): Promise<number> {
  const value = Number((await runPsql(databaseUrl, sql, { tuplesOnly: true })).stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${value}`);
  return value;
}

async function text(sql: string): Promise<string> {
  return (await runPsql(databaseUrl, sql, { tuplesOnly: true })).stdout.trim();
}

async function expectSqlFailure(sql: string, pattern: string): Promise<void> {
  try {
    await runPsql(databaseUrl, sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(pattern)) throw error;
    return;
  }
  throw new Error(`EXPECTED_SQL_FAILURE:${pattern}`);
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  if (migration.applied.join(",") !== manifest.map((item) => item.version).join(",")) {
    throw new Error("SITE_CONTEXT_MIGRATION_MANIFEST_APPLICATION_FAILURE");
  }

  const resolutionRun = "91919191-9191-4919-8919-919191919191";
  const runOne = "92929292-9292-4929-8929-929292929292";
  const runTwo = "93939393-9393-4939-8939-939393939393";
  const placesSha = "a".repeat(64);
  const roadsSha = "b".repeat(64);
  const fingerprintOne = "1".repeat(64);
  const fingerprintTwo = "2".repeat(64);
  const snapshotOne = `vectorctx:${fingerprintOne}`;
  const snapshotTwo = `vectorctx:${fingerprintTwo}`;

  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, run_kind, status, completed_at)
VALUES ('${resolutionRun}'::uuid, 'entity-resolver-v1', 'rebuild', 'succeeded', now());

INSERT INTO ooh_data.canonical_entities (
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
) VALUES
  ('entity:state:e3', 'state', 'lagos', 'Lagos', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid),
  ('entity:city:e3', 'city', 'fixture', 'Fixture', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid),
  ('entity:format:e3', 'format', 'billboard', 'Billboard', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid);

INSERT INTO ooh_data.site_entities (
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
) VALUES (
  'site:e3', 'lagos|fixture|e3|billboard|billboard', 'entity-resolver-v1', 'confirmed',
  'entity:state:e3', 'entity:city:e3', 'entity:format:e3', 'E3 fixture', 'e3 fixture',
  'Billboard', 'billboard', '${resolutionRun}'::uuid, '${resolutionRun}'::uuid
);

INSERT INTO ooh_data.site_coordinate_assertions (
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m, source_kind,
  coordinate_source_id, source_artifact_id, spatial_rights, spatial_license_id,
  assertion_status, renderer_eligibility, planning_use, enrichment_revision
) VALUES
  ('coordinate:e3:a', 'site:e3', 6.5000, 3.4000, 5, 'open_dataset',
   'fixture:e3:a', 'fixture:e3:a:artifact', 'open_licensed', 'CC-BY-4.0',
   'approved', 'maplibre', 'context_only', 'fixture-r1'),
  ('coordinate:e3:b', 'site:e3', 6.5010, 3.4010, 5, 'open_dataset',
   'fixture:e3:b', 'fixture:e3:b:artifact', 'open_licensed', 'CC-BY-4.0',
   'approved', 'maplibre', 'context_only', 'fixture-r1');

INSERT INTO ooh_data.enrichment_artifacts (
  source_id, artifact_sha256, source_release, file_name, content_type, byte_size,
  access_uri, storage_uri, retrieved_at, license_id, attribution_text, share_alike,
  commercial_use_status, acquisition_mode, metadata
) VALUES
  ('overture-places', '${placesSha}', 'fixture-r1', 'places.parquet', 'application/x-parquet', 1,
   'file:///fixture/places.parquet', 'file:///retained/places.parquet', now(),
   'CDLA-Permissive-2.0', 'fixture', false, 'permitted', 'snapshot', '{}'::jsonb),
  ('overture-transportation', '${roadsSha}', 'fixture-r1', 'roads.parquet', 'application/x-parquet', 1,
   'file:///fixture/roads.parquet', 'file:///retained/roads.parquet', now(),
   'ODbL-1.0', 'fixture', true, 'permitted', 'snapshot', '{}'::jsonb);

INSERT INTO ooh_data.site_vector_context_runs (run_id, algorithm_version, status, decision_use)
VALUES ('${runOne}'::uuid, 'overture-vector-context-v1', 'running', 'context_only');

INSERT INTO ooh_data.site_vector_context_snapshots (
  snapshot_id, algorithm_version, input_fingerprint,
  places_source_id, places_artifact_sha256, roads_source_id, roads_artifact_sha256,
  radii_m, first_context_run_id, decision_use, created_at
) VALUES (
  '${snapshotOne}', 'overture-vector-context-v1', '${fingerprintOne}',
  'overture-places', '${placesSha}', 'overture-transportation', '${roadsSha}',
  ARRAY[250,500,1000], '${runOne}'::uuid, 'context_only', '2026-08-10T17:00:00Z'
);

INSERT INTO ooh_data.site_vector_context_coverage (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  places_covered, roads_covered, coverage_status, decision_use
)
SELECT '${snapshotOne}', 'site:e3', 'coordinate:e3:a', radius_m, true, true, 'full', 'context_only'
FROM unnest(ARRAY[250,500,1000]) AS radius_m;

INSERT INTO ooh_data.site_destination_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m, place_count,
  operating_or_unknown_count, high_confidence_count, temporarily_closed_count,
  permanently_closed_count, taxonomy_l0_counts, basic_category_counts, taxonomy_entropy, decision_use
)
SELECT '${snapshotOne}', 'site:e3', 'coordinate:e3:a', radius_m,
  radius_m / 10, radius_m / 10, radius_m / 20, 0, 0, '{}'::jsonb, '{}'::jsonb, 1.0, 'context_only'
FROM unnest(ARRAY[250,500,1000]) AS radius_m;

INSERT INTO ooh_data.site_network_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  road_segment_count, major_road_segment_count, distinct_connector_count,
  road_class_counts, nearest_road_m, nearest_road_class,
  nearest_major_road_m, nearest_major_road_class, decision_use
)
SELECT '${snapshotOne}', 'site:e3', 'coordinate:e3:a', radius_m,
  4, 2, 1, '{"primary":2}'::jsonb, 10, 'primary', 20, 'primary', 'context_only'
FROM unnest(ARRAY[250,500,1000]) AS radius_m;

UPDATE ooh_data.site_vector_context_runs
SET status='succeeded', source_manifest='{}'::jsonb, input_fingerprint='${fingerprintOne}',
    snapshot_id='${snapshotOne}', completed_at=now()
WHERE run_id='${runOne}'::uuid;

INSERT INTO ooh_data.site_vector_context_runs (run_id, algorithm_version, status, decision_use)
VALUES ('${runTwo}'::uuid, 'overture-vector-context-v1', 'running', 'context_only');

INSERT INTO ooh_data.site_vector_context_snapshots (
  snapshot_id, algorithm_version, input_fingerprint,
  places_source_id, places_artifact_sha256, roads_source_id, roads_artifact_sha256,
  radii_m, first_context_run_id, decision_use, created_at
) VALUES (
  '${snapshotTwo}', 'overture-vector-context-v1', '${fingerprintTwo}',
  'overture-places', '${placesSha}', 'overture-transportation', '${roadsSha}',
  ARRAY[250], '${runTwo}'::uuid, 'context_only', '2026-08-10T18:00:00Z'
);

INSERT INTO ooh_data.site_vector_context_coverage (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  places_covered, roads_covered, coverage_status, decision_use
) VALUES ('${snapshotTwo}', 'site:e3', 'coordinate:e3:a', 250, true, true, 'full', 'context_only');

INSERT INTO ooh_data.site_destination_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m, place_count,
  operating_or_unknown_count, high_confidence_count, temporarily_closed_count,
  permanently_closed_count, taxonomy_l0_counts, basic_category_counts, taxonomy_entropy, decision_use
) VALUES (
  '${snapshotTwo}', 'site:e3', 'coordinate:e3:a', 250, 99, 99, 50, 0, 0, '{}'::jsonb, '{}'::jsonb, 1.5, 'context_only'
);

INSERT INTO ooh_data.site_network_context (
  snapshot_id, site_id, coordinate_assertion_id, radius_m,
  road_segment_count, major_road_segment_count, distinct_connector_count,
  road_class_counts, nearest_road_m, nearest_road_class,
  nearest_major_road_m, nearest_major_road_class, decision_use
) VALUES (
  '${snapshotTwo}', 'site:e3', 'coordinate:e3:a', 250, 8, 4, 2,
  '{"primary":4}'::jsonb, 8, 'primary', 15, 'primary', 'context_only'
);

UPDATE ooh_data.site_vector_context_runs
SET status='succeeded', source_manifest='{}'::jsonb, input_fingerprint='${fingerprintTwo}',
    snapshot_id='${snapshotTwo}', completed_at=now()
WHERE run_id='${runTwo}'::uuid;
`);

  if (await scalar("SELECT count(*) FROM ooh_data.site_vector_context_latest WHERE site_id='site:e3' AND coordinate_assertion_id='coordinate:e3:a';") !== 1) {
    throw new Error("SITE_CONTEXT_LATEST_MIXED_SNAPSHOT_RADII");
  }
  if (await scalar("SELECT max(radius_m) FROM ooh_data.site_vector_context_latest WHERE site_id='site:e3' AND coordinate_assertion_id='coordinate:e3:a';") !== 250) {
    throw new Error("SITE_CONTEXT_LATEST_DID_NOT_SELECT_COHERENT_HEAD");
  }

  const unified = await text(`
SELECT
  vector_snapshot_id || ':' || jsonb_array_length(vector_context)::text || ':' ||
  coalesce(raster_missing_reason, '-') || ':' || coalesce(settlement_missing_reason, '-')
FROM ooh_data.site_context_latest
WHERE site_id='site:e3' AND coordinate_assertion_id='coordinate:e3:a';
`);
  if (unified !== `${snapshotTwo}:1:not_derived:not_derived`) {
    throw new Error(`SITE_CONTEXT_UNIFIED_READ_MODEL_FAILURE:${unified}`);
  }

  if (await scalar("SELECT count(*) FROM ooh_data.site_context_latest WHERE site_id='site:e3';") !== 2) {
    throw new Error("SITE_CONTEXT_MULTIPLE_COORDINATES_COLLAPSED");
  }
  if (await text(`
SELECT vector_missing_reason
FROM ooh_data.site_context_latest
WHERE coordinate_assertion_id='coordinate:e3:b';
`) !== "not_derived") {
    throw new Error("SITE_CONTEXT_UNDERIVED_COORDINATE_REASON_FAILURE");
  }

  await expectSqlFailure(
    "UPDATE ooh_data.site_coordinate_assertions SET latitude=6.6 WHERE assertion_id='coordinate:e3:a';",
    "COORDINATE_ASSERTION_EVIDENCE_IMMUTABLE:coordinate:e3:a",
  );

  await runPsql(databaseUrl, `
UPDATE ooh_data.site_coordinate_assertions
SET assertion_status='revoked', renderer_eligibility='none'
WHERE assertion_id='coordinate:e3:a';
`);

  if (await scalar("SELECT count(*) FROM ooh_data.site_vector_context_latest WHERE coordinate_assertion_id='coordinate:e3:a';") !== 0) {
    throw new Error("SITE_CONTEXT_REVOKED_COORDINATE_STILL_CURRENT");
  }
  const revoked = await text(`
SELECT coordinate_currently_eligible::text || ':' || vector_missing_reason || ':' || jsonb_array_length(vector_context)::text
FROM ooh_data.site_context_latest
WHERE coordinate_assertion_id='coordinate:e3:a';
`);
  if (revoked !== "false:coordinate_not_currently_eligible:1") {
    throw new Error(`SITE_CONTEXT_REVOKED_HISTORY_FAILURE:${revoked}`);
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    migrationCount: manifest.length,
    coherentSnapshot: snapshotTwo,
    unified,
    revoked,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`site-context read-model integration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
