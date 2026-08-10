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

async function seedSites(): Promise<void> {
  const run = "88888888-8888-4888-8888-888888888888";
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, run_kind, status, completed_at)
VALUES ('${run}'::uuid, 'entity-resolver-v1', 'rebuild', 'succeeded', now());

INSERT INTO ooh_data.canonical_entities (
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
) VALUES
  ('entity:state:morph', 'state', 'lagos', 'Lagos', 'entity-resolver-v1', 2, '${run}'::uuid, '${run}'::uuid),
  ('entity:city:morph', 'city', 'fixture', 'Fixture', 'entity-resolver-v1', 2, '${run}'::uuid, '${run}'::uuid),
  ('entity:format:morph', 'format', 'large format', 'Large Format', 'entity-resolver-v1', 2, '${run}'::uuid, '${run}'::uuid);

INSERT INTO ooh_data.site_entities (
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
) VALUES
  ('site:morph-core', 'lagos|fixture|morph core|billboard|large format', 'entity-resolver-v1',
   'confirmed', 'entity:state:morph', 'entity:city:morph', 'entity:format:morph', 'Morph Core',
   'morph core', 'Billboard', 'billboard', '${run}'::uuid, '${run}'::uuid),
  ('site:morph-fragmented', 'lagos|fixture|morph fragmented|billboard|large format', 'entity-resolver-v1',
   'confirmed', 'entity:state:morph', 'entity:city:morph', 'entity:format:morph', 'Morph Fragmented',
   'morph fragmented', 'Billboard', 'billboard', '${run}'::uuid, '${run}'::uuid);

INSERT INTO ooh_data.site_coordinate_assertions (
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m, source_kind,
  coordinate_source_id, source_artifact_id, spatial_rights, spatial_license_id,
  assertion_status, renderer_eligibility, planning_use, enrichment_revision
) VALUES
  ('coordinate:morph-core', 'site:morph-core', 7.0000, 8.0000, 5,
   'open_dataset', 'fixture:morph:core', 'fixture:morph:core:artifact', 'open_licensed', 'CC-BY-4.0',
   'approved', 'maplibre', 'context_only', 'fixture-r1'),
  ('coordinate:morph-fragmented', 'site:morph-fragmented', 7.0000, 8.0200, 5,
   'open_dataset', 'fixture:morph:fragmented', 'fixture:morph:fragmented:artifact', 'open_licensed', 'CC-BY-4.0',
   'approved', 'maplibre', 'context_only', 'fixture-r1');
`);
}

async function makeFixtures(directory: string): Promise<{
  population: string;
  walking: string;
  mixed: string;
  settlements: string;
  fieldMap: string;
  coverage: string;
  badCoverage: string;
}> {
  const generator = join(directory, "make_morph_fixture.py");
  const population = join(directory, "population.tif");
  const walking = join(directory, "walking.tif");
  const mixed = join(directory, "mixed.tif");
  const settlements = join(directory, "settlements.gpkg");
  const fieldMap = join(directory, "field-map.json");
  const coverage = join(directory, "coverage.geojson");
  const badCoverage = join(directory, "bad-coverage.geojson");

  await writeFile(fieldMap, JSON.stringify({
    featureId: "sid",
    buildingCount: "bldg_count",
    buildingDensity: "bldg_dens",
    degreeUrbanisation: "degurba",
    populationEstimate: "pop_est",
    falsePositiveProbability: "fp_prob",
    placeCode: "place_code",
  }), "utf8");

  const polygon = (west: number, south: number, east: number, north: number) => ({
    type: "Feature",
    properties: { evidence: "synthetic retained source coverage" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [west, south], [east, south], [east, north], [west, north], [west, south],
      ]],
    },
  });
  await writeFile(coverage, JSON.stringify(polygon(7.98, 6.98, 8.04, 7.02)), "utf8");
  await writeFile(badCoverage, JSON.stringify(polygon(7.99, 6.99, 8.01, 7.01)), "utf8");

  await writeFile(generator, `
from osgeo import gdal, ogr, osr
import numpy as np
import os
import sys

pop_path, walk_path, mixed_path, gpkg_path = sys.argv[1:5]
gdal.UseExceptions(); ogr.UseExceptions()
wgs = osr.SpatialReference(); wgs.ImportFromEPSG(4326); wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
utm = osr.SpatialReference(); utm.ImportFromEPSG(32632); utm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_utm = osr.CoordinateTransformation(wgs, utm)
center_x, center_y, _ = to_utm.TransformPoint(8.01, 7.0)

