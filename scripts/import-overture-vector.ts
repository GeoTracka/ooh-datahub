import { createHash, randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { migrateDatabase } from "./db-migrate";
import { copyStart, copyTextRow, sqlLiteral, validateRetentionUri } from "./data/persistenceFormat";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";
import { buildArtifactRegistration } from "../src/enrichment/artifactContract";
import {
  OVERTURE_VECTOR_ADAPTER_VERSION,
  parseOverturePlacesGeoJson,
  parseOvertureRoadsGeoJson,
  sourceLicenseCoverage,
} from "../src/enrichment/overture";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredArg(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`OVERTURE_ARGUMENT_REQUIRED:${name}`);
  return value;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function parseBbox(value: string): [number, number, number, number] {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (
    parts.length !== 4 || parts.some((part) => !Number.isFinite(part))
    || parts[0] < -180 || parts[2] > 180 || parts[1] < -90 || parts[3] > 90
    || parts[0] >= parts[2] || parts[1] >= parts[3]
  ) {
    throw new Error("OVERTURE_INVALID_BBOX");
  }
  return parts as [number, number, number, number];
}

async function writeRows(
  session: PsqlSession,
  table: string,
  columns: readonly string[],
  rows: Iterable<readonly unknown[]>,
): Promise<number> {
  await session.write(copyStart(table, columns));
  let count = 0;
  try {
    for (const row of rows) {
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

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = (detail.split(":")[0] || "OVERTURE_IMPORT_FAILED").slice(0, 128);
  await runPsql(databaseUrl, `
UPDATE ooh_data.enrichment_runs
SET status='failed', completed_at=now(), error_code=${sqlLiteral(code)}, error_detail=${sqlLiteral(detail)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

export async function importOvertureVector(): Promise<Record<string, unknown>> {
  const databaseUrl = requiredDatabaseUrl();
  const kind = requiredArg("kind");
  if (kind !== "places" && kind !== "roads") throw new Error(`OVERTURE_KIND_INVALID:${kind}`);
  const sourceId = kind === "places" ? "overture-places" : "overture-transportation";
  const inputPath = resolve(requiredArg("input"));
  const sourceRelease = requiredArg("release");
  if (!/^20\d{2}-\d{2}-\d{2}\.\d+$/u.test(sourceRelease)) throw new Error("OVERTURE_RELEASE_INVALID");
  const bbox = parseBbox(requiredArg("bbox"));
  const accessUri = validateRetentionUri(requiredArg("access-uri"), "overture_access");
  const storageUri = validateRetentionUri(requiredArg("storage-uri"), "overture_storage");
  const retrievedAt = arg("retrieved-at")?.trim() || new Date().toISOString();
  const file = await readFile(inputPath);
  const fileStat = await stat(inputPath);
  const artifactSha256 = createHash("sha256").update(file).digest("hex");
  const registration = buildArtifactRegistration({
    sourceId,
    sourceRelease,
    fileName: basename(inputPath),
    contentType: "application/geo+json; charset=utf-8",
    byteSize: fileStat.size,
    sha256: artifactSha256,
    accessUri,
    storageUri,
    retrievedAt,
    metadata: {
      artifactKind: "retained_bbox_reduction",
      bbox,
      reductionTransform: "overture-duckdb-bbox-reduction/v1",
      featureLicensePreserved: true,
      replayBoundary: "retained_reduced_artifact_plus_pinned_release_and_bbox",
    },
  });

  await migrateDatabase();
  const runId = randomUUID();
  await runPsql(databaseUrl, `
\\set ON_ERROR_STOP on
BEGIN;
INSERT INTO ooh_data.enrichment_artifacts (
  source_id, artifact_sha256, source_release, file_name, content_type, byte_size,
  access_uri, storage_uri, retrieved_at, license_id, attribution_text, share_alike,
  commercial_use_status, acquisition_mode, metadata
) VALUES (
  ${sqlLiteral(registration.sourceId)}, ${sqlLiteral(registration.sha256)},
  ${sqlLiteral(registration.sourceRelease)}, ${sqlLiteral(registration.fileName)},
  ${sqlLiteral(registration.contentType)}, ${registration.byteSize},
  ${sqlLiteral(registration.accessUri)}, ${sqlLiteral(registration.storageUri)},
  ${sqlLiteral(registration.retrievedAt)}::timestamptz, ${sqlLiteral(registration.licenseId)},
  ${sqlLiteral(registration.attributionText)}, ${registration.shareAlike ? "true" : "false"},
  ${sqlLiteral(registration.commercialUseStatus)}, ${sqlLiteral(registration.acquisitionMode)},
  ${sqlLiteral(JSON.stringify(registration.metadata))}::jsonb
)
ON CONFLICT (source_id, artifact_sha256) DO NOTHING;

DO $artifact_guard$
DECLARE mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=${sqlLiteral(registration.sourceId)}
    AND a.artifact_sha256=${sqlLiteral(registration.sha256)}
    AND (
      a.source_release IS DISTINCT FROM ${sqlLiteral(registration.sourceRelease)}
      OR a.byte_size IS DISTINCT FROM ${registration.byteSize}
      OR a.license_id IS DISTINCT FROM ${sqlLiteral(registration.licenseId)}
      OR a.attribution_text IS DISTINCT FROM ${sqlLiteral(registration.attributionText)}
      OR a.commercial_use_status IS DISTINCT FROM 'permitted'
    );
  IF mismatch_count > 0 THEN RAISE EXCEPTION 'OVERTURE_ARTIFACT_METADATA_DRIFT'; END IF;
END;
$artifact_guard$;

INSERT INTO ooh_data.enrichment_runs (
  run_id, source_id, artifact_sha256, adapter_version, status, decision_use
) VALUES (
  ${sqlLiteral(runId)}::uuid, ${sqlLiteral(sourceId)}, ${sqlLiteral(artifactSha256)},
  ${sqlLiteral(OVERTURE_VECTOR_ADAPTER_VERSION)}, 'running', 'context_only'
);
COMMIT;
`);

  try {
    const text = file.toString("utf8");
    const session = startPsql(databaseUrl);
    let featureCount = 0;
    let licensedSourceCount = 0;
    let missingLicenseCount = 0;
    try {
      await session.write("\\set ON_ERROR_STOP on\nBEGIN;\n");
      if (kind === "places") {
        const rows = parseOverturePlacesGeoJson(text);
        for (const row of rows) {
          const coverage = sourceLicenseCoverage(row.sources);
          licensedSourceCount += coverage.licensedSourceCount;
          missingLicenseCount += coverage.missingLicenseCount;
        }
        await session.write(`
CREATE TEMP TABLE incoming_overture_places (
  source_id text, artifact_sha256 text, feature_id text, feature_version integer,
  name text, basic_category text, taxonomy jsonb, confidence double precision,
  operating_status text, sources jsonb, longitude double precision, latitude double precision,
  raw_record jsonb, first_enrichment_run_id uuid, decision_use text
) ON COMMIT DROP;
`);
        featureCount = await writeRows(
          session,
          "incoming_overture_places",
          [
            "source_id", "artifact_sha256", "feature_id", "feature_version", "name",
            "basic_category", "taxonomy", "confidence", "operating_status", "sources",
            "longitude", "latitude", "raw_record", "first_enrichment_run_id", "decision_use",
          ],
          rows.map((row) => [
            sourceId, artifactSha256, row.featureId, row.featureVersion, row.name,
            row.basicCategory, row.taxonomy, row.confidence, row.operatingStatus, row.sources,
            row.longitude, row.latitude, row.rawRecord, runId, "context_only",
          ]),
        );
        await session.write(`
INSERT INTO ooh_data.overture_place_features (
  source_id, artifact_sha256, feature_id, feature_version, name, basic_category,
  taxonomy, confidence, operating_status, sources, geog, raw_record,
  first_enrichment_run_id, decision_use
)
SELECT
  source_id, artifact_sha256, feature_id, feature_version, name, basic_category,
  taxonomy, confidence, operating_status, sources,
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
  raw_record, first_enrichment_run_id, decision_use
FROM incoming_overture_places
ON CONFLICT (source_id, artifact_sha256, feature_id) DO NOTHING;
`);
      } else {
        const rows = parseOvertureRoadsGeoJson(text);
        for (const row of rows) {
          const coverage = sourceLicenseCoverage(row.sources);
          licensedSourceCount += coverage.licensedSourceCount;
          missingLicenseCount += coverage.missingLicenseCount;
        }
        await session.write(`
CREATE TEMP TABLE incoming_overture_roads (
  source_id text, artifact_sha256 text, feature_id text, feature_version integer,
  name text, road_class text, subclass text, connectors jsonb, sources jsonb,
  geometry_json text, raw_record jsonb, first_enrichment_run_id uuid, decision_use text
) ON COMMIT DROP;
`);
        featureCount = await writeRows(
          session,
          "incoming_overture_roads",
          [
            "source_id", "artifact_sha256", "feature_id", "feature_version", "name",
            "road_class", "subclass", "connectors", "sources", "geometry_json",
            "raw_record", "first_enrichment_run_id", "decision_use",
          ],
          rows.map((row) => [
            sourceId, artifactSha256, row.featureId, row.featureVersion, row.name,
            row.roadClass, row.subclass, row.connectors, row.sources,
            JSON.stringify({ type: "LineString", coordinates: row.coordinates }),
            row.rawRecord, runId, "context_only",
          ]),
        );
        await session.write(`
INSERT INTO ooh_data.overture_road_segments (
  source_id, artifact_sha256, feature_id, feature_version, name, road_class,
  subclass, connectors, sources, geog, raw_record, first_enrichment_run_id, decision_use
)
SELECT
  source_id, artifact_sha256, feature_id, feature_version, name, road_class,
  subclass, connectors, sources,
  ST_SetSRID(ST_GeomFromGeoJSON(geometry_json), 4326)::geography,
  raw_record, first_enrichment_run_id, decision_use
FROM incoming_overture_roads
ON CONFLICT (source_id, artifact_sha256, feature_id) DO NOTHING;
`);
      }
      await session.write("COMMIT;\n");
      await session.finish();
    } catch (error) {
      try { await session.write("ROLLBACK;\n"); } catch { /* session may be closed */ }
      try { await session.finish(); } catch { /* preserve original error */ }
      throw error;
    }

    const counts = {
      kind,
      features: featureCount,
      licensedSourceItems: licensedSourceCount,
      sourceItemsMissingExplicitLicense: missingLicenseCount,
      featureLicenseProvenancePreserved: true,
    };
    await runPsql(databaseUrl, `
UPDATE ooh_data.enrichment_runs
SET status='succeeded', completed_at=now(), counts=${sqlLiteral(JSON.stringify(counts))}::jsonb
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
    return { runId, sourceId, artifactSha256, counts };
  } catch (error) {
    try { await markFailed(databaseUrl, runId, error); } catch { /* preserve import error */ }
    throw error;
  }
}

if (process.argv[1]?.endsWith("import-overture-vector.ts")) {
  importOvertureVector()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`overture:import failed: ${message}\n`);
      process.exitCode = 1;
    });
}
