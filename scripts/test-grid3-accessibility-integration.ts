import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadMigrations } from "./data/migrations";
import { runPsql } from "./data/psql";
import { migrateDatabase } from "./db-migrate";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseUrl: string = configuredDatabaseUrl;

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`COMMAND_FAILED:${command}:${code}:${stderr.trim()}`));
    });
  });
}

async function scalar(sql: string): Promise<number> {
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${result.stdout}`);
  return value;
}

async function text(sql: string): Promise<string> {
  return (await runPsql(databaseUrl, sql, { tuplesOnly: true })).stdout.trim();
}

async function expectCommandFailure(command: string, args: string[], pattern: string): Promise<void> {
  try {
    await runCommand(command, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(pattern)) throw error;
    return;
  }
  throw new Error(`EXPECTED_COMMAND_FAILURE:${pattern}`);
}

async function seedSiteFixture(): Promise<void> {
  const resolutionRun = "99999999-9999-4999-8999-999999999999";
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, run_kind, status, completed_at)
VALUES ('${resolutionRun}'::uuid, 'entity-resolver-v1', 'rebuild', 'succeeded', now());

INSERT INTO ooh_data.canonical_entities (
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
) VALUES
  ('entity:state:grid3', 'state', 'fct', 'FCT', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid),
  ('entity:city:grid3', 'city', 'fixture', 'Fixture', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid),
  ('entity:format:grid3', 'format', 'large format', 'Large Format', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid);

INSERT INTO ooh_data.site_entities (
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
) VALUES (
  'site:grid3-fixture', 'fct|fixture|grid3 fixture|billboard|large format', 'entity-resolver-v1',
  'confirmed', 'entity:state:grid3', 'entity:city:grid3', 'entity:format:grid3', 'GRID3 Fixture',
  'grid3 fixture', 'Billboard', 'billboard', '${resolutionRun}'::uuid, '${resolutionRun}'::uuid
);

INSERT INTO ooh_data.site_coordinate_assertions (
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m, source_kind,
  coordinate_source_id, source_artifact_id, spatial_rights, spatial_license_id,
  assertion_status, renderer_eligibility, planning_use, enrichment_revision
) VALUES
(
  'coordinate:grid3-center', 'site:grid3-fixture', 7.0000, 8.0000, 5,
  'open_dataset', 'fixture:grid3:center', 'fixture:grid3:center:artifact', 'open_licensed',
  'CC-BY-4.0', 'approved', 'maplibre', 'context_only', 'fixture-r1'
),
(
  'coordinate:grid3-edge', 'site:grid3-fixture', 7.0000, 7.9770, 5,
  'open_dataset', 'fixture:grid3:edge', 'fixture:grid3:edge:artifact', 'open_licensed',
  'CC-BY-4.0', 'approved', 'maplibre', 'context_only', 'fixture-r1'
);
`);
}

