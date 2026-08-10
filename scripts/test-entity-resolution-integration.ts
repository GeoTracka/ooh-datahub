import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateDatabase } from "./db-migrate";
import { runPsql } from "./data/psql";
import { sqlLiteral } from "./data/persistenceFormat";
import { rebuildEntityResolution } from "./rebuild-entity-resolution";
import {
  airportId,
  normalizeEntityLiteral,
  strictSiteIdentity,
} from "../src/dataResolution/normalize";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseUrl: string = configuredDatabaseUrl;

function json(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`COMMAND_FAILED:${command}:${code}:${stderr.trim()}`));
    });
  });
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

async function seedFixture(): Promise<void> {
  const ingestionRun = "11111111-1111-4111-8111-111111111111";
  const oohSha = "a".repeat(64);
  const faanSha = "b".repeat(64);
  await runPsql(databaseUrl, `
INSERT INTO ooh_data.source_artifact_revisions
  (source_id, sha256, drive_file_id, file_name, file_size_bytes)
VALUES
  ('fixture-ooh', '${oohSha}', 'drive-ooh', 'fixture-ooh.xlsx', 100),
  ('fixture-faan', '${faanSha}', 'drive-faan', 'fixture-faan.xlsx', 100);

INSERT INTO ooh_data.ingestion_runs (
  run_id, status, catalog_version, seed_schema_version, loader_version,
  seed_report_sha256, staging_storage_uri, completed_at
) VALUES (
  '${ingestionRun}'::uuid,
  'succeeded',
  'fixture-v1',
  1,
  'fixture-loader',
  '${"c".repeat(64)}',
  'file:///fixture/',
  now()
);

INSERT INTO ooh_data.ooh_observations (
  source_id, source_sha256, source_record_id, sheet, source_row,
  first_ingestion_run_id, canonical_status, natural_key, advertiser,
  national_region, state, city, address, brand, category, board_type,
  format_category, classification, annual_rate_ngn, monthly_rate_ngn,
  year, quarter, period, quality_flags, record_json
) VALUES
(
  'fixture-ooh', '${oohSha}', 'fixture-ooh:DATA:2', 'DATA', 2,
  '${ingestionRun}'::uuid, 'active', 'natural-1', 'ACME LTD.',
  'South West', 'LAGOS', 'Ikeja', '1 Allen Ave.', 'Spark', 'Drinks', 'Billboard',
  'Large-Format', 'Premium', 12000000, 1000000,
  2024, 'Q1', ${json({ kind: "month", rawMonth: "January", months: [1] })}, '[]'::jsonb, ${json({ fixture: 1 })}
),
(
  'fixture-ooh', '${oohSha}', 'fixture-ooh:DATA:3', 'DATA', 3,
  '${ingestionRun}'::uuid, 'active', 'natural-2', ' acme ltd ',
  'South West', 'Lagos', 'IKEJA', '1 Allen Ave', 'SPARK', 'Drinks', 'Billboard',
  'Large Format', 'Premium', 12000000, 1000000,
  2025, 'Q1', ${json({ kind: "month", rawMonth: "January", months: [1] })}, '[]'::jsonb, ${json({ fixture: 2 })}
),
(
  'fixture-ooh', '${oohSha}', 'fixture-ooh:DATA:4', 'DATA', 4,
  '${ingestionRun}'::uuid, 'active', 'natural-3', 'Other Advertiser',
  'South West', 'Lagos', 'Ikeja', NULL, 'Other Brand', 'Drinks', 'Billboard',
  'Large Format', 'Premium', 9000000, 750000,
  2025, 'Q1', ${json({ kind: "quarter_only", rawMonth: null, months: [] })}, '[]'::jsonb, ${json({ fixture: 3 })}
);

INSERT INTO ooh_data.faan_monthly_observations (
  source_id, source_sha256, source_record_id, sheet, source_row,
  first_ingestion_run_id, natural_key, year, month, month_label,
  metric, scope, airport_state_label, airport_name, airport_label, unit,
  arrivals, departures, imports, exports, reported_total, derived_total,
  raw_values, quality_flags, record_json
) VALUES
(
  'fixture-faan', '${faanSha}', 'fixture-faan:passenger:lagos', 'PASSENGER', 5,
  '${ingestionRun}'::uuid, 'faan-1', 2024, 1, 'January',
  'passenger', 'domestic', 'Lagos', 'Murtala Muhammed International Airport', NULL, NULL,
  100, 110, NULL, NULL, 210, 210,
  '{}'::jsonb, '[]'::jsonb, ${json({ fixture: "lagos-passenger" })}
),
(
  'fixture-faan', '${faanSha}', 'fixture-faan:cargo:lagos', 'CARGO', 8,
  '${ingestionRun}'::uuid, 'faan-2', 2024, 1, 'January',
  'cargo', NULL, NULL, NULL, 'Lagos', 'KG',
  NULL, NULL, 50, 60, 110, 110,
  '{}'::jsonb, '[]'::jsonb, ${json({ fixture: "lagos-cargo" })}
),
(
  'fixture-faan', '${faanSha}', 'fixture-faan:passenger:abuja-correct', 'PASSENGER', 9,
  '${ingestionRun}'::uuid, 'faan-3', 2024, 1, 'January',
  'passenger', 'domestic', 'Abuja', 'Nnamdi Azikiwe International Airport', NULL, NULL,
  90, 95, NULL, NULL, 185, 185,
  '{}'::jsonb, '[]'::jsonb, ${json({ fixture: "abuja-correct" })}
),
(
  'fixture-faan', '${faanSha}', 'fixture-faan:passenger:abuja-variant', 'PASSENGER', 10,
  '${ingestionRun}'::uuid, 'faan-4', 2024, 1, 'January',
  'passenger', 'domestic', 'Abuja', 'Nnamdi Azikwe International Airport', NULL, NULL,
  80, 85, NULL, NULL, 165, 165,
  '{}'::jsonb, '[]'::jsonb, ${json({ fixture: "abuja-variant" })}
);
`);
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const migration = await migrateDatabase();
  for (const version of ["001", "002", "003", "004", "005"]) {
    if (!migration.applied.includes(version)) throw new Error(`MIGRATION_NOT_APPLIED:${version}`);
  }
  await seedFixture();

  const first = await rebuildEntityResolution();
  if (first.counts.canonicalEntities === 0) throw new Error("VOCABULARY_NOT_BUILT");

  const acmeEntities = await scalar(`
SELECT count(*) FROM ooh_data.canonical_entities
WHERE entity_type='advertiser' AND normalized_key='acme ltd';
`);
  if (acmeEntities !== 1) throw new Error(`ACME_CANONICALIZATION_FAILURE:${acmeEntities}`);
  const acmeAliases = await scalar(`
SELECT count(*) FROM ooh_data.canonical_entity_aliases
WHERE entity_type='advertiser' AND normalized_key='acme ltd';
`);
  if (acmeAliases !== 2) throw new Error(`ACME_ALIAS_PRESERVATION_FAILURE:${acmeAliases}`);

  const expectedSite = strictSiteIdentity({
    state: "Lagos",
    city: "Ikeja",
    address: "1 Allen Ave",
    boardType: "Billboard",
    format: "Large Format",
  });
  if (!expectedSite) throw new Error("EXPECTED_SITE_IDENTITY_MISSING");
  const siteCount = await scalar(`SELECT count(*) FROM ooh_data.site_entities WHERE site_id=${sqlLiteral(expectedSite.siteId)};`);
  if (siteCount !== 1) throw new Error(`STRICT_SITE_GROUP_FAILURE:${siteCount}`);
  const siteAssertions = await scalar(`SELECT count(*) FROM ooh_data.site_observation_assertions WHERE site_id=${sqlLiteral(expectedSite.siteId)};`);
  if (siteAssertions !== 2) throw new Error(`SITE_ASSERTION_FAILURE:${siteAssertions}`);
  const siteReview = await scalar(`SELECT count(*) FROM ooh_data.resolution_review_items WHERE domain='site_identity' AND reason='strict_site_key_incomplete';`);
  if (siteReview !== 1) throw new Error(`SITE_REVIEW_FAILURE:${siteReview}`);

  const lagosAirportAssertions = await scalar(`
SELECT count(DISTINCT airport_id)
FROM ooh_data.faan_airport_assertions
WHERE source_record_id IN ('fixture-faan:passenger:lagos', 'fixture-faan:cargo:lagos');
`);
  if (lagosAirportAssertions !== 1) throw new Error(`UNIQUE_STATE_ANCHOR_FAILURE:${lagosAirportAssertions}`);
  const abujaReview = await scalar(`
SELECT count(*) FROM ooh_data.resolution_review_items
WHERE domain='airport_identity' AND reason='state_anchor_ambiguous' AND normalized_key='abuja';
`);
  if (abujaReview !== 1) throw new Error(`AIRPORT_AMBIGUITY_REVIEW_FAILURE:${abujaReview}`);

  await rebuildEntityResolution();
  const siteAfterReplay = await scalar(`SELECT count(*) FROM ooh_data.site_entities WHERE site_id=${sqlLiteral(expectedSite.siteId)};`);
  if (siteAfterReplay !== 1) throw new Error(`RESOLVER_IDEMPOTENCY_FAILURE:${siteAfterReplay}`);
  const sourceFacts = await scalar("SELECT count(*) FROM ooh_data.ooh_observations;");
  if (sourceFacts !== 3) throw new Error(`SOURCE_FACT_MUTATION_FAILURE:${sourceFacts}`);
  const originalLiteral = await text("SELECT advertiser FROM ooh_data.ooh_observations WHERE source_record_id='fixture-ooh:DATA:2';");
  if (originalLiteral !== "ACME LTD.") throw new Error(`SOURCE_LITERAL_MUTATED:${originalLiteral}`);

  const correctAirportName = normalizeEntityLiteral("Nnamdi Azikiwe International Airport");
  if (!correctAirportName) throw new Error("CORRECT_AIRPORT_KEY_MISSING");
  const targetAirportId = airportId(correctAirportName);
  const assertionDir = await mkdtemp(join(tmpdir(), "ooh-resolution-assertions-"));
  const assertionPath = join(assertionDir, "assertions.ndjson");
  const assertions = [
    {
      kind: "site_identity",
      siteId: expectedSite.siteId,
      decisionStatus: "confirmed",
      decisionMethod: "field_verification",
      evidenceSourceId: "field-survey:site-1",
      evidenceRevision: "r1",
    },
    {
      kind: "coordinate",
      siteId: expectedSite.siteId,
      latitude: 6.6018,
      longitude: 3.3515,
      coordinateAccuracyM: 4,
      sourceKind: "field_survey",
      coordinateSourceId: "survey:site-1",
      sourceArtifactId: "survey-file:site-1",
      spatialRights: "customer_captured",
      spatialLicenseId: "attestation:site-1",
      assertionStatus: "approved",
      enrichmentRevision: "survey-r1",
    },
    {
      kind: "media_owner",
      siteId: expectedSite.siteId,
      ownerName: "Verified Media Ltd.",
      registryNamespace: "fixture-registry",
      registryRevision: "2026-08",
      evidenceSourceId: "registry:row-1",
      evidenceRevision: "r1",
      mappingMethod: "authoritative_registry",
      assertionStatus: "approved",
    },
    {
      kind: "airport_override",
      sourceLiteral: "Nnamdi Azikwe International Airport",
      targetAirportId,
      evidenceSourceId: "airport-review:1",
      evidenceRevision: "r1",
    },
  ];
  await writeFile(assertionPath, assertions.map((value) => JSON.stringify(value)).join("\n") + "\n", "utf8");
  await runCommand(
    process.execPath,
    ["--import", "tsx", "scripts/import-resolution-assertions.ts", `--input=${assertionPath}`],
    { ...process.env, DATABASE_URL: databaseUrl },
  );

  const confirmed = await text(`SELECT identity_status FROM ooh_data.site_entities WHERE site_id=${sqlLiteral(expectedSite.siteId)};`);
  if (confirmed !== "confirmed") throw new Error(`SITE_CONFIRMATION_FAILURE:${confirmed}`);
  const queueCount = await scalar(`SELECT count(*) FROM ooh_data.site_spatial_enrichment_queue WHERE site_id=${sqlLiteral(expectedSite.siteId)};`);
  if (queueCount !== 0) throw new Error(`SPATIAL_QUEUE_NOT_CLEARED:${queueCount}`);
  const coordinateUse = await text(`
SELECT renderer_eligibility || ':' || planning_use
FROM ooh_data.site_coordinate_assertions
WHERE site_id=${sqlLiteral(expectedSite.siteId)} AND assertion_status='approved';
`);
  if (coordinateUse !== "maplibre:context_only") throw new Error(`COORDINATE_RIGHTS_FAILURE:${coordinateUse}`);
  const ownerStatus = await text(`SELECT owner_status || ':' || owner_name FROM ooh_data.site_media_owner_status WHERE site_id=${sqlLiteral(expectedSite.siteId)};`);
  if (ownerStatus !== "approved:Verified Media Ltd.") throw new Error(`MEDIA_OWNER_MAPPING_FAILURE:${ownerStatus}`);

  const correctedAirport = await text(`
SELECT airport_id || ':' || assertion_method
FROM ooh_data.faan_airport_assertions
WHERE source_record_id='fixture-faan:passenger:abuja-variant';
`);
  if (correctedAirport !== `${targetAirportId}:manual_review`) {
    throw new Error(`AIRPORT_OVERRIDE_FAILURE:${correctedAirport}`);
  }

  const succeededRebuilds = await scalar("SELECT count(*) FROM ooh_data.resolution_runs WHERE run_kind='rebuild' AND status='succeeded';");
  const succeededImports = await scalar("SELECT count(*) FROM ooh_data.resolution_runs WHERE run_kind='assertion_import' AND status='succeeded';");
  if (succeededRebuilds !== 3 || succeededImports !== 1) {
    throw new Error(`RESOLUTION_AUDIT_FAILURE:${succeededRebuilds}:${succeededImports}`);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    canonicalAcmeEntities: acmeEntities,
    acmeAliases,
    siteAssertions,
    siteReview,
    airportStateAnchorDistinctIds: lagosAirportAssertions,
    airportAmbiguityReviews: abujaReview,
    succeededRebuilds,
    succeededImports,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`entity resolution integration failed: ${message}\n`);
  process.exitCode = 1;
});
