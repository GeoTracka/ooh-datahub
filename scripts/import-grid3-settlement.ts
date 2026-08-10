import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename, resolve } from "node:path";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { canonicalJson } from "../src/shared/canonicalJson";
import {
  GRID3_SETTLEMENT_ADAPTER_VERSION,
  GRID3_SETTLEMENT_PRODUCT_VERSION,
  GRID3_SETTLEMENT_SOURCE_ID,
  assertGrid3SettlementFieldMapAgainstInspection,
  grid3SettlementFieldMapFingerprint,
  normalizeGrid3SettlementFieldMap,
  validateGrid3SettlementInspection,
} from "../src/enrichment/grid3Settlement";
import { migrateDatabase } from "./db-migrate";
import { copyStart, copyTextRow, sqlLiteral, validateRetentionUri } from "./data/persistenceFormat";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredArg(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`GRID3_SETTLEMENT_ARGUMENT_REQUIRED:${name}`);
  return value;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function booleanArg(name: string): boolean {
  const value = requiredArg(name).toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`GRID3_SETTLEMENT_BOOLEAN_ARGUMENT_INVALID:${name}`);
}

function parseBbox(raw: string): [number, number, number, number] {
  const parts = raw.split(",").map((value) => Number(value.trim()));
  if (
    parts.length !== 4
    || parts.some((value) => !Number.isFinite(value))
    || parts[0] < -180 || parts[2] > 180
    || parts[1] < -90 || parts[3] > 90
    || parts[0] >= parts[2] || parts[1] >= parts[3]
  ) {
    throw new Error("GRID3_SETTLEMENT_COVERAGE_BBOX_INVALID");
  }
  return parts as [number, number, number, number];
}

function inspectedBounds(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error("GRID3_SETTLEMENT_INSPECTED_BOUNDS_INVALID");
  }
  const values = value.map(Number);
  if (values.some((item) => !Number.isFinite(item))) {
    throw new Error("GRID3_SETTLEMENT_INSPECTED_BOUNDS_INVALID");
  }
  return values as [number, number, number, number];
}

function assertCoverageContainsFeatures(
  coverage: readonly number[],
  features: readonly number[],
): void {
  const tolerance = 1e-9;
  if (
    coverage[0] > features[0] + tolerance
    || coverage[1] > features[1] + tolerance
    || coverage[2] < features[2] - tolerance
    || coverage[3] < features[3] - tolerance
  ) {
    throw new Error("GRID3_SETTLEMENT_COVERAGE_BBOX_EXCLUDES_FEATURES");
  }
}

async function sha256File(path: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
}

function workerArgs(
  command: "inspect" | "export",
  inputPath: string,
  layer: string | null,
  fieldMapPath?: string,
): string[] {
  const args = [resolve("scripts/enrichment/grid3_settlement.py"), command, `--input=${inputPath}`];
  if (layer) args.push(`--layer=${layer}`);
  if (fieldMapPath) args.push(`--field-map=${fieldMapPath}`);
  return args;
}

function runWorkerJson(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `GRID3_SETTLEMENT_WORKER_FAILED:${code}`));
      try {
        resolvePromise(JSON.parse(stdout) as Record<string, unknown>);
      } catch {
        reject(new Error("GRID3_SETTLEMENT_WORKER_JSON_INVALID"));
      }
    });
  });
}

