import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { migrateDatabase } from "./db-migrate";
import { runPsql } from "./data/psql";
import { sqlLiteral } from "./data/persistenceFormat";

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

function sha(value: string, label: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`INVALID_${label}_SHA256`);
  return value;
}

async function transformParameters(): Promise<Record<string, unknown>> {
  const path = arg("parameters-json");
  if (!path) return {};
  return JSON.parse(await readFile(resolve(path), "utf8")) as Record<string, unknown>;
}

export async function linkEnrichmentArtifactDerivation(): Promise<void> {
  const databaseUrl = requiredDatabaseUrl();
  const childSource = requiredArg("child-source");
  const childSha = sha(requiredArg("child-sha"), "CHILD");
  const parentSource = requiredArg("parent-source");
  const parentSha = sha(requiredArg("parent-sha"), "PARENT");
  const transformId = requiredArg("transform-id");
  const transformVersion = requiredArg("transform-version");
  const parameters = await transformParameters();
  await migrateDatabase();

  await runPsql(databaseUrl, `
\\set ON_ERROR_STOP on
BEGIN;
INSERT INTO ooh_data.enrichment_artifact_derivations (
  child_source_id, child_artifact_sha256, parent_source_id, parent_artifact_sha256,
  transform_id, transform_version, transform_parameters
) VALUES (
  ${sqlLiteral(childSource)}, ${sqlLiteral(childSha)},
  ${sqlLiteral(parentSource)}, ${sqlLiteral(parentSha)},
  ${sqlLiteral(transformId)}, ${sqlLiteral(transformVersion)},
  ${sqlLiteral(JSON.stringify(parameters))}::jsonb
)
ON CONFLICT (child_source_id, child_artifact_sha256, parent_source_id, parent_artifact_sha256)
DO NOTHING;

DO $derivation_guard$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM ooh_data.enrichment_artifact_derivations d
  WHERE d.child_source_id=${sqlLiteral(childSource)}
    AND d.child_artifact_sha256=${sqlLiteral(childSha)}
    AND d.parent_source_id=${sqlLiteral(parentSource)}
    AND d.parent_artifact_sha256=${sqlLiteral(parentSha)}
    AND (
      d.transform_id IS DISTINCT FROM ${sqlLiteral(transformId)}
      OR d.transform_version IS DISTINCT FROM ${sqlLiteral(transformVersion)}
      OR d.transform_parameters IS DISTINCT FROM ${sqlLiteral(JSON.stringify(parameters))}::jsonb
    );
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'ENRICHMENT_DERIVATION_METADATA_DRIFT';
  END IF;
END;
$derivation_guard$;
COMMIT;
`);
}

linkEnrichmentArtifactDerivation()
  .then(() => process.stdout.write("{\"ok\":true}\n"))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`enrichment:link failed: ${message}\n`);
    process.exitCode = 1;
  });
