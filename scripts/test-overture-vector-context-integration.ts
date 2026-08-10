import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
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

async function scalar(sql: string): Promise<number> {
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${result.stdout}`);
  return value;
}

async function text(sql: string): Promise<string> {
  return (await runPsql(databaseUrl, sql, { tuplesOnly: true })).stdout.trim();
}

async function seedResolutionFixture(): Promise<void> {
  const resolutionRun = "88888888-8888-4888-8888-888888888888";
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, run_kind, status, completed_at)
VALUES ('${resolutionRun}'::uuid, 'entity-resolver-v1', 'rebuild', 'succeeded', now());

INSERT INTO ooh_data.canonical_entities (
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
) VALUES
  ('entity:state', 'state', 'lagos', 'Lagos', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid),
  ('entity:city', 'city', 'ikeja', 'Ikeja', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid),
  ('entity:format', 'format', 'large format', 'Large Format', 'entity-resolver-v1', 1, '${resolutionRun}'::uuid, '${resolutionRun}'::uuid);

INSERT INTO ooh_data.site_entities (
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
) VALUES (
  'site:vector-fixture', 'lagos|ikeja|vector fixture|billboard|large format', 'entity-resolver-v1',
  'confirmed', 'entity:state', 'entity:city', 'entity:format', 'Vector Fixture',
  'vector fixture', 'Billboard', 'billboard', '${resolutionRun}'::uuid, '${resolutionRun}'::uuid
);

INSERT INTO ooh_data.site_coordinate_assertions (
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m, source_kind,
  coordinate_source_id, source_artifact_id, spatial_rights, spatial_license_id,
  assertion_status, renderer_eligibility, planning_use, enrichment_revision
) VALUES
(
  'coordinate:center', 'site:vector-fixture', 6.6000, 3.3500, 5,
  'open_dataset', 'fixture:center', 'fixture:center:artifact', 'open_licensed',
  'CC-BY-4.0', 'approved', 'maplibre', 'context_only', 'fixture-r1'
),
(
  'coordinate:edge', 'site:vector-fixture', 6.6000, 3.3995, 5,
  'open_dataset', 'fixture:edge', 'fixture:edge:artifact', 'open_licensed',
  'CC-BY-4.0', 'approved', 'maplibre', 'context_only', 'fixture-r1'
);
`);
}

function placeFeature(input: {
  id: string;
  longitude: number;
  latitude: number;
  basicCategory: string;
  l0: string;
  confidence: number;
  status: "open" | "temporarily_closed" | "permanently_closed" | null;
  license?: string | null;
}) {
  return {
    type: "Feature",
    id: input.id,
    properties: {
      id: input.id,
      version: 1,
      name: input.id,
      basic_category: input.basicCategory,
      taxonomy: { hierarchy: [input.l0, input.basicCategory], primary: input.basicCategory },
      confidence: input.confidence,
      operating_status: input.status,
      sources: [{
        property: "/",
        dataset: `fixture-${input.id}`,
        ...(input.license === undefined ? { license: "CDLA-Permissive-2.0" } : { license: input.license }),
        record_id: input.id,
      }],
    },
    geometry: { type: "Point", coordinates: [input.longitude, input.latitude] },
  };
}