async function writeSettlementRows(
  session: PsqlSession,
  inputPath: string,
  layer: string | null,
  fieldMapPath: string,
  artifactSha256: string,
  runId: string,
): Promise<{ features: number; repaired: number }> {
  await session.write(copyStart("incoming_grid3_settlements", [
    "source_id", "artifact_sha256", "feature_id", "source_feature_id",
    "original_geometry_valid", "geometry_repaired", "building_count", "building_density",
    "degree_urbanisation", "population_estimate", "false_positive_probability", "place_code",
    "raw_properties", "geometry_json", "record_fingerprint", "first_enrichment_run_id", "decision_use",
  ]));

  const child = spawn("python3", workerArgs("export", inputPath, layer, fieldMapPath), {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exitPromise = new Promise<number | null>((resolvePromise, reject) => {
    child.on("error", reject);
    child.on("close", resolvePromise);
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let features = 0;
  let repaired = 0;

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as Record<string, unknown>;
      const fingerprintPayload = {
        featureId: record.featureId,
        sourceFeatureId: record.sourceFeatureId,
        originalGeometryValid: record.originalGeometryValid,
        geometryRepaired: record.geometryRepaired,
        buildingCount: record.buildingCount ?? null,
        buildingDensity: record.buildingDensity ?? null,
        degreeUrbanisation: record.degreeUrbanisation ?? null,
        populationEstimate: record.populationEstimate ?? null,
        falsePositiveProbability: record.falsePositiveProbability ?? null,
        placeCode: record.placeCode ?? null,
        rawProperties: record.rawProperties,
        geometry: record.geometry,
      };
      const recordFingerprint = createHash("sha256")
        .update(canonicalJson(fingerprintPayload), "utf8")
        .digest("hex");
      await session.write(copyTextRow([
        GRID3_SETTLEMENT_SOURCE_ID,
        artifactSha256,
        record.featureId,
        record.sourceFeatureId,
        record.originalGeometryValid,
        record.geometryRepaired,
        record.buildingCount ?? null,
        record.buildingDensity ?? null,
        record.degreeUrbanisation ?? null,
        record.populationEstimate ?? null,
        record.falsePositiveProbability ?? null,
        record.placeCode ?? null,
        record.rawProperties,
        JSON.stringify(record.geometry),
        recordFingerprint,
        runId,
        "context_only",
      ]));
      features += 1;
      if (record.geometryRepaired === true) repaired += 1;
    }
  } catch (error) {
    child.kill();
    try { await session.write("\\.\n"); } catch { /* preserve parser error */ }
    throw error;
  }

  await session.write("\\.\n");
  const exitCode = await exitPromise;
  if (exitCode !== 0) throw new Error(stderr.trim() || `GRID3_SETTLEMENT_WORKER_FAILED:${exitCode}`);
  return { features, repaired };
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = (detail.split(":")[0] || "GRID3_SETTLEMENT_IMPORT_FAILED").slice(0, 128);
  await runPsql(databaseUrl, `
UPDATE ooh_data.enrichment_runs
SET status='failed', completed_at=now(), error_code=${sqlLiteral(code)}, error_detail=${sqlLiteral(detail)}
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
}

export async function importGrid3Settlement(): Promise<Record<string, unknown>> {
  const databaseUrl = requiredDatabaseUrl();
  const inputPath = resolve(requiredArg("input"));
  const layer = arg("layer")?.trim() || null;
  const sourceRelease = requiredArg("release");
  if (!sourceRelease.includes(GRID3_SETTLEMENT_PRODUCT_VERSION)) {
    throw new Error("GRID3_SETTLEMENT_RELEASE_MUST_IDENTIFY_V4_1");
  }

  const accessUri = validateRetentionUri(requiredArg("access-uri"), "grid3_settlement_access");
  const storageUri = validateRetentionUri(requiredArg("storage-uri"), "grid3_settlement_storage");
  const retrievedAt = arg("retrieved-at")?.trim() || new Date().toISOString();
  const retrievedDate = new Date(retrievedAt);
  if (!Number.isFinite(retrievedDate.getTime())) throw new Error("GRID3_SETTLEMENT_RETRIEVED_AT_INVALID");

  const coverageBoundsWgs84 = parseBbox(requiredArg("coverage-bbox"));
  const coverageReference = requiredArg("coverage-reference");
  const licenseId = requiredArg("license-id");
  const attributionText = requiredArg("attribution");
  const shareAlike = booleanArg("share-alike");
  const licenseReviewedAt = requiredArg("license-reviewed-at");
  const licenseReviewReference = requiredArg("license-review-reference");
  const limitations = requiredArg("limitations");
  if (/REVIEW|UNKNOWN/iu.test(licenseId)) throw new Error("GRID3_SETTLEMENT_EXACT_LICENSE_REQUIRED");

  const fieldMapPath = arg("field-map") ? resolve(requiredArg("field-map")) : null;
  const fieldMap = normalizeGrid3SettlementFieldMap(
    fieldMapPath ? JSON.parse(await readFile(fieldMapPath, "utf8")) : { featureId: "$fid" },
  );
  const effectiveFieldMapPath = fieldMapPath
    ?? resolve(process.cwd(), `.grid3-settlement-field-map-${process.pid}.json`);
  if (!fieldMapPath) await writeFile(effectiveFieldMapPath, JSON.stringify(fieldMap), "utf8");

  try {
    const inspection = await runWorkerJson(workerArgs("inspect", inputPath, layer));
    validateGrid3SettlementInspection(inspection);
    assertGrid3SettlementFieldMapAgainstInspection(fieldMap, inspection.fields as readonly unknown[]);
    const featureBoundsWgs84 = inspectedBounds(inspection.boundsWgs84);
    assertCoverageContainsFeatures(coverageBoundsWgs84, featureBoundsWgs84);

    const fieldMapFingerprint = grid3SettlementFieldMapFingerprint(fieldMap);
    const fileStat = await stat(inputPath);
    const artifactSha256 = await sha256File(inputPath);
    const runId = randomUUID();
    const metadata = {
      grid3ProductRole: "settlement_extents",
      productVersion: GRID3_SETTLEMENT_PRODUCT_VERSION,
      productCatalogUpdated: "2026-08",
      fieldMap,
      fieldMapFingerprint,
      inspection,
      featureBoundsWgs84,
      coverageBoundsWgs84,
      coverageBasis: "declared_coverage_bbox",
      coverageReference,
      geometryRepairPolicy: "ogr_make_valid_then_polygonal_only_v1",
      rawArtifactRetained: true,
      limitations,
      licenseReview: {
        reviewedAt: licenseReviewedAt,
        reviewReference: licenseReviewReference,
      },
    };

    await migrateDatabase();
    await runPsql(databaseUrl, `
\\set ON_ERROR_STOP on
BEGIN;
INSERT INTO ooh_data.enrichment_artifacts (
  source_id, artifact_sha256, source_release, file_name, content_type, byte_size,
  access_uri, storage_uri, retrieved_at, license_id, attribution_text, share_alike,
  commercial_use_status, acquisition_mode, metadata
) VALUES (
  ${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}, ${sqlLiteral(artifactSha256)}, ${sqlLiteral(sourceRelease)},
  ${sqlLiteral(basename(inputPath))}, 'application/vnd.ogc.gpkg-or-vector', ${fileStat.size},
  ${sqlLiteral(accessUri)}, ${sqlLiteral(storageUri)}, ${sqlLiteral(retrievedDate.toISOString())}::timestamptz,
  ${sqlLiteral(licenseId)}, ${sqlLiteral(attributionText)}, ${shareAlike ? "true" : "false"},
  'permitted', 'snapshot', ${sqlLiteral(JSON.stringify(metadata))}::jsonb
)
ON CONFLICT (source_id, artifact_sha256) DO NOTHING;

DO $artifact_guard$
DECLARE mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}
    AND a.artifact_sha256=${sqlLiteral(artifactSha256)}
    AND (
      a.source_release IS DISTINCT FROM ${sqlLiteral(sourceRelease)}
      OR a.byte_size IS DISTINCT FROM ${fileStat.size}
      OR a.license_id IS DISTINCT FROM ${sqlLiteral(licenseId)}
      OR a.attribution_text IS DISTINCT FROM ${sqlLiteral(attributionText)}
      OR a.share_alike IS DISTINCT FROM ${shareAlike ? "true" : "false"}
      OR a.commercial_use_status IS DISTINCT FROM 'permitted'
      OR a.metadata->>'fieldMapFingerprint' IS DISTINCT FROM ${sqlLiteral(fieldMapFingerprint)}
      OR a.metadata->>'productVersion' IS DISTINCT FROM 'v4.1'
      OR a.metadata->'coverageBoundsWgs84' IS DISTINCT FROM ${sqlLiteral(JSON.stringify(coverageBoundsWgs84))}::jsonb
      OR a.metadata->>'coverageReference' IS DISTINCT FROM ${sqlLiteral(coverageReference)}
      OR a.metadata->'licenseReview' IS DISTINCT FROM ${sqlLiteral(JSON.stringify(metadata.licenseReview))}::jsonb
    );
  IF mismatch_count > 0 THEN RAISE EXCEPTION 'GRID3_SETTLEMENT_ARTIFACT_METADATA_DRIFT'; END IF;
END;
$artifact_guard$;

INSERT INTO ooh_data.enrichment_runs (
  run_id, source_id, artifact_sha256, adapter_version, status, decision_use
) VALUES (
  ${sqlLiteral(runId)}::uuid, ${sqlLiteral(GRID3_SETTLEMENT_SOURCE_ID)}, ${sqlLiteral(artifactSha256)},
  ${sqlLiteral(GRID3_SETTLEMENT_ADAPTER_VERSION)}, 'running', 'context_only'
);
COMMIT;
`);

    try {
      const session = startPsql(databaseUrl);
      let counts: { features: number; repaired: number };
      try {
        await session.write("\\set ON_ERROR_STOP on\nBEGIN;\n");
        await session.write(`
CREATE TEMP TABLE incoming_grid3_settlements (
  source_id text, artifact_sha256 text, feature_id text, source_feature_id text,
  original_geometry_valid boolean, geometry_repaired boolean,
  building_count double precision, building_density double precision, degree_urbanisation text,
  population_estimate double precision, false_positive_probability double precision, place_code text,
  raw_properties jsonb, geometry_json text, record_fingerprint text,
  first_enrichment_run_id uuid, decision_use text
) ON COMMIT DROP;
`);
        counts = await writeSettlementRows(
          session,
          inputPath,
          layer,
          effectiveFieldMapPath,
          artifactSha256,
          runId,
        );
        await session.write(`
DO $duplicate_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM incoming_grid3_settlements GROUP BY feature_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'GRID3_SETTLEMENT_DUPLICATE_FEATURE_ID';
  END IF;
END;
$duplicate_guard$;

INSERT INTO ooh_data.grid3_settlement_features (
  source_id, artifact_sha256, feature_id, source_feature_id,
  original_geometry_valid, geometry_repaired, building_count, building_density,
  degree_urbanisation, population_estimate, false_positive_probability, place_code,
  raw_properties, geom, record_fingerprint, first_enrichment_run_id, decision_use
)
SELECT
  source_id, artifact_sha256, feature_id, source_feature_id,
  original_geometry_valid, geometry_repaired, building_count, building_density,
  degree_urbanisation, population_estimate, false_positive_probability, place_code,
  raw_properties,
  ST_Multi(ST_CollectionExtract(ST_SetSRID(ST_GeomFromGeoJSON(geometry_json), 4326), 3)),
  record_fingerprint, first_enrichment_run_id, decision_use
FROM incoming_grid3_settlements;
COMMIT;
`);
        await session.finish();
      } catch (error) {
        try { await session.write("ROLLBACK;\n"); } catch { /* session may be closed */ }
        try { await session.finish(); } catch { /* preserve original error */ }
        throw error;
      }

      const expectedFeatureCount = Number(inspection.featureCount);
      if (counts.features !== expectedFeatureCount) {
        throw new Error(`GRID3_SETTLEMENT_FEATURE_COUNT_MISMATCH:${counts.features}:${expectedFeatureCount}`);
      }
      const resultCounts = {
        features: counts.features,
        repairedGeometries: counts.repaired,
        productVersion: GRID3_SETTLEMENT_PRODUCT_VERSION,
        fieldMapFingerprint,
        mappedOptionalSemantics: Object.keys(fieldMap).filter((key) => key !== "featureId"),
      };
      await runPsql(databaseUrl, `
UPDATE ooh_data.enrichment_runs
SET status='succeeded', completed_at=now(), counts=${sqlLiteral(JSON.stringify(resultCounts))}::jsonb
WHERE run_id=${sqlLiteral(runId)}::uuid AND status='running';
`);
      return {
        runId,
        artifactSha256,
        fieldMapFingerprint,
        inspection,
        coverageBoundsWgs84,
        counts: resultCounts,
      };
    } catch (error) {
      try { await markFailed(databaseUrl, runId, error); } catch { /* preserve import failure */ }
      throw error;
    }
  } finally {
    if (!fieldMapPath) await rm(effectiveFieldMapPath, { force: true });
  }
}

if (process.argv[1]?.endsWith("import-grid3-settlement.ts")) {
  importGrid3Settlement()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`grid3-settlement:import failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