def write_tif(path, array, gt, srs, nodata):
    ds = gdal.GetDriverByName('GTiff').Create(path, array.shape[1], array.shape[0], 1, gdal.GDT_Float32, options=['COMPRESS=DEFLATE'])
    ds.SetGeoTransform(gt); ds.SetProjection(srs.ExportToWkt())
    band = ds.GetRasterBand(1); band.WriteArray(array.astype(np.float32)); band.SetNoDataValue(nodata)
    band.FlushCache(); ds.FlushCache(); ds = None

cell = 3.0 / 3600.0
pop = np.full((96, 144), 1.5, dtype=np.float32)
write_tif(pop_path, pop, (7.96, cell, 0.0, 7.04, 0.0, -cell), wgs, -9999.0)

pixel = 30.005213
origin_x = center_x - 160 * pixel
origin_y = center_y + 120 * pixel
walk = np.full((240, 320), 0.020, dtype=np.float32)
mixed = np.full((240, 320), 0.010, dtype=np.float32)
write_tif(walk_path, walk, (origin_x, pixel, 0.0, origin_y, 0.0, -pixel), utm, -9999.0)
write_tif(mixed_path, mixed, (origin_x, pixel, 0.0, origin_y, 0.0, -pixel), utm, -9999.0)

if os.path.exists(gpkg_path):
    ogr.GetDriverByName('GPKG').DeleteDataSource(gpkg_path)
ds = ogr.GetDriverByName('GPKG').CreateDataSource(gpkg_path)
layer = ds.CreateLayer('settlements', srs=wgs, geom_type=ogr.wkbPolygon)
for name, kind in [('sid', ogr.OFTString), ('bldg_count', ogr.OFTInteger), ('bldg_dens', ogr.OFTReal), ('degurba', ogr.OFTString), ('pop_est', ogr.OFTReal), ('fp_prob', ogr.OFTReal), ('place_code', ogr.OFTString)]:
    layer.CreateField(ogr.FieldDefn(name, kind))

def polygon_geom(coords):
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for x, y in coords: ring.AddPoint(x, y)
    poly = ogr.Geometry(ogr.wkbPolygon); poly.AddGeometry(ring); return poly

def add_feature(sid, coords, count, dens, degurba, pop_est, fp_prob, place_code):
    f = ogr.Feature(layer.GetLayerDefn())
    f.SetField('sid', sid); f.SetField('bldg_count', count); f.SetField('bldg_dens', dens)
    f.SetField('degurba', degurba); f.SetField('pop_est', pop_est); f.SetField('fp_prob', fp_prob); f.SetField('place_code', place_code)
    f.SetGeometry(polygon_geom(coords)); layer.CreateFeature(f)

# Dense/core fabric: one large extent with the site deep inside.
add_feature('core', [(7.994,6.994),(8.006,6.994),(8.006,7.006),(7.994,7.006),(7.994,6.994)], 1000, 620.0, 'urban_core', 4500.0, 0.01, 'CORE')

# Fragmented fabric: one small containing patch plus several nearby patches.
patches = [
 ('frag0', 8.0200, 7.0000), ('frag1', 8.0165, 7.0015), ('frag2', 8.0235, 7.0018),
 ('frag3', 8.0170, 6.9970), ('frag4', 8.0230, 6.9970), ('frag5', 8.0200, 7.0040),
]
for idx, (sid, x, y) in enumerate(patches):
    d = 0.00075 if idx == 0 else 0.00055
    add_feature(sid, [(x-d,y-d),(x+d,y-d),(x+d,y+d),(x-d,y+d),(x-d,y-d)], 20 + idx, 95.0 + idx, 'peri_urban', 120.0 + idx, 0.04, 'FRAG')

