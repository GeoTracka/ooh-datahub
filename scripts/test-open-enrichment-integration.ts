import { createHash } from "node:crypto";
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
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${result.stdout}`);
  return value;
}

async function text(sql: string): Promise<string> {
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  return result.stdout.trim();
}

async function seedResolvedFixture(): Promise<void> {
  const runId = "77777777-7777-4777-8777-777777777777";
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, run_kind, status, completed_at)
VALUES ('${runId}'::uuid, 'entity-resolver-v1', 'rebuild', 'succeeded', now());

INSERT INTO ooh_data.canonical_entities (
  entity_id, entity_type, normalized_key, canonical_name, resolver_version,
  representative_observation_count, first_resolution_run_id, last_resolution_run_id
) VALUES
  ('entity:state', 'state', 'lagos', 'Lagos', 'entity-resolver-v1', 1, '${runId}'::uuid, '${runId}'::uuid),
  ('entity:city', 'city', 'ikeja', 'Ikeja', 'entity-resolver-v1', 1, '${runId}'::uuid, '${runId}'::uuid),
  ('entity:format', 'format', 'large format', 'Large Format', 'entity-resolver-v1', 1, '${runId}'::uuid, '${runId}'::uuid);

INSERT INTO ooh_data.site_entities (
  site_id, strict_key, resolver_version, identity_status, state_entity_id, city_entity_id,
  format_entity_id, representative_address, normalized_address, representative_board_type,
  normalized_board_type, first_resolution_run_id, last_resolution_run_id
) VALUES (
  'site:fixture', 'lagos|ikeja|1 allen avenue|billboard|large format', 'entity-resolver-v1',
  'confirmed', 'entity:state', 'entity:city', 'entity:format', '1 Allen Avenue',
  '1 allen avenue', 'Billboard', 'billboard', '${runId}'::uuid, '${runId}'::uuid
);

INSERT INTO ooh_data.site_coordinate_assertions (
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m, source_kind,
  coordinate_source_id, source_artifact_id, spatial_rights, spatial_license_id,
  assertion_status, renderer_eligibility, planning_use, enrichment_revision
) VALUES (
  'coordinate:fixture', 'site:fixture', 6.6018, 3.3515, 5,
  'open_dataset', 'fixture-open-coordinate', 'fixture-open-artifact', 'open_licensed',
  'CC-BY-4.0', 'approved', 'maplibre', 'context_only', 'fixture-r1'
);

INSERT INTO ooh_data.airport_entities (
  airport_id, normalized_name_key, canonical_name, state_normalized_key,
  resolver_version, identity_status, first_resolution_run_id, last_resolution_run_id
) VALUES (
  'airport:mmia', 'murtala muhammed international airport',
  'Murtala Muhammed International Airport', 'lagos', 'entity-resolver-v1',
  'candidate', '${runId}'::uuid, '${runId}'::uuid
);
`);
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const migration = await migrateDatabase();
  const expectedVersions = manifest.map((item) => item.version);
  if (migration.applied.join(",") !== expectedVersions.join(",")) {
    throw new Error(`MIGRATION_MANIFEST_APPLICATION_FAILURE:${migration.applied.join(",")}`);
  }
  await seedResolvedFixture();

  const directory = await mkdtemp(join(tmpdir(), "ooh-open-enrichment-it-"));
  const airportPath = join(directory, "airports.csv");
  const airportHeader = [
    "id", "ident", "type", "name", "latitude_deg", "longitude_deg", "elevation_ft",
    "continent", "iso_country", "iso_region", "municipality", "scheduled_service",
    "gps_code", "iata_code", "local_code", "home_link", "wikipedia_link", "keywords",
  ].join(",");
  await writeFile(airportPath, [
    airportHeader,
    "101,DNMM,large_airport,Murtala Muhammed International Airport,6.5774,3.3212,135,AF,NG,NG-LA,Lagos,yes,DNMM,LOS,,,,",
    "102,DGAA,large_airport,Kotoka International Airport,5.6052,-0.1668,205,AF,GH,GH-AA,Accra,yes,DGAA,ACC,,,,",
  ].join("\n") + "\n", "utf8");

  const rawOsmPath = join(directory, "nigeria-latest.osm.pbf");
  const rawOsmBytes = Buffer.from("fixture-pinned-geofabrik-pbf", "utf8");
  await writeFile(rawOsmPath, rawOsmBytes);
  const rawOsmSha = createHash("sha256").update(rawOsmBytes).digest("hex");

  const osmPath = join(directory, "nigeria-advertising.geojsonseq");
  const osmFeature = {
    type: "Feature",
    properties: {
      "@type": "node",
      "@id": 5001,
      advertising: "billboard",
      operator: "Fixture Outdoor",
      ref: "FIX-001",
      lit: "yes",
    },
    geometry: { type: "Point", coordinates: [3.35155, 6.60182] },
  };
  const ignoredFeature = {
    type: "Feature",
    properties: { "@type": "node", "@id": 5002, amenity: "bank" },
    geometry: { type: "Point", coordinates: [3.35, 6.60] },
  };
  const osmText = `${JSON.stringify(osmFeature)}\n${JSON.stringify(ignoredFeature)}\n`;
  await writeFile(osmPath, osmText, "utf8");
  const osmDerivedSha = createHash("sha256").update(osmText, "utf8").digest("hex");

  const node = process.execPath;
  const importScript = ["--import", "tsx", "scripts/import-open-enrichment.ts"];
  const registerScript = ["--import", "tsx", "scripts/register-open-artifact.ts"];
  const linkScript = ["--import", "tsx", "scripts/link-enrichment-artifact-derivation.ts"];
  const airportArgs = [
    ...importScript,
    "--source=ourairports-airports",
    `--input=${airportPath}`,
    "--release=fixture-2026-08-10",
    "--access-uri=https://example.test/ourairports/airports.csv",
    "--storage-uri=file:///tmp/ourairports/airports.csv",
    "--retrieved-at=2026-08-10T12:00:00Z",
  ];
  const rawOsmRegisterArgs = [
    ...registerScript,
    "--source=osm-geofabrik-nigeria",
    `--input=${rawOsmPath}`,
    "--release=fixture-2026-08-10",
    "--access-uri=https://example.test/geofabrik/nigeria-latest.osm.pbf",
    "--storage-uri=file:///tmp/geofabrik/nigeria-latest.osm.pbf",
    "--retrieved-at=2026-08-10T12:00:00Z",
    "--content-type=application/vnd.openstreetmap.data+pbf",
    "--artifact-kind=raw_pbf",
  ];
  const osmArgs = [
    ...importScript,
    "--source=osm-geofabrik-nigeria",
    `--input=${osmPath}`,
    "--release=fixture-2026-08-10",
    "--access-uri=file:///tmp/geofabrik/nigeria-advertising.geojsonseq",
    "--storage-uri=file:///tmp/geofabrik/nigeria-advertising.geojsonseq",
    "--retrieved-at=2026-08-10T12:00:00Z",
  ];

  await runCommand(node, airportArgs);
  await runCommand(node, airportArgs);
  await runCommand(node, rawOsmRegisterArgs);

  // The derived file is registered by the failed import, but the database must
  // reject its candidate rows until exact raw-PBF lineage is attached.
  await expectCommandFailure(node, osmArgs, "OSM_ADVERTISING_DERIVATION_LINEAGE_REQUIRED");
  await runCommand(node, [
    ...linkScript,
    "--child-source=osm-geofabrik-nigeria",
    `--child-sha=${osmDerivedSha}`,
    "--parent-source=osm-geofabrik-nigeria",
    `--parent-sha=${rawOsmSha}`,
    "--transform-id=osmium-advertising-reduction",
    "--transform-version=v1",
  ]);
  await runCommand(node, osmArgs);
  await runCommand(node, osmArgs);

  const artifactCount = await scalar("SELECT count(*) FROM ooh_data.enrichment_artifacts;");
  if (artifactCount !== 3) throw new Error(`ENRICHMENT_ARTIFACT_IDEMPOTENCY_FAILURE:${artifactCount}`);
  const succeededRuns = await scalar("SELECT count(*) FROM ooh_data.enrichment_runs WHERE status='succeeded';");
  if (succeededRuns !== 4) throw new Error(`ENRICHMENT_RUN_AUDIT_FAILURE:${succeededRuns}`);
  const failedRuns = await scalar("SELECT count(*) FROM ooh_data.enrichment_runs WHERE status='failed';");
  if (failedRuns !== 1) throw new Error(`ENRICHMENT_FAILED_RUN_AUDIT_FAILURE:${failedRuns}`);

  const lineage = await text(`
SELECT transform_id || ':' || transform_version
FROM ooh_data.open_enrichment_artifact_lineage
WHERE child_artifact_sha256='${osmDerivedSha}' AND parent_artifact_sha256='${rawOsmSha}';
`);
  if (lineage !== "osmium-advertising-reduction:v1") {
    throw new Error(`OSM_DERIVATION_LINEAGE_FAILURE:${lineage}`);
  }

  const airportCount = await scalar("SELECT count(*) FROM ooh_data.open_airport_references;");
  if (airportCount !== 1) throw new Error(`NIGERIA_AIRPORT_FILTER_FAILURE:${airportCount}`);
  const airportLink = await text(`
SELECT link_status || ':' || link_method || ':' || decision_use
FROM ooh_data.airport_open_reference_links
WHERE reference_id='101' AND airport_id='airport:mmia';
`);
  if (airportLink !== "candidate:exact_normalized_name:context_only") {
    throw new Error(`AIRPORT_REFERENCE_LINK_FAILURE:${airportLink}`);
  }

  const osmCount = await scalar("SELECT count(*) FROM ooh_data.osm_advertising_candidates;");
  if (osmCount !== 1) throw new Error(`OSM_ADVERTISING_FILTER_FAILURE:${osmCount}`);
  const osmSemantics = await text(`
SELECT advertising_type || ':' || operator_name || ':' || decision_use
FROM ooh_data.osm_advertising_candidates
WHERE osm_type='node' AND osm_id='5001';
`);
  if (osmSemantics !== "billboard:Fixture Outdoor:context_only") {
    throw new Error(`OSM_ADVERTISING_SEMANTICS_FAILURE:${osmSemantics}`);
  }
  const siteMatch = await text(`
SELECT match_status || ':' || match_method || ':' || decision_use
FROM ooh_data.site_open_candidate_matches
WHERE osm_type='node' AND osm_id='5001' AND site_id='site:fixture';
`);
  if (siteMatch !== "candidate:approved_coordinate_proximity:context_only") {
    throw new Error(`OSM_SITE_CANDIDATE_LINK_FAILURE:${siteMatch}`);
  }
  const matchDistance = await scalar(`
SELECT round(distance_m)::integer FROM ooh_data.site_open_candidate_matches
WHERE osm_type='node' AND osm_id='5001' AND site_id='site:fixture';
`);
  if (matchDistance > 20) throw new Error(`OSM_SITE_DISTANCE_FAILURE:${matchDistance}`);

  const siteIdentity = await text("SELECT identity_status FROM ooh_data.site_entities WHERE site_id='site:fixture';");
  if (siteIdentity !== "confirmed") throw new Error(`SITE_IDENTITY_MUTATED:${siteIdentity}`);
  const ownerAssertions = await scalar("SELECT count(*) FROM ooh_data.site_media_owner_assertions;");
  if (ownerAssertions !== 0) throw new Error(`OPEN_DATA_INFERRED_MEDIA_OWNER:${ownerAssertions}`);

  const attribution = await text(`
SELECT string_agg(source_license, ',' ORDER BY source_license)
FROM (
  SELECT DISTINCT source_id || ':' || license_id || ':' || commercial_use_status AS source_license
  FROM ooh_data.open_enrichment_attribution
) x;
`);
  if (attribution !== "osm-geofabrik-nigeria:ODbL-1.0:permitted,ourairports-airports:Public-Domain:permitted") {
    throw new Error(`ENRICHMENT_ATTRIBUTION_FAILURE:${attribution}`);
  }

  const nonContext = await scalar(`
SELECT
  (SELECT count(*) FROM ooh_data.enrichment_runs WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.open_airport_references WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.airport_open_reference_links WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.osm_advertising_candidates WHERE decision_use <> 'context_only')
  + (SELECT count(*) FROM ooh_data.site_open_candidate_matches WHERE decision_use <> 'context_only');
`);
  if (nonContext !== 0) throw new Error(`ENRICHMENT_CONTEXT_BOUNDARY_FAILURE:${nonContext}`);

  process.stdout.write(JSON.stringify({
    ok: true,
    migrationCount: expectedVersions.length,
    artifacts: artifactCount,
    succeededRuns,
    failedRuns,
    airportReferences: airportCount,
    osmAdvertisingCandidates: osmCount,
    siteCandidateDistanceM: matchDistance,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`open enrichment integration failed: ${message}\n`);
  process.exitCode = 1;
});
