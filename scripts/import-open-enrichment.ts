import { createHash, randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { migrateDatabase } from "./db-migrate";
import { copyStart, copyTextRow, sqlLiteral, validateRetentionUri } from "./data/persistenceFormat";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";
import {
  buildArtifactRegistration,
  type ArtifactLicenseOverride,
  type EnrichmentArtifactRegistration,
} from "../src/enrichment/artifactContract";
import {
  OUR_AIRPORTS_ADAPTER_VERSION,
  parseOurAirportsCsv,
  type OurAirportsReference,
} from "../src/enrichment/ourAirports";
import {
  OSM_ADVERTISING_ADAPTER_VERSION,
  parseOsmAdvertisingGeoJsonSequence,
  type OsmAdvertisingCandidate,
} from "../src/enrichment/osmAdvertising";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredArg(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`ENRICHMENT_ARGUMENT_REQUIRED:${name}`);
  return value;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function json(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function adapterVersion(sourceId: string): string {
  if (sourceId === "ourairports-airports") return OUR_AIRPORTS_ADAPTER_VERSION;
  if (sourceId === "osm-geofabrik-nigeria") return OSM_ADVERTISING_ADAPTER_VERSION;
  throw new Error(`ENRICHMENT_ADAPTER_NOT_IMPLEMENTED:${sourceId}`);
}

function defaultContentType(sourceId: string): string {
  if (sourceId === "ourairports-airports") return "text/csv; charset=utf-8";
  if (sourceId === "osm-geofabrik-nigeria") return "application/geo+json-seq; charset=utf-8";
  return "application/octet-stream";
}

async function loadLicenseOverride(): Promise<ArtifactLicenseOverride | undefined> {
  const path = arg("license-review-json");
  if (!path) return undefined;
  const raw = JSON.parse(await readFile(resolve(path), "utf8")) as ArtifactLicenseOverride;
  return raw;
}

async function writeRows(
  session: PsqlSession,
  table: string,
  columns: readonly string[],
  rows: Iterable<readonly unknown[]> | AsyncIterable<readonly unknown[]>,
): Promise<number> {
  await session.write(copyStart(table, columns));
  let count = 0;
  try {
    for await (const row of rows) {
      await session.write(copyTextRow(row));
      count += 1;
    }
  } catch (error) {
    await session.write("\\.\n");
    throw error;
  }
  await session.write("\\.\n");
  return count;
}

async function registerArtifactAndRun(
  databaseUrl: string,
  registration: EnrichmentArtifactRegistration,
  runId: string,
  version: string,
): Promise<void> {
  await runPsql(databaseUrl, `
\\set ON_ERROR_STOP on
BEGIN;
INSERT INTO ooh_data.enrichment_artifacts (
  source_id, artifact_sha256, source_release, file_name, content_type, byte_size,
  access_uri, storage_uri, retrieved_at, license_id, attribution_text, share_alike,
  commercial_use_status, acquisition_mode, metadata
) VALUES (
  ${sqlLiteral(registration.sourceId)},
  ${sqlLiteral(registration.sha256)},
  ${sqlLiteral(registration.sourceRelease)},
  ${sqlLiteral(registration.fileName)},
  ${sqlLiteral(registration.contentType)},
  ${registration.byteSize},
  ${sqlLiteral(registration.accessUri)},
  ${sqlLiteral(registration.storageUri)},
  ${sqlLiteral(registration.retrievedAt)}::timestamptz,
  ${sqlLiteral(registration.licenseId)},
  ${sqlLiteral(registration.attributionText)},
  ${registration.shareAlike ? "true" : "false"},
  ${sqlLiteral(registration.commercialUseStatus)},
  ${sqlLiteral(registration.acquisitionMode)},
  ${json(registration.metadata)}
)
ON CONFLICT (source_id, artifact_sha256) DO NOTHING;

DO $artifact_immutability$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id = ${sqlLiteral(registration.sourceId)}
    AND a.artifact_sha256 = ${sqlLiteral(registration.sha256)}
    AND (
      a.source_release IS DISTINCT FROM ${sqlLiteral(registration.sourceRelease)}
      OR a.file_name IS DISTINCT FROM ${sqlLiteral(registration.fileName)}
      OR a.content_type IS DISTINCT FROM ${sqlLiteral(registration.contentType)}
      OR a.byte_size IS DISTINCT FROM ${registration.byteSize}
      OR a.license_id IS DISTINCT FROM ${sqlLiteral(registration.licenseId)}
      OR a.attribution_text IS DISTINCT FROM ${sqlLiteral(registration.attributionText)}
      OR a.share_alike IS DISTINCT FROM ${registration.shareAlike ? "true" : "false"}
      OR a.commercial_use_status IS DISTINCT FROM ${sqlLiteral(registration.commercialUseStatus)}
      OR a.acquisition_mode IS DISTINCT FROM ${sqlLiteral(registration.acquisitionMode)}
    );
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'ENRICHMENT_ARTIFACT_METADATA_DRIFT';
  END IF;
END;
$artifact_immutability$;

INSERT INTO ooh_data.enrichment_runs (
  run_id, source_id, artifact_sha256, adapter_version, status, decision_use
) VALUES (
  ${sqlLiteral(runId)}::uuid,
  ${sqlLiteral(registration.sourceId)},
  ${sqlLiteral(registration.sha256)},
  ${sqlLiteral(version)},
  'running',
  'context_only'
);
COMMIT;
`);
}

async function markRunFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = (detail.split(":")[0] || "OPEN_ENRICHMENT_FAILED").slice(0, 128);
  await runPsql(databaseUrl, `
UPDATE ooh_data.enrichment_runs
SET status='failed', completed_at=now(), error_code=${sqlLiteral(code)}, error_detail=${sqlLiteral(detail)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

async function finishRun(
  databaseUrl: string,
  runId: string,
  counts: Record<string, number>,
): Promise<void> {
  await runPsql(databaseUrl, `
UPDATE ooh_data.enrichment_runs
SET status='succeeded', completed_at=now(), counts=${json(counts)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

async function importOurAirports(
  databaseUrl: string,
  registration: EnrichmentArtifactRegistration,
  runId: string,
  rows: OurAirportsReference[],
): Promise<Record<string, number>> {
  const session = startPsql(databaseUrl);
  try {
    await session.write(`\\set ON_ERROR_STOP on\nBEGIN;\nCREATE TEMP TABLE incoming_open_airports (LIKE ooh_data.open_airport_references INCLUDING DEFAULTS) ON COMMIT DROP;\n`);
    await writeRows(
      session,
      "incoming_open_airports",
      [
        "source_id", "artifact_sha256", "reference_id", "ident", "airport_type", "name",
        "normalized_name_key", "latitude", "longitude", "elevation_ft", "continent",
        "iso_country", "iso_region", "municipality", "scheduled_service", "gps_code",
        "iata_code", "local_code", "home_link", "wikipedia_link", "keywords", "raw_record",
        "first_enrichment_run_id", "decision_use",
      ],
      rows.map((row) => [
        registration.sourceId,
        registration.sha256,
        row.referenceId,
        row.ident,
        row.airportType,
        row.name,
        row.normalizedName,
        row.latitude,
        row.longitude,
        row.elevationFt,
        row.continent,
        row.isoCountry,
        row.isoRegion,
        row.municipality,
        row.scheduledService,
        row.gpsCode,
        row.iataCode,
        row.localCode,
        row.homeLink,
        row.wikipediaLink,
        row.keywords,
        row.rawRecord,
        runId,
        "context_only",
      ]),
    );
    await session.write(`
INSERT INTO ooh_data.open_airport_references (
  source_id, artifact_sha256, reference_id, ident, airport_type, name, normalized_name_key,
  latitude, longitude, elevation_ft, continent, iso_country, iso_region, municipality,
  scheduled_service, gps_code, iata_code, local_code, home_link, wikipedia_link, keywords,
  raw_record, first_enrichment_run_id, decision_use
)
SELECT
  source_id, artifact_sha256, reference_id, ident, airport_type, name, normalized_name_key,
  latitude, longitude, elevation_ft, continent, iso_country, iso_region, municipality,
  scheduled_service, gps_code, iata_code, local_code, home_link, wikipedia_link, keywords,
  raw_record, first_enrichment_run_id, decision_use
FROM incoming_open_airports
ON CONFLICT (source_id, artifact_sha256, reference_id) DO NOTHING;

WITH exact_matches AS (
  SELECT DISTINCT r.source_id, r.artifact_sha256, r.reference_id, a.airport_id
  FROM incoming_open_airports r
  JOIN ooh_data.airport_entities a
    ON a.normalized_name_key = r.normalized_name_key
  UNION
  SELECT DISTINCT r.source_id, r.artifact_sha256, r.reference_id, aa.airport_id
  FROM incoming_open_airports r
  JOIN ooh_data.airport_aliases aa
    ON aa.normalized_key = r.normalized_name_key
)
INSERT INTO ooh_data.airport_open_reference_links (
  source_id, artifact_sha256, reference_id, airport_id, link_method, link_status,
  evidence, first_enrichment_run_id, last_enrichment_run_id, decision_use
)
SELECT
  m.source_id, m.artifact_sha256, m.reference_id, m.airport_id,
  'exact_normalized_name', 'candidate',
  jsonb_build_object(
    'semantics', 'external_reference_candidate_not_airport_identity_confirmation',
    'normalization', 'entity-resolver-v1'
  ),
  ${sqlLiteral(runId)}::uuid, ${sqlLiteral(runId)}::uuid, 'context_only'
FROM exact_matches m
ON CONFLICT (source_id, artifact_sha256, reference_id, airport_id) DO UPDATE SET
  last_enrichment_run_id=EXCLUDED.last_enrichment_run_id;
COMMIT;
`);
    await session.finish();
  } catch (error) {
    try { await session.write("ROLLBACK;\n"); } catch { /* session may be closed */ }
    try { await session.finish(); } catch { /* preserve original error */ }
    throw error;
  }
  const linkResult = await runPsql(databaseUrl, `
SELECT count(*) FROM ooh_data.airport_open_reference_links
WHERE source_id=${sqlLiteral(registration.sourceId)} AND artifact_sha256=${sqlLiteral(registration.sha256)};
`, { tuplesOnly: true });
  return { airportReferences: rows.length, airportCandidateLinks: Number(linkResult.stdout.trim()) || 0 };
}

async function importOsmAdvertising(
  databaseUrl: string,
  registration: EnrichmentArtifactRegistration,
  runId: string,
  rows: OsmAdvertisingCandidate[],
): Promise<Record<string, number>> {
  const session = startPsql(databaseUrl);
  try {
    await session.write(`\\set ON_ERROR_STOP on\nBEGIN;\nCREATE TEMP TABLE incoming_osm_ads (LIKE ooh_data.osm_advertising_candidates INCLUDING DEFAULTS) ON COMMIT DROP;\n`);
    await writeRows(
      session,
      "incoming_osm_ads",
      [
        "source_id", "artifact_sha256", "osm_type", "osm_id", "geometry_type", "latitude",
        "longitude", "representative_method", "advertising_type", "operator_name", "source_ref",
        "display_surface", "orientation", "direction", "size_text", "height_text", "lit",
        "luminous", "animated", "sides", "visibility", "message", "tags", "geometry",
        "first_enrichment_run_id", "decision_use",
      ],
      rows.map((row) => [
        registration.sourceId,
        registration.sha256,
        row.osmType,
        row.osmId,
        row.geometryType,
        row.latitude,
        row.longitude,
        row.representativeMethod,
        row.advertisingType,
        row.operatorName,
        row.sourceRef,
        row.displaySurface,
        row.orientation,
        row.direction,
        row.sizeText,
        row.heightText,
        row.lit,
        row.luminous,
        row.animated,
        row.sides,
        row.visibility,
        row.message,
        row.tags,
        row.geometry,
        runId,
        "context_only",
      ]),
    );
    await session.write(`
INSERT INTO ooh_data.osm_advertising_candidates (
  source_id, artifact_sha256, osm_type, osm_id, geometry_type, latitude, longitude,
  representative_method, advertising_type, operator_name, source_ref, display_surface,
  orientation, direction, size_text, height_text, lit, luminous, animated, sides, visibility,
  message, tags, geometry, first_enrichment_run_id, decision_use
)
SELECT
  source_id, artifact_sha256, osm_type, osm_id, geometry_type, latitude, longitude,
  representative_method, advertising_type, operator_name, source_ref, display_surface,
  orientation, direction, size_text, height_text, lit, luminous, animated, sides, visibility,
  message, tags, geometry, first_enrichment_run_id, decision_use
FROM incoming_osm_ads
ON CONFLICT (source_id, artifact_sha256, osm_type, osm_id) DO NOTHING;

WITH approved_site_coordinates AS (
  SELECT
    c.site_id,
    c.assertion_id,
    c.latitude,
    c.longitude
  FROM ooh_data.site_coordinate_assertions c
  JOIN ooh_data.site_entities s ON s.site_id=c.site_id AND s.identity_status='confirmed'
  WHERE c.assertion_status='approved'
    AND c.renderer_eligibility='maplibre'
),
proximity AS (
  SELECT
    a.source_id,
    a.artifact_sha256,
    a.osm_type,
    a.osm_id,
    s.site_id,
    s.assertion_id AS site_coordinate_assertion_id,
    a.representative_method,
    2 * 6371008.8 * asin(
      least(1.0, sqrt(
        power(sin(radians(a.latitude - s.latitude) / 2), 2)
        + cos(radians(s.latitude)) * cos(radians(a.latitude))
          * power(sin(radians(a.longitude - s.longitude) / 2), 2)
      ))
    ) AS distance_m
  FROM incoming_osm_ads a
  CROSS JOIN approved_site_coordinates s
  WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
    AND abs(a.latitude - s.latitude) <= 0.003
    AND abs(a.longitude - s.longitude) <= 0.003
),
nearest AS (
  SELECT *, row_number() OVER (
    PARTITION BY source_id, artifact_sha256, osm_type, osm_id, site_id
    ORDER BY distance_m, site_coordinate_assertion_id
  ) AS rank
  FROM proximity
  WHERE distance_m <= 250
)
INSERT INTO ooh_data.site_open_candidate_matches (
  source_id, artifact_sha256, osm_type, osm_id, site_id, match_method, distance_m,
  match_status, evidence, first_enrichment_run_id, last_enrichment_run_id, decision_use
)
SELECT
  source_id, artifact_sha256, osm_type, osm_id, site_id,
  'approved_coordinate_proximity', distance_m, 'candidate',
  jsonb_build_object(
    'siteCoordinateAssertionId', site_coordinate_assertion_id,
    'candidateRepresentativeMethod', representative_method,
    'distancePolicyM', 250,
    'semantics', 'candidate_link_only_not_site_identity_or_owner_confirmation'
  ),
  ${sqlLiteral(runId)}::uuid, ${sqlLiteral(runId)}::uuid, 'context_only'
FROM nearest
WHERE rank=1
ON CONFLICT (source_id, artifact_sha256, osm_type, osm_id, site_id) DO UPDATE SET
  distance_m=EXCLUDED.distance_m,
  evidence=EXCLUDED.evidence,
  last_enrichment_run_id=EXCLUDED.last_enrichment_run_id;
COMMIT;
`);
    await session.finish();
  } catch (error) {
    try { await session.write("ROLLBACK;\n"); } catch { /* session may be closed */ }
    try { await session.finish(); } catch { /* preserve original error */ }
    throw error;
  }
  const matchResult = await runPsql(databaseUrl, `
SELECT count(*) FROM ooh_data.site_open_candidate_matches
WHERE source_id=${sqlLiteral(registration.sourceId)} AND artifact_sha256=${sqlLiteral(registration.sha256)};
`, { tuplesOnly: true });
  return { osmAdvertisingCandidates: rows.length, siteCandidateLinks: Number(matchResult.stdout.trim()) || 0 };
}

export async function importOpenEnrichment(): Promise<{
  runId: string;
  sourceId: string;
  artifactSha256: string;
  counts: Record<string, number>;
}> {
  const databaseUrl = requiredDatabaseUrl();
  const sourceId = requiredArg("source");
  const inputPath = resolve(requiredArg("input"));
  const sourceRelease = requiredArg("release");
  const accessUri = validateRetentionUri(requiredArg("access-uri"), "enrichment_access");
  const storageUri = validateRetentionUri(requiredArg("storage-uri"), "enrichment_storage");
  const retrievedAt = arg("retrieved-at")?.trim() || new Date().toISOString();
  const file = await readFile(inputPath);
  const fileStat = await stat(inputPath);
  const sha256 = createHash("sha256").update(file).digest("hex");
  const licenseOverride = await loadLicenseOverride();
  const registration = buildArtifactRegistration({
    sourceId,
    sourceRelease,
    fileName: basename(inputPath),
    contentType: arg("content-type")?.trim() || defaultContentType(sourceId),
    byteSize: fileStat.size,
    sha256,
    accessUri,
    storageUri,
    retrievedAt,
    metadata: {
      inputEncoding: "utf-8",
      featureLicensePreserved: arg("feature-license-preserved") === "true",
    },
    licenseOverride,
  });
  const version = adapterVersion(sourceId);
  await migrateDatabase();
  const runId = randomUUID();
  await registerArtifactAndRun(databaseUrl, registration, runId, version);

  try {
    const text = file.toString("utf8");
    let counts: Record<string, number>;
    if (sourceId === "ourairports-airports") {
      counts = await importOurAirports(databaseUrl, registration, runId, parseOurAirportsCsv(text, "NG"));
    } else if (sourceId === "osm-geofabrik-nigeria") {
      counts = await importOsmAdvertising(databaseUrl, registration, runId, parseOsmAdvertisingGeoJsonSequence(text));
    } else {
      throw new Error(`ENRICHMENT_ADAPTER_NOT_IMPLEMENTED:${sourceId}`);
    }
    await finishRun(databaseUrl, runId, counts);
    return { runId, sourceId, artifactSha256: registration.sha256, counts };
  } catch (error) {
    try { await markRunFailed(databaseUrl, runId, error); } catch { /* preserve import failure */ }
    throw error;
  }
}

if (process.argv[1]?.endsWith("import-open-enrichment.ts")) {
  importOpenEnrichment()
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + "\n"))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`enrichment:import failed: ${message}\n`);
      process.exitCode = 1;
    });
}
