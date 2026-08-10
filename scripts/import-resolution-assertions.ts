import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { migrateDatabase } from "./db-migrate";
import { rebuildEntityResolution } from "./rebuild-entity-resolution";
import { copyStart, copyTextRow, sqlLiteral } from "./data/persistenceFormat";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";
import {
  ENTITY_RESOLVER_VERSION,
} from "../src/dataResolution/normalize";
import {
  validateAirportOverride,
  validateCoordinateAssertion,
  validateMediaOwnerAssertion,
  type ValidAirportOverride,
  type ValidCoordinateAssertion,
  type ValidMediaOwnerAssertion,
} from "../src/dataResolution/assertions";
import {
  validateSiteIdentityDecision,
  type ValidSiteIdentityDecision,
} from "../src/dataResolution/siteDecision";

type AssertionInput =
  | ({ kind: "coordinate" } & Record<string, unknown>)
  | ({ kind: "media_owner" } & Record<string, unknown>)
  | ({ kind: "airport_override" } & Record<string, unknown>)
  | ({ kind: "site_identity" } & Record<string, unknown>);

type AssertionImport = {
  coordinates: ValidCoordinateAssertion[];
  mediaOwners: ValidMediaOwnerAssertion[];
  airportOverrides: ValidAirportOverride[];
  siteDecisions: ValidSiteIdentityDecision[];
};

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function inputPath(): string {
  const explicit = process.argv.find((arg) => arg.startsWith("--input="))?.slice("--input=".length);
  if (!explicit?.trim()) throw new Error("ASSERTION_INPUT_REQUIRED:use --input=/path/to/assertions.ndjson");
  return resolve(explicit);
}