# Far features exercise source-feature coverage validation without affecting 1 km site buffers.
add_feature('corner-sw', [(7.985,6.985),(7.9854,6.985),(7.9854,6.9854),(7.985,6.9854),(7.985,6.985)], 2, 10.0, 'rural', 8.0, 0.10, 'EDGE')
add_feature('corner-ne', [(8.035,7.015),(8.0354,7.015),(8.0354,7.0154),(8.035,7.0154),(8.035,7.015)], 2, 10.0, 'rural', 8.0, 0.10, 'EDGE')
# Self-intersecting bow-tie validates deterministic MakeValid handling.
add_feature('repair-me', [(8.034,6.986),(8.035,6.987),(8.034,6.987),(8.035,6.986),(8.034,6.986)], 1, 5.0, 'rural', 4.0, 0.20, 'REPAIR')
layer.SyncToDisk(); ds = None
`, "utf8");
  await runCommand("python3", [generator, population, walking, mixed, settlements]);
  return { population, walking, mixed, settlements, fieldMap, coverage, badCoverage };
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  if (migration.applied.join(",") !== manifest.map((item) => item.version).join(",")) {
    throw new Error("SETTLEMENT_MIGRATION_MANIFEST_APPLICATION_FAILURE");
  }
  await seedSites();

  const directory = await mkdtemp(join(tmpdir(), "ooh-grid3-settlement-it-"));
  const fixture = await makeFixtures(directory);
  const node = process.execPath;

  async function registerRaster(role: "population" | "walking_friction" | "mixed_friction", input: string, name: string) {
    const release = role === "population" ? "2025-08-29-v3.0" : "2025-10-v1.0";
    const result = await runCommand(node, [
      "--import", "tsx", "scripts/register-grid3-raster.ts",
      `--role=${role}`, `--input=${input}`, `--release=${release}`,
      `--access-uri=file:///fixture/${name}`, `--storage-uri=file:///retained/${name}`,
      "--retrieved-at=2026-08-10T16:40:00Z",
    ]);
    return JSON.parse(result.stdout) as { artifactSha256: string };
  }

  const population = await registerRaster("population", fixture.population, "population.tif");
  const walking = await registerRaster("walking_friction", fixture.walking, "walking.tif");
  const mixed = await registerRaster("mixed_friction", fixture.mixed, "mixed.tif");
  await runCommand(node, [
    "--import", "tsx", "scripts/derive-grid3-accessibility.ts",
    `--population=${fixture.population}`, `--walking=${fixture.walking}`, `--mixed=${fixture.mixed}`,
    `--population-sha=${population.artifactSha256}`, `--walking-sha=${walking.artifactSha256}`, `--mixed-sha=${mixed.artifactSha256}`,
    "--radii=250,500,1000", "--thresholds=5,10,15", "--max-search-radius-m=1800",
  ]);

  const popDifference = await scalar(`
SELECT abs(max(population_estimate) - min(population_estimate))
FROM ooh_data.site_population_radius_context WHERE radius_m=500;
`);
  const walkDifference = await scalar(`
SELECT abs(max(population_estimate) - min(population_estimate))
FROM ooh_data.site_accessible_population_context WHERE access_mode='walking' AND threshold_minutes=5;
`);
  if (popDifference > 0.000001 || walkDifference > 0.000001) {
    throw new Error(`MORPH_FIXTURE_ACCESSIBILITY_NOT_MATCHED:${popDifference}:${walkDifference}`);
  }

  function importArgs(coveragePath: string, coverageStorageUri: string, coverageReference: string): string[] {
    return [
      "--import", "tsx", "scripts/import-grid3-settlement.ts",
      `--input=${fixture.settlements}`,
      "--layer=settlements",
      "--release=2026-08-v4.1",
      "--access-uri=file:///fixture/settlements.gpkg",
      "--storage-uri=file:///retained/settlements.gpkg",
      "--retrieved-at=2026-08-10T16:40:00Z",
      `--coverage-geojson=${coveragePath}`,
      `--coverage-storage-uri=${coverageStorageUri}`,
      `--coverage-reference=${coverageReference}`,
      "--license-id=CC-BY-4.0",
      "--attribution=GRID3 synthetic settlement fixture",
      "--share-alike=false",
      "--license-reviewed-at=2026-08-10",
      "--license-review-reference=fixture:reviewed-release-terms",
      "--limitations=synthetic fixture; operational morphology only",
      `--field-map=${fixture.fieldMap}`,
    ];
  }

  await expectCommandFailure(
    node,
    importArgs(
      fixture.badCoverage,
      "file:///retained/bad-settlement-coverage.geojson",
      "fixture:undersized-coverage-should-fail",
    ),
    "GRID3_SETTLEMENT_COVERAGE_EXCLUDES_SOURCE_FEATURE",
  );
  if (await scalar("SELECT count(*) FROM ooh_data.grid3_settlement_features;") !== 0) {
    throw new Error("GRID3_SETTLEMENT_FAILED_IMPORT_LEFT_FEATURE_ROWS");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.grid3_settlement_coverage;") !== 0) {
    throw new Error("GRID3_SETTLEMENT_FAILED_IMPORT_LEFT_COVERAGE_ROW");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.enrichment_runs WHERE source_id='grid3-nigeria-settlements' AND status='failed';") !== 1) {
    throw new Error("GRID3_SETTLEMENT_FAILED_IMPORT_AUDIT_MISSING");
  }

  const validImportArgs = importArgs(
    fixture.coverage,
    "file:///retained/settlement-coverage.geojson",
    "fixture:reviewed-exact-source-coverage",
  );
  const importedOne = JSON.parse((await runCommand(node, validImportArgs)).stdout) as {
    artifactSha256: string;
    counts: { repairedGeometries: number };
  };
  await runCommand(node, validImportArgs);
  if (importedOne.counts.repairedGeometries < 1) throw new Error("GRID3_SETTLEMENT_REPAIR_PATH_NOT_EXERCISED");
  if (await scalar("SELECT count(*) FROM ooh_data.enrichment_artifacts WHERE source_id='grid3-nigeria-settlements';") !== 1) {
    throw new Error("GRID3_SETTLEMENT_ARTIFACT_REPLAY_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.grid3_settlement_coverage;") !== 1) {
    throw new Error("GRID3_SETTLEMENT_COVERAGE_REPLAY_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.enrichment_runs WHERE source_id='grid3-nigeria-settlements' AND status='succeeded';") !== 2) {
    throw new Error("GRID3_SETTLEMENT_IMPORT_RUN_AUDIT_FAILURE");
  }

  const deriveArgs = [
    "--import", "tsx", "scripts/derive-grid3-settlement-context.ts",
    `--settlement-sha=${importedOne.artifactSha256}`,
    "--radii=250,500,1000",
  ];
  const deriveOne = JSON.parse((await runCommand(node, deriveArgs)).stdout) as { snapshotId: string };
  const deriveTwo = JSON.parse((await runCommand(node, deriveArgs)).stdout) as { snapshotId: string };
  if (deriveOne.snapshotId !== deriveTwo.snapshotId) throw new Error("GRID3_SETTLEMENT_SNAPSHOT_NOT_DETERMINISTIC");
  if (await scalar("SELECT count(*) FROM ooh_data.site_settlement_context_snapshots;") !== 1) {
    throw new Error("GRID3_SETTLEMENT_SNAPSHOT_REPLAY_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_settlement_context_runs WHERE status='succeeded';") !== 2) {
    throw new Error("GRID3_SETTLEMENT_DERIVATION_RUN_AUDIT_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_settlement_context;") !== 6) {
    throw new Error("GRID3_SETTLEMENT_CONTEXT_ROW_COUNT_FAILURE");
  }

  const morphology = await text(`
SELECT string_agg(
  site_id || ':' || round(core_depth_m::numeric,1)::text || ':' ||
  round(settled_area_share::numeric,3)::text || ':' || intersecting_settlement_count::text || ':' ||
  coalesce(primary_degree_urbanisation,'-'),
  ',' ORDER BY site_id
)
FROM ooh_data.site_settlement_context WHERE radius_m=500;
`);
  const coreDepth = await scalar("SELECT core_depth_m FROM ooh_data.site_settlement_context WHERE site_id='site:morph-core' AND radius_m=500;");
  const fragmentedDepth = await scalar("SELECT core_depth_m FROM ooh_data.site_settlement_context WHERE site_id='site:morph-fragmented' AND radius_m=500;");
  const coreShare = await scalar("SELECT settled_area_share FROM ooh_data.site_settlement_context WHERE site_id='site:morph-core' AND radius_m=500;");
  const fragmentedShare = await scalar("SELECT settled_area_share FROM ooh_data.site_settlement_context WHERE site_id='site:morph-fragmented' AND radius_m=500;");
  const corePatches = await scalar("SELECT intersecting_settlement_count FROM ooh_data.site_settlement_context WHERE site_id='site:morph-core' AND radius_m=500;");
  const fragmentedPatches = await scalar("SELECT intersecting_settlement_count FROM ooh_data.site_settlement_context WHERE site_id='site:morph-fragmented' AND radius_m=500;");
  if (!(coreDepth > fragmentedDepth && coreShare > fragmentedShare && fragmentedPatches > corePatches)) {
    throw new Error(`GRID3_SETTLEMENT_INCREMENTAL_VALUE_FAILURE:${morphology}`);
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_settlement_context WHERE decision_use <> 'context_only';") !== 0) {
    throw new Error("GRID3_SETTLEMENT_DECISION_USE_BOUNDARY_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.site_settlement_context WHERE coverage_status='partial_source_coverage';") !== 0) {
    throw new Error("GRID3_SETTLEMENT_FIXTURE_UNEXPECTED_PARTIAL_COVERAGE");
  }

  await expectSqlFailure(
    "UPDATE ooh_data.grid3_settlement_features SET place_code='MUTATED' WHERE feature_id='core';",
    "SETTLEMENT_CONTEXT_IMMUTABLE",
  );
  await expectSqlFailure(
    "UPDATE ooh_data.grid3_settlement_coverage SET coverage_reference='mutated';",
    "SETTLEMENT_CONTEXT_IMMUTABLE",
  );

  process.stdout.write(`${JSON.stringify({
    ok: true,
    migrationCount: manifest.length,
    snapshotId: deriveOne.snapshotId,
    e2b1PopulationDifference: popDifference,
    e2b1WalkingDifference: walkDifference,
    morphology,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`grid3-settlement integration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
