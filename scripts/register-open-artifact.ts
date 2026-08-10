import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { migrateDatabase } from "./db-migrate";
import { runPsql } from "./data/psql";
import { sqlLiteral, validateRetentionUri } from "./data/persistenceFormat";
import {
  buildArtifactRegistration,
  type ArtifactLicenseOverride,
} from "../src/enrichment/artifactContract";

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

async function loadLicenseOverride(): Promise<ArtifactLicenseOverride | undefined> {
  const path = arg("license-review-json");
  if (!path) return undefined;
  return JSON.parse(await readFile(resolve(path), "utf8")) as ArtifactLicenseOverride;
}

export async function registerOpenArtifact(): Promise<{
  sourceId: string;
  artifactSha256: string;
  byteSize: number;
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
  const registration = buildArtifactRegistration({
    sourceId,
    sourceRelease,
    fileName: basename(inputPath),
    contentType: arg("content-type")?.trim() || "application/octet-stream",
    byteSize: fileStat.size,
    sha256,
    accessUri,
    storageUri,
    retrievedAt,
    metadata: {
      artifactKind: arg("artifact-kind")?.trim() || "raw_source",
      featureLicensePreserved: arg("feature-license-preserved") === "true",
    },
    licenseOverride: await loadLicenseOverride(),
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

DO $artifact_guard$
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
      OR a.byte_size IS DISTINCT FROM ${registration.byteSize}
      OR a.license_id IS DISTINCT FROM ${sqlLiteral(registration.licenseId)}
      OR a.attribution_text IS DISTINCT FROM ${sqlLiteral(registration.attributionText)}
      OR a.share_alike IS DISTINCT FROM ${registration.shareAlike ? "true" : "false"}
      OR a.commercial_use_status IS DISTINCT FROM ${sqlLiteral(registration.commercialUseStatus)}
    );
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'ENRICHMENT_ARTIFACT_METADATA_DRIFT';
  END IF;
END;
$artifact_guard$;
COMMIT;
`);

  return { sourceId: registration.sourceId, artifactSha256: registration.sha256, byteSize: registration.byteSize };
}

registerOpenArtifact()
  .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + "\n"))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`enrichment:register failed: ${message}\n`);
    process.exitCode = 1;
  });