function roadFeature(input: {
  id: string;
  longitude: number;
  roadClass: "residential" | "primary" | "secondary" | "tertiary";
  connectors: string[];
}) {
  return {
    type: "Feature",
    id: input.id,
    properties: {
      id: input.id,
      version: 1,
      name: input.id,
      class: input.roadClass,
      subclass: null,
      connectors: input.connectors.map((connectorId, index) => ({
        connector_id: connectorId,
        at: index === 0 ? 0 : 1,
      })),
      sources: [{ dataset: "OpenStreetMap", license: "ODbL-1.0", record_id: input.id }],
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [input.longitude, 6.595],
        [input.longitude, 6.605],
      ],
    },
  };
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  const expectedVersions = manifest.map((item) => item.version);
  if (migration.applied.join(",") !== expectedVersions.join(",")) {
    throw new Error(`MIGRATION_MANIFEST_APPLICATION_FAILURE:${migration.applied.join(",")}`);
  }
  const postgis = await text("SELECT postgis_version();");
  if (!postgis) throw new Error("POSTGIS_EXTENSION_MISSING");
  await seedResolutionFixture();

  const directory = await mkdtemp(join(tmpdir(), "ooh-overture-context-it-"));
  const placesPath = join(directory, "places.geojson");
  const roadsPath = join(directory, "roads.geojson");
  const release = "2026-07-22.0";
  const bbox = "3.30,6.55,3.40,6.65";

  const places = {
    type: "FeatureCollection",
    features: [
      placeFeature({ id: "p1", longitude: 3.3505, latitude: 6.6000, basicCategory: "restaurant", l0: "food_and_drink", confidence: 0.95, status: "open" }),
      placeFeature({ id: "p2", longitude: 3.3530, latitude: 6.6000, basicCategory: "bank", l0: "business_and_professional_services", confidence: 0.80, status: null, license: null }),
      placeFeature({ id: "p3", longitude: 3.3560, latitude: 6.6000, basicCategory: "school", l0: "education", confidence: 0.90, status: "temporarily_closed" }),
      placeFeature({ id: "p4", longitude: 3.3580, latitude: 6.6000, basicCategory: "store", l0: "retail", confidence: 0, status: "permanently_closed" }),
      placeFeature({ id: "p5", longitude: 3.3650, latitude: 6.6000, basicCategory: "clinic", l0: "health", confidence: 0.90, status: "open" }),
    ],
  };
  const roads = {
    type: "FeatureCollection",
    features: [
      roadFeature({ id: "r1", longitude: 3.3505, roadClass: "residential", connectors: ["c1", "c2"] }),
      roadFeature({ id: "r2", longitude: 3.3535, roadClass: "primary", connectors: ["c3", "c4"] }),
      roadFeature({ id: "r3", longitude: 3.3580, roadClass: "secondary", connectors: ["c5", "c6"] }),
      roadFeature({ id: "r4", longitude: 3.3650, roadClass: "tertiary", connectors: ["c7", "c8"] }),
    ],
  };
  await writeFile(placesPath, `${JSON.stringify(places)}\n`, "utf8");
  await writeFile(roadsPath, `${JSON.stringify(roads)}\n`, "utf8");

  const node = process.execPath;
  const importBase = ["--import", "tsx", "scripts/import-overture-vector.ts"];
  const placesArgs = [
    ...importBase,
    "--kind=places",
    `--input=${placesPath}`,
    `--release=${release}`,
    `--bbox=${bbox}`,
    `--access-uri=s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/`,
    "--storage-uri=file:///tmp/overture/places.geojson",
    "--retrieved-at=2026-08-10T12:00:00Z",
  ];
  const roadsArgs = [
    ...importBase,
    "--kind=roads",
    `--input=${roadsPath}`,
    `--release=${release}`,
    `--bbox=${bbox}`,
    `--access-uri=s3://overturemaps-us-west-2/release/${release}/theme=transportation/type=segment/`,
    "--storage-uri=file:///tmp/overture/roads.geojson",
    "--retrieved-at=2026-08-10T12:00:00Z",
  ];

  const firstPlaces = JSON.parse((await runCommand(node, placesArgs)).stdout) as { artifactSha256: string };
  await runCommand(node, placesArgs);
  const firstRoads = JSON.parse((await runCommand(node, roadsArgs)).stdout) as { artifactSha256: string };
  await runCommand(node, roadsArgs);

  if (await scalar("SELECT count(*) FROM ooh_data.overture_place_features;") !== 5) {
    throw new Error("OVERTURE_PLACE_IMPORT_IDEMPOTENCY_FAILURE");
  }
  if (await scalar("SELECT count(*) FROM ooh_data.overture_road_segments;") !== 4) {
    throw new Error("OVERTURE_ROAD_IMPORT_IDEMPOTENCY_FAILURE");
  }
  const missingSourceLicense = await scalar(`
SELECT (counts->>'sourceItemsMissingExplicitLicense')::integer
FROM ooh_data.enrichment_runs
WHERE source_id='overture-places' AND status='succeeded'
ORDER BY completed_at, run_id LIMIT 1;
`);
  if (missingSourceLicense !== 1) throw new Error(`OVERTURE_SOURCE_LICENSE_COVERAGE_FAILURE:${missingSourceLicense}`);

  await expectSqlFailure(
    "UPDATE ooh_data.overture_place_features SET name='mutated' WHERE feature_id='p1';",
    "OVERTURE_NORMALIZED_FEATURE_IMMUTABLE",
  );

  const deriveArgs = [
    "--import", "tsx", "scripts/derive-overture-vector-context.ts",
    `--places-sha=${firstPlaces.artifactSha256}`,
    `--roads-sha=${firstRoads.artifactSha256}`,
    "--radii=250,500,1000",
  ];
  const deriveOne = JSON.parse((await runCommand(node, deriveArgs)).stdout) as { snapshotId: string };
  const deriveTwo = JSON.parse((await runCommand(node, deriveArgs)).stdout) as { snapshotId: string };
  if (deriveOne.snapshotId !== deriveTwo.snapshotId) throw new Error("VECTOR_CONTEXT_SNAPSHOT_NOT_DETERMINISTIC");

  const snapshotCount = await scalar("SELECT count(*) FROM ooh_data.site_vector_context_snapshots;");
  if (snapshotCount !== 1) throw new Error(`VECTOR_CONTEXT_SNAPSHOT_IDEMPOTENCY_FAILURE:${snapshotCount}`);
  const succeededRuns = await scalar("SELECT count(*) FROM ooh_data.site_vector_context_runs WHERE status='succeeded';");
  if (succeededRuns !== 2) throw new Error(`VECTOR_CONTEXT_RUN_AUDIT_FAILURE:${succeededRuns}`);

  const centerCoverage = await scalar(`
SELECT count(*) FROM ooh_data.site_vector_context_coverage
WHERE coordinate_assertion_id='coordinate:center' AND coverage_status='full';
`);
  if (centerCoverage !== 3) throw new Error(`VECTOR_CONTEXT_CENTER_COVERAGE_FAILURE:${centerCoverage}`);
  const edgeCoverage = await scalar(`
SELECT count(*) FROM ooh_data.site_vector_context_coverage
WHERE coordinate_assertion_id='coordinate:edge' AND coverage_status='uncovered';
`);
  if (edgeCoverage !== 3) throw new Error(`VECTOR_CONTEXT_EDGE_COVERAGE_FAILURE:${edgeCoverage}`);
  const edgeFeatureRows = await scalar(`
SELECT
  (SELECT count(*) FROM ooh_data.site_destination_context WHERE coordinate_assertion_id='coordinate:edge')
  + (SELECT count(*) FROM ooh_data.site_network_context WHERE coordinate_assertion_id='coordinate:edge');
`);
  if (edgeFeatureRows !== 0) throw new Error(`VECTOR_CONTEXT_UNCOVERED_ZERO_FABRICATION:${edgeFeatureRows}`);

  const placeCounts = await text(`
SELECT string_agg(radius_m || ':' || place_count, ',' ORDER BY radius_m)
FROM ooh_data.site_destination_context
WHERE coordinate_assertion_id='coordinate:center';
`);
  if (placeCounts !== "250:1,500:2,1000:4") throw new Error(`VECTOR_CONTEXT_PLACE_RADIUS_FAILURE:${placeCounts}`);
  const placeStatus = await text(`
SELECT operating_or_unknown_count || ':' || high_confidence_count || ':' || temporarily_closed_count || ':' || permanently_closed_count
FROM ooh_data.site_destination_context
WHERE coordinate_assertion_id='coordinate:center' AND radius_m=1000;
`);
  if (placeStatus !== "2:2:1:1") throw new Error(`VECTOR_CONTEXT_PLACE_STATUS_FAILURE:${placeStatus}`);

  const basicCounts = JSON.parse(await text(`
SELECT basic_category_counts::text
FROM ooh_data.site_destination_context
WHERE coordinate_assertion_id='coordinate:center' AND radius_m=1000;
`)) as Record<string, number>;
  if (basicCounts.bank !== 1 || basicCounts.restaurant !== 1 || Object.keys(basicCounts).length !== 2) {
    throw new Error(`VECTOR_CONTEXT_CURRENT_DESTINATION_MIX_FAILURE:${JSON.stringify(basicCounts)}`);
  }
  const entropy = await scalar(`
SELECT taxonomy_entropy FROM ooh_data.site_destination_context
WHERE coordinate_assertion_id='coordinate:center' AND radius_m=1000;
`);
  if (Math.abs(entropy - Math.log(2)) > 0.000001) throw new Error(`VECTOR_CONTEXT_ENTROPY_FAILURE:${entropy}`);

  const roadCounts = await text(`
SELECT string_agg(radius_m || ':' || road_segment_count || ':' || major_road_segment_count || ':' || distinct_connector_count, ',' ORDER BY radius_m)
FROM ooh_data.site_network_context
WHERE coordinate_assertion_id='coordinate:center';
`);
  if (roadCounts !== "250:1:0:2,500:2:1:4,1000:3:2:6") {
    throw new Error(`VECTOR_CONTEXT_ROAD_RADIUS_FAILURE:${roadCounts}`);
  }
  const nearRoad = await scalar(`
SELECT nearest_road_m FROM ooh_data.site_network_context
WHERE coordinate_assertion_id='coordinate:center' AND radius_m=250;
`);
  if (nearRoad <= 30 || nearRoad >= 80) throw new Error(`VECTOR_CONTEXT_NEAREST_ROAD_FAILURE:${nearRoad}`);
  const noMajorAt250 = await text(`
SELECT coalesce(nearest_major_road_class, 'NULL') FROM ooh_data.site_network_context
WHERE coordinate_assertion_id='coordinate:center' AND radius_m=250;
`);
  if (noMajorAt250 !== "NULL") throw new Error(`VECTOR_CONTEXT_MAJOR_ROAD_RADIUS_FAILURE:${noMajorAt250}`);
  const majorAt500 = await text(`
SELECT nearest_major_road_class FROM ooh_data.site_network_context
WHERE coordinate_assertion_id='coordinate:center' AND radius_m=500;
`);
  if (majorAt500 !== "primary") throw new Error(`VECTOR_CONTEXT_MAJOR_ROAD_CLASS_FAILURE:${majorAt500}`);

  const nonContext = await scalar(`
SELECT
  (SELECT count(*) FROM ooh_data.site_vector_context_runs WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_vector_context_snapshots WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_vector_context_coverage WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_destination_context WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_network_context WHERE decision_use <> 'context_only');
`);
  if (nonContext !== 0) throw new Error(`VECTOR_CONTEXT_DECISION_USE_FAILURE:${nonContext}`);

  const semantics = await text(`
SELECT d.semantic_label || ':' || n.semantic_label || ':' || c.semantic_label
FROM ooh_data.site_destination_context d
JOIN ooh_data.site_network_context n USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
JOIN ooh_data.site_vector_context_coverage c USING (snapshot_id, site_id, coordinate_assertion_id, radius_m)
WHERE d.coordinate_assertion_id='coordinate:center' AND d.radius_m=500;
`);
  if (semantics !== "destination_presence_context_not_visitation:network_prominence_context_not_observed_traffic:source_reduction_coverage_not_feature_absence") {
    throw new Error(`VECTOR_CONTEXT_SEMANTIC_BOUNDARY_FAILURE:${semantics}`);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    postgis,
    migrationCount: expectedVersions.length,
    snapshotId: deriveOne.snapshotId,
    placeCounts,
    roadCounts,
    centerCoverage,
    edgeCoverage,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Overture vector context integration failed: ${message}\n`);
  process.exitCode = 1;
});