async function makeRasterFixtures(directory: string): Promise<{
  population: string;
  walking: string;
  mixed: string;
  mixedBad: string;
}> {
  const generator = join(directory, "make_grid3_fixture.py");
  const population = join(directory, "population.tif");
  const walking = join(directory, "walking.tif");
  const mixed = join(directory, "mixed.tif");
  const mixedBad = join(directory, "mixed-bad.tif");
  await writeFile(generator, `
from osgeo import gdal, osr
import numpy as np
import sys

pop_path, walk_path, mixed_path, bad_path = sys.argv[1:5]
gdal.UseExceptions()

wgs = osr.SpatialReference(); wgs.ImportFromEPSG(4326); wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
utm = osr.SpatialReference(); utm.ImportFromEPSG(32632); utm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_utm = osr.CoordinateTransformation(wgs, utm)
center_x, center_y, _ = to_utm.TransformPoint(8.0, 7.0)

def write_tif(path, array, gt, srs, nodata):
    driver = gdal.GetDriverByName('GTiff')
    ds = driver.Create(path, array.shape[1], array.shape[0], 1, gdal.GDT_Float32, options=['COMPRESS=DEFLATE'])
    ds.SetGeoTransform(gt); ds.SetProjection(srs.ExportToWkt())
    band = ds.GetRasterBand(1); band.WriteArray(array.astype(np.float32)); band.SetNoDataValue(nodata)
    band.FlushCache(); ds.FlushCache(); ds = None

# 60 x 60 at 3 arc-seconds. Fractional resident estimates are intentional.
cell = 3.0 / 3600.0
pop = np.full((60, 60), 0.25, dtype=np.float32)
pop[27:34, 32:40] = 7.75
pop[29, 29] = -9999.0
write_tif(pop_path, pop, (7.975, cell, 0.0, 7.025, 0.0, -cell), wgs, -9999.0)

# 200 x 200 at 30.005213 m, centered on the site.
pixel = 30.005213
origin_x = center_x - 100 * pixel
origin_y = center_y + 100 * pixel
walk = np.full((200, 200), 0.020, dtype=np.float32)
# A high-friction vertical band makes the catchment non-circular.
walk[:, 104:108] = 0.40
walk[20:24, 20:24] = -9999.0
mixed = np.full((200, 200), 0.010, dtype=np.float32)
mixed[20:24, 20:24] = -9999.0
write_tif(walk_path, walk, (origin_x, pixel, 0.0, origin_y, 0.0, -pixel), utm, -9999.0)
write_tif(mixed_path, mixed, (origin_x, pixel, 0.0, origin_y, 0.0, -pixel), utm, -9999.0)
# Same resolution/CRS but shifted half a cell: role-valid, grid-incompatible.
write_tif(bad_path, mixed, (origin_x + pixel / 2.0, pixel, 0.0, origin_y, 0.0, -pixel), utm, -9999.0)
`, "utf8");
  await runCommand("python3", [generator, population, walking, mixed, mixedBad]);
  return { population, walking, mixed, mixedBad };
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  const expectedVersions = manifest.map((item) => item.version);
  if (migration.applied.join(",") !== expectedVersions.join(",")) {
    throw new Error(`MIGRATION_MANIFEST_APPLICATION_FAILURE:${migration.applied.join(",")}`);
  }
  await seedSiteFixture();

  const directory = await mkdtemp(join(tmpdir(), "ooh-grid3-accessibility-it-"));
  const fixture = await makeRasterFixtures(directory);
  const node = process.execPath;
  const registerBase = ["--import", "tsx", "scripts/register-grid3-raster.ts"];

  async function register(role: "population" | "walking_friction" | "mixed_friction", input: string, name: string) {
    const release = role === "population" ? "2025-08-29-v3.0" : "2025-10-v1.0";
    const result = await runCommand(node, [
      ...registerBase,
      `--role=${role}`,
      `--input=${input}`,
      `--release=${release}`,
      `--access-uri=file:///fixture/${name}`,
      `--storage-uri=file:///retained/${name}`,
      "--retrieved-at=2026-08-10T15:00:00Z",
    ]);
    return JSON.parse(result.stdout) as { artifactSha256: string; gridSignature: string };
  }

  const population = await register("population", fixture.population, "population.tif");
  await register("population", fixture.population, "population.tif");
  const walking = await register("walking_friction", fixture.walking, "walking.tif");
  await register("walking_friction", fixture.walking, "walking.tif");
  const mixed = await register("mixed_friction", fixture.mixed, "mixed.tif");
  await register("mixed_friction", fixture.mixed, "mixed.tif");
  const mixedBad = await register("mixed_friction", fixture.mixedBad, "mixed-bad.tif");

  if (walking.gridSignature !== mixed.gridSignature) throw new Error("GRID3_FIXTURE_ALIGNED_GRIDS_NOT_EQUAL");
  if (walking.gridSignature === mixedBad.gridSignature) throw new Error("GRID3_FIXTURE_SHIFTED_GRID_NOT_DIFFERENT");
  if (await scalar("SELECT count(*) FROM ooh_data.enrichment_artifacts WHERE source_id LIKE 'grid3-nigeria-%';") !== 4) {
    throw new Error("GRID3_RASTER_REGISTRATION_IDEMPOTENCY_FAILURE");
  }

  const deriveBase = ["--import", "tsx", "scripts/derive-grid3-accessibility.ts"];
  const deriveArgs = [
    ...deriveBase,
    `--population=${fixture.population}`,
    `--walking=${fixture.walking}`,
    `--mixed=${fixture.mixed}`,
    `--population-sha=${population.artifactSha256}`,
    `--walking-sha=${walking.artifactSha256}`,
    `--mixed-sha=${mixed.artifactSha256}`,
    "--radii=250,500,1000",
    "--thresholds=5,10,15",
    "--max-search-radius-m=1500",
  ];
  const deriveOne = JSON.parse((await runCommand(node, deriveArgs)).stdout) as { snapshotId: string };
  const deriveTwo = JSON.parse((await runCommand(node, deriveArgs)).stdout) as { snapshotId: string };
  if (deriveOne.snapshotId !== deriveTwo.snapshotId) throw new Error("GRID3_RASTER_SNAPSHOT_NOT_DETERMINISTIC");

  if (await scalar("SELECT count(*) FROM ooh_data.site_raster_context_snapshots;") !== 1) {
    throw new Error("GRID3_RASTER_SNAPSHOT_IDEMPOTENCY_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_raster_context_runs WHERE status='succeeded';") !== 2) {
    throw new Error("GRID3_RASTER_RUN_AUDIT_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_population_radius_context;") !== 6) {
    throw new Error("GRID3_RADIUS_ROW_COUNT_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_accessible_population_context;") !== 12) {
    throw new Error("GRID3_ACCESS_ROW_COUNT_FAILURE");
  }

  const radius500 = await scalar(`
SELECT population_estimate FROM ooh_data.site_population_radius_context
WHERE coordinate_assertion_id='coordinate:grid3-center' AND radius_m=500;
`);
  const walking5 = await scalar(`
SELECT population_estimate FROM ooh_data.site_accessible_population_context
WHERE coordinate_assertion_id='coordinate:grid3-center' AND access_mode='walking' AND threshold_minutes=5;
`);
  const mixed5 = await scalar(`
SELECT population_estimate FROM ooh_data.site_accessible_population_context
WHERE coordinate_assertion_id='coordinate:grid3-center' AND access_mode='mixed' AND threshold_minutes=5;
`);
  if (!(radius500 > walking5)) {
    throw new Error(`GRID3_TRAVEL_TIME_MUST_DIFFER_FROM_RADIUS:${radius500}:${walking5}`);
  }
  if (!(mixed5 > walking5)) {
    throw new Error(`GRID3_MIXED_MUST_EXCEED_WALKING_FIXTURE:${mixed5}:${walking5}`);
  }
  if (Number.isInteger(radius500)) {
    throw new Error(`GRID3_FRACTIONAL_POPULATION_LOST:${radius500}`);
  }

  const centerComplete = await scalar(`
SELECT count(*) FROM ooh_data.site_accessible_population_context
WHERE coordinate_assertion_id='coordinate:grid3-center' AND coverage_status='complete';
`);
  if (centerComplete !== 6) throw new Error(`GRID3_CENTER_COVERAGE_FAILURE:${centerComplete}`);
  const edgePartial = await scalar(`
SELECT count(*) FROM ooh_data.site_accessible_population_context
WHERE coordinate_assertion_id='coordinate:grid3-edge' AND coverage_status='partial_source_coverage';
`);
  if (edgePartial === 0) throw new Error("GRID3_EDGE_PARTIAL_COVERAGE_NOT_RETAINED");
  const nodataObserved = await scalar(`
SELECT max(nodata_population_cell_count) FROM ooh_data.site_population_radius_context
WHERE coordinate_assertion_id='coordinate:grid3-center';
`);
  if (nodataObserved < 1) throw new Error("GRID3_POPULATION_NODATA_NOT_RETAINED");

  const semantics = await text(`
SELECT
  (SELECT semantic_label FROM ooh_data.site_population_radius_context LIMIT 1)
  || ':' ||
  (SELECT semantic_label FROM ooh_data.site_accessible_population_context LIMIT 1);
`);
  if (semantics !== "resident_population_model_context:friction_accessible_population_context_not_observed_travel") {
    throw new Error(`GRID3_SEMANTIC_BOUNDARY_FAILURE:${semantics}`);
  }
  const nonContext = await scalar(`
SELECT
  (SELECT count(*) FROM ooh_data.site_raster_context_runs WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_raster_context_snapshots WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_population_radius_context WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_accessible_population_context WHERE decision_use <> 'context_only');
`);
  if (nonContext !== 0) throw new Error(`GRID3_DECISION_USE_FAILURE:${nonContext}`);

  await expectCommandFailure(node, [
    ...deriveBase,
    `--population=${fixture.population}`,
    `--walking=${fixture.walking}`,
    `--mixed=${fixture.mixedBad}`,
    `--population-sha=${population.artifactSha256}`,
    `--walking-sha=${walking.artifactSha256}`,
    `--mixed-sha=${mixedBad.artifactSha256}`,
    "--radii=250,500,1000",
    "--thresholds=5,10,15",
    "--max-search-radius-m=1500",
  ], "GRID3_FRICTION_GRID_SIGNATURE_MISMATCH");
  const failedRuns = await scalar("SELECT count(*) FROM ooh_data.site_raster_context_runs WHERE status='failed';");
  if (failedRuns !== 1) throw new Error(`GRID3_FAILED_RUN_AUDIT_FAILURE:${failedRuns}`);

  process.stdout.write(JSON.stringify({
    ok: true,
    migrationCount: expectedVersions.length,
    snapshotId: deriveOne.snapshotId,
    radius500,
    walking5,
    mixed5,
    edgePartial,
    failedRuns,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`GRID3 accessibility integration failed: ${message}\n`);
  process.exitCode = 1;
});