async function readAssertions(path: string): Promise<AssertionImport> {
  const result: AssertionImport = {
    coordinates: [],
    mediaOwners: [],
    airportOverrides: [],
    siteDecisions: [],
  };
  const seenSiteDecision = new Set<string>();
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let raw: AssertionInput;
    try {
      raw = JSON.parse(line) as AssertionInput;
    } catch {
      throw new Error(`INVALID_ASSERTION_JSON:${lineNumber}`);
    }
    try {
      const { kind, ...payload } = raw;
      if (kind === "coordinate") {
        result.coordinates.push(validateCoordinateAssertion(payload));
      } else if (kind === "media_owner") {
        result.mediaOwners.push(validateMediaOwnerAssertion(payload));
      } else if (kind === "airport_override") {
        result.airportOverrides.push(validateAirportOverride(payload));
      } else if (kind === "site_identity") {
        const decision = validateSiteIdentityDecision(payload);
        if (seenSiteDecision.has(decision.siteId)) {
          throw new Error(`DUPLICATE_SITE_DECISION_IN_IMPORT:${decision.siteId}`);
        }
        seenSiteDecision.add(decision.siteId);
        result.siteDecisions.push(decision);
      } else {
        throw new Error(`UNKNOWN_ASSERTION_KIND:${String(kind)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`INVALID_ASSERTION:${lineNumber}:${message}`);
    }
  }
  return result;
}

async function writeRows(
  session: PsqlSession,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.write(copyStart(table, columns));
  try {
    for (const row of rows) await session.write(copyTextRow(row));
  } catch (error) {
    await session.write("\\.\n");
    throw error;
  }
  await session.write("\\.\n");
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = detail.split(":")[0] || "ASSERTION_IMPORT_FAILED";
  await runPsql(databaseUrl, `
UPDATE ooh_data.resolution_runs
SET status = 'failed', completed_at = now(),
    error_code = ${sqlLiteral(code)}, error_detail = ${sqlLiteral(detail)}
WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';
`);
}

async function importAssertions(): Promise<{
  runId: string;
  counts: Record<string, number>;
  rebuildRunId: string | null;
}> {
  const databaseUrl = requiredDatabaseUrl();
  const assertions = await readAssertions(inputPath());
  await migrateDatabase();
  const runId = randomUUID();
  const counts = {
    coordinates: assertions.coordinates.length,
    mediaOwners: assertions.mediaOwners.length,
    airportOverrides: assertions.airportOverrides.length,
    siteDecisions: assertions.siteDecisions.length,
  };
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.resolution_runs (run_id, resolver_version, run_kind, status, counts)
VALUES (
  ${sqlLiteral(runId)}::uuid,
  ${sqlLiteral(ENTITY_RESOLVER_VERSION)},
  'assertion_import',
  'running',
  ${sqlLiteral(JSON.stringify(counts))}::jsonb
);
`);

  const session = startPsql(databaseUrl);
  let transactionOpen = false;
  try {
    await session.write(
      "\\set ON_ERROR_STOP on\nBEGIN;\n" +
      "CREATE TEMP TABLE assertion_coordinates (LIKE ooh_data.site_coordinate_assertions INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
      "CREATE TEMP TABLE assertion_owners (LIKE ooh_data.media_owner_entities INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
      "CREATE TEMP TABLE assertion_owner_aliases (LIKE ooh_data.media_owner_aliases INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
      "CREATE TEMP TABLE assertion_site_owners (LIKE ooh_data.site_media_owner_assertions INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
      "CREATE TEMP TABLE assertion_airport_aliases (LIKE ooh_data.airport_aliases INCLUDING DEFAULTS) ON COMMIT DROP;\n" +
      "CREATE TEMP TABLE assertion_site_decisions (LIKE ooh_data.site_identity_decisions INCLUDING DEFAULTS) ON COMMIT DROP;\n",
    );
    transactionOpen = true;

    await writeRows(
      session,
      "assertion_coordinates",
      [
        "assertion_id", "site_id", "latitude", "longitude", "coordinate_accuracy_m",
        "source_kind", "coordinate_source_id", "source_artifact_id", "spatial_rights",
        "spatial_license_id", "assertion_status", "renderer_eligibility", "planning_use",
        "enrichment_revision",
      ],
      assertions.coordinates.map((row) => [
        row.assertionId,
        row.siteId,
        row.latitude,
        row.longitude,
        row.coordinateAccuracyM,
        row.sourceKind,
        row.coordinateSourceId,
        row.sourceArtifactId,
        row.spatialRights,
        row.spatialLicenseId,
        row.assertionStatus,
        row.rendererEligibility,
        row.planningUse,
        row.enrichmentRevision,
      ]),
    );

    await writeRows(
      session,
      "assertion_owners",
      ["owner_id", "canonical_name", "normalized_key", "registry_namespace", "registry_revision"],
      assertions.mediaOwners.map((row) => [
        row.ownerId,
        row.canonicalName,
        row.normalizedKey,
        row.registryNamespace,
        row.registryRevision,
      ]),
    );
    await writeRows(
      session,
      "assertion_owner_aliases",
      [
        "alias_id", "owner_id", "source_literal", "normalized_key",
        "evidence_source_id", "evidence_revision",
      ],
      assertions.mediaOwners.map((row) => [
        row.aliasId,
        row.ownerId,
        row.sourceLiteral,
        row.normalizedKey,
        row.evidenceSourceId,
        row.evidenceRevision,
      ]),
    );
    await writeRows(
      session,
      "assertion_site_owners",
      [
        "assertion_id", "site_id", "owner_id", "assertion_status", "mapping_method",
        "evidence_source_id", "evidence_revision",
      ],
      assertions.mediaOwners.map((row) => [
        row.assertionId,
        row.siteId,
        row.ownerId,
        row.assertionStatus,
        row.mappingMethod,
        row.evidenceSourceId,
        row.evidenceRevision,
      ]),
    );

    await writeRows(
      session,
      "assertion_airport_aliases",
      [
        "alias_id", "airport_id", "source_literal", "normalized_key", "alias_kind",
        "mapping_method", "resolver_version", "observation_count", "evidence_source_id",
        "evidence_revision", "first_resolution_run_id", "last_resolution_run_id",
      ],
      assertions.airportOverrides.map((row) => [
        row.aliasId,
        row.targetAirportId,
        row.sourceLiteral,
        row.normalizedKey,
        "manual",
        "manual_review",
        ENTITY_RESOLVER_VERSION,
        0,
        row.evidenceSourceId,
        row.evidenceRevision,
        runId,
        runId,
      ]),
    );

    await writeRows(
      session,
      "assertion_site_decisions",
      [
        "decision_id", "site_id", "decision_status", "decision_method",
        "evidence_source_id", "evidence_revision",
      ],
      assertions.siteDecisions.map((row) => [
        row.decisionId,
        row.siteId,
        row.decisionStatus,
        row.decisionMethod,
        row.evidenceSourceId,
        row.evidenceRevision,
      ]),
    );

    await session.write(`
INSERT INTO ooh_data.site_coordinate_assertions (
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m,
  source_kind, coordinate_source_id, source_artifact_id, spatial_rights,
  spatial_license_id, assertion_status, renderer_eligibility, planning_use,
  enrichment_revision
)
SELECT
  assertion_id, site_id, latitude, longitude, coordinate_accuracy_m,
  source_kind, coordinate_source_id, source_artifact_id, spatial_rights,
  spatial_license_id, assertion_status, renderer_eligibility, planning_use,
  enrichment_revision
FROM assertion_coordinates
ON CONFLICT (assertion_id) DO NOTHING;

INSERT INTO ooh_data.media_owner_entities (
  owner_id, canonical_name, normalized_key, registry_namespace, registry_revision
)
SELECT DISTINCT ON (owner_id)
  owner_id, canonical_name, normalized_key, registry_namespace, registry_revision
FROM assertion_owners
ORDER BY owner_id, canonical_name
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO ooh_data.media_owner_aliases (
  alias_id, owner_id, source_literal, normalized_key, evidence_source_id, evidence_revision
)
SELECT alias_id, owner_id, source_literal, normalized_key, evidence_source_id, evidence_revision
FROM assertion_owner_aliases
ON CONFLICT (alias_id) DO NOTHING;

INSERT INTO ooh_data.site_media_owner_assertions (
  assertion_id, site_id, owner_id, assertion_status, mapping_method,
  evidence_source_id, evidence_revision
)
SELECT
  assertion_id, site_id, owner_id, assertion_status, mapping_method,
  evidence_source_id, evidence_revision
FROM assertion_site_owners
ON CONFLICT (assertion_id) DO NOTHING;

INSERT INTO ooh_data.airport_aliases (
  alias_id, airport_id, source_literal, normalized_key, alias_kind,
  mapping_method, resolver_version, observation_count, evidence_source_id,
  evidence_revision, first_resolution_run_id, last_resolution_run_id
)
SELECT
  alias_id, airport_id, source_literal, normalized_key, alias_kind,
  mapping_method, resolver_version, observation_count, evidence_source_id,
  evidence_revision, first_resolution_run_id, last_resolution_run_id
FROM assertion_airport_aliases
ON CONFLICT (alias_id) DO NOTHING;

INSERT INTO ooh_data.site_identity_decisions (
  decision_id, site_id, decision_status, decision_method,
  evidence_source_id, evidence_revision
)
SELECT
  decision_id, site_id, decision_status, decision_method,
  evidence_source_id, evidence_revision
FROM assertion_site_decisions
ON CONFLICT (decision_id) DO NOTHING;

UPDATE ooh_data.site_entities s
SET identity_status = d.decision_status
FROM assertion_site_decisions d
WHERE d.site_id = s.site_id;

UPDATE ooh_data.resolution_runs
SET status = 'succeeded', completed_at = now()
WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';
COMMIT;
`);
    transactionOpen = false;
    await session.finish();
  } catch (error) {
    if (transactionOpen) {
      try {
        await session.write("ROLLBACK;\n");
      } catch {
        // psql may already be closed after a database constraint error.
      }
    }
    try {
      await session.finish();
    } catch {
      // Preserve the import error and record it with a fresh session below.
    }
    try {
      await markFailed(databaseUrl, runId, error);
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : String(auditError);
      process.stderr.write(`data:assert failure-audit warning: ${message}\n`);
    }
    throw error;
  }

  let rebuildRunId: string | null = null;
  if (assertions.airportOverrides.length > 0) {
    const rebuild = await rebuildEntityResolution();
    rebuildRunId = rebuild.runId;
  }
  return { runId, counts, rebuildRunId };
}

importAssertions()
  .then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`data:assert failed: ${message}\n`);
    process.exitCode = 1;
  });
