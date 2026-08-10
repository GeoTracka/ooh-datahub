import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawn } from "node:child_process";
import { migrateDatabase } from "./db-migrate";
import { runPsql } from "./data/psql";
import { sqlLiteral, validateRetentionUri } from "./data/persistenceFormat";
import { buildArtifactRegistration } from "../src/enrichment/artifactContract";
import {
  GRID3_RASTER_WORKER_VERSION,
  grid3RasterGridSignature,
  productContractForRole,
  validateGrid3RasterInspection,
  type Grid3RasterRole,
  type RasterInspection,
} from "../src/enrichment/grid3Raster";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function requiredArg(name: string): string {
  const value = arg(name)?.trim();
  if (!value) throw new Error(`GRID3_RASTER_ARGUMENT_REQUIRED:${name}`);
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

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function inspectRaster(path: string): Promise<RasterInspection> {
  const python = process.env.PYTHON_BIN?.trim() || "python3";
  const worker = resolve("scripts/enrichment/grid3_accessibility.py");
  return await new Promise<RasterInspection>((resolvePromise, reject) => {
    const child = spawn(python, [worker, "inspect", `--input=${path}`], {
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
      if (code !== 0) {
        reject(new Error(`GRID3_RASTER_INSPECTION_FAILED:${code}:${stderr.trim().slice(-4000)}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim()) as RasterInspection);
      } catch {
        reject(new Error("GRID3_RASTER_INSPECTION_JSON_INVALID"));
      }
    });
  });
}

export async function registerGrid3Raster(): Promise<{
  sourceId: string;
  role: Grid3RasterRole;
  artifactSha256: string;
  gridSignature: string;
  raster: RasterInspection;
}> {
  const databaseUrl = requiredDatabaseUrl();
  const role = requiredArg("role") as Grid3RasterRole;
  const contract = productContractForRole(role);
  const inputPath = resolve(requiredArg("input"));
  const sourceRelease = requiredArg("release");
  const accessUri = validateRetentionUri(requiredArg("access-uri"), "enrichment_access");
  const storageUri = validateRetentionUri(requiredArg("storage-uri"), "enrichment_storage");
  const retrievedAt = arg("retrieved-at")?.trim() || new Date().toISOString();
  const fileStat = await stat(inputPath);
  if (!fileStat.isFile()) throw new Error("GRID3_RASTER_INPUT_NOT_FILE");

  const [sha256, raster] = await Promise.all([sha256File(inputPath), inspectRaster(inputPath)]);
  validateGrid3RasterInspection(role, raster);
  if (raster.workerVersion !== GRID3_RASTER_WORKER_VERSION) {
    throw new Error(`GRID3_RASTER_WORKER_VERSION_MISMATCH:${raster.workerVersion}`);
  }
  const gridSignature = grid3RasterGridSignature(raster);
  const registration = buildArtifactRegistration({
    sourceId: contract.sourceId,
    sourceRelease,
    fileName: basename(inputPath),
    contentType: "image/tiff; application=geotiff",
    byteSize: fileStat.size,
    sha256,
    accessUri,
    storageUri,
    retrievedAt,
    metadata: {
      artifactKind: "grid3_raster",
      grid3ProductRole: role,
      productVersion: contract.productVersion,
      productCitation: contract.productCitation,
      knownLimitations: contract.knownLimitations,
      unitSemantic: contract.unitSemantic,
      raster,
      gridSignature,
      workerVersion: GRID3_RASTER_WORKER_VERSION,
    },
    licenseOverride: contract.licenseOverride,
  });

  await migrateDatabase();
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
  ${json(registration.metadata)}
)
ON CONFLICT (source_id, artifact_sha256) DO NOTHING;

DO $grid3_artifact_guard$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM ooh_data.enrichment_artifacts a
  WHERE a.source_id=${sqlLiteral(registration.sourceId)}
    AND a.artifact_sha256=${sqlLiteral(registration.sha256)}
    AND (
      a.source_release IS DISTINCT FROM ${sqlLiteral(registration.sourceRelease)}
      OR a.file_name IS DISTINCT FROM ${sqlLiteral(registration.fileName)}
      OR a.content_type IS DISTINCT FROM ${sqlLiteral(registration.contentType)}
      OR a.byte_size IS DISTINCT FROM ${registration.byteSize}
      OR a.license_id IS DISTINCT FROM ${sqlLiteral(registration.licenseId)}
      OR a.attribution_text IS DISTINCT FROM ${sqlLiteral(registration.attributionText)}
      OR a.share_alike IS DISTINCT FROM ${registration.shareAlike ? "true" : "false"}
      OR a.commercial_use_status IS DISTINCT FROM ${sqlLiteral(registration.commercialUseStatus)}
      OR a.metadata IS DISTINCT FROM ${json(registration.metadata)}
    );
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'GRID3_RASTER_ARTIFACT_METADATA_DRIFT';
  END IF;
END;
$grid3_artifact_guard$;
COMMIT;
`);

  return {
    sourceId: registration.sourceId,
    role,
    artifactSha256: registration.sha256,
    gridSignature,
    raster,
  };
}

registerGrid3Raster()
  .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`enrichment:register:grid3-raster failed: ${message}\n`);
    process.exitCode = 1;
  });
