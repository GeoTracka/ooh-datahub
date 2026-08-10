import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runPsql } from "./data/psql";
import { loadMigrations } from "./data/migrations";
import { migrateDatabase } from "./db-migrate";
import { spawn } from "node:child_process";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!configuredDatabaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseUrl: string = configuredDatabaseUrl;

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

async function writeNdjson(path: string, values: unknown[]): Promise<void> {
  await writeFile(path, values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : ""), "utf8");
}

function fixtureRecord(sourceId: string) {
  return {
    sourceId,
    sheet: "DATA",
    sourceRow: 2,
    sourceRecordId: `${sourceId}:DATA:2`,
    canonicalStatus: "active",
    naturalKey: "fixture-ooh-key",
    advertiser: "Fixture Advertiser",
    nationalRegion: "South West",
    state: "Lagos",
    city: "Ikeja",
    address: "1 Fixture Road",
    brand: "Fixture Brand",
    category: "Fixture Category",
    boardType: "Billboard",
    formatCategory: "Static",
    classification: "Premium",
    annualRateNgn: 12000000,
    monthlyRateNgn: 1000000,
    year: 2024,
    quarter: "Q1",
    period: { kind: "month", rawMonth: "January", months: [1] },
    qualityFlags: [],
  };
}

function monthlyRecord(sourceId: string) {
  return {
    sourceId,
    sheet: "PASSENGER",
    sourceRow: 5,
    sourceRecordId: `${sourceId}:PASSENGER:5:passenger:domestic:month:1`,
    naturalKey: "fixture-faan-monthly",
    year: 2024,
    month: 1,
    monthLabel: "January",
    metric: "passenger",
    scope: "domestic",
    airportStateLabel: "Lagos",
    airportName: "Murtala Muhammed International Airport",
    arrivals: 100,
    departures: 110,
    reportedTotal: 210,
    derivedTotal: 210,
    rawArrivals: 100,
    rawDepartures: 110,
    rawReportedTotal: 210,
    qualityFlags: [],
  };
}

function annualRecord(sourceId: string) {
  return {
    sourceId,
    sheet: "PASSENGER",
    sourceRow: 5,
    sourceRecordId: `${sourceId}:PASSENGER:5:passenger:domestic:annual`,
    naturalKey: "fixture-faan-annual",
    year: 2024,
    metric: "passenger",
    scope: "domestic",
    airportStateLabel: "Lagos",
    airportName: "Murtala Muhammed International Airport",
    arrivals: 1200,
    departures: 1300,
    reportedTotal: 2500,
    derivedTotal: 2500,
    priorYearTotal: 2300,
    growthPercent: 8.7,
    growthDifference: 200,
    qualityFlags: [],
  };
}

async function buildFixture(directory: string, oohExpected = 1): Promise<void> {
  await mkdir(directory, { recursive: true });
  const sourceId = "fixture-source";
  const sourceSha = "a".repeat(64);
  const quarantine = {
    sourceId,
    sheet: "DATA",
    sourceRow: 9,
    reason: "invalid_year",
    raw: ["bad", "row"],
  };
  await writeNdjson(join(directory, "ooh-observations.ndjson"), [fixtureRecord(sourceId)]);
  await writeNdjson(join(directory, "ooh-board-quality.ndjson"), []);
  await writeNdjson(join(directory, "faan-monthly.ndjson"), [monthlyRecord(sourceId)]);
  await writeNdjson(join(directory, "faan-annual.ndjson"), [annualRecord(sourceId)]);
  await writeNdjson(join(directory, "quarantine.ndjson"), [quarantine]);

  const report = {
    schemaVersion: 1,
    catalogVersion: "integration-fixture-v1",
    deterministic: true,
    sourceDirectory: "runtime_argument",
    sourceChecks: [{
      id: sourceId,
      fileName: "fixture.xlsx",
      driveFileId: "fixture-drive-id",
      sha256: sourceSha,
      fileSizeBytes: 1234,
    }],
    sourceRuns: [{ sourceId, sheets: [{ sheet: "DATA", accepted: 1, quarantined: 1 }] }],
    counts: {
      oohAccepted: oohExpected,
      oohActive: oohExpected,
      oohSuperseded: 0,
      boardQualityAccepted: 0,
      faanMonthlyAccepted: 1,
      faanAnnualAccepted: 1,
      quarantined: 1,
    },
    qualityFlagCounts: { "quarantine:invalid_year": 1 },
    coverage: { fixture: true, absentIsNotZero: true },
    outputs: {
      ooh: "ooh-observations.ndjson",
      boardQuality: "ooh-board-quality.ndjson",
      faanMonthly: "faan-monthly.ndjson",
      faanAnnual: "faan-annual.ndjson",
      quarantine: "quarantine.ndjson",
      report: "seed-report.json",
    },
    plannerBoundary: "context_staging_only_not_frozen_demo_or_evidence_promotion",
  };
  await writeFile(join(directory, "seed-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}

async function persist(directory: string, expectFailure = false): Promise<void> {
  const result = await runCommand(
    process.execPath,
    ["--import", "tsx", "scripts/persist-drive-seed.ts", `--seed-dir=${directory}`, "--raw-uri=file:///tmp/ooh-raw/", "--staging-uri=file:///tmp/ooh-staging/"],
    { ...process.env, DATABASE_URL: databaseUrl },
  ).then(
    (value) => ({ ok: true as const, ...value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (expectFailure) {
    if (result.ok) throw new Error("EXPECTED_PERSISTENCE_FAILURE");
    return;
  }
  if (!result.ok) throw result.error;
}

async function scalar(sql: string): Promise<number> {
  const result = await runPsql(databaseUrl, sql, { tuplesOnly: true });
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`INVALID_SCALAR:${result.stdout}`);
  return value;
}

async function main(): Promise<void> {
  await runPsql(databaseUrl, "DROP SCHEMA IF EXISTS ooh_data CASCADE;\n");
  const manifest = await loadMigrations(resolve("migrations"));
  const expectedVersions = manifest.map((migration) => migration.version);
  const firstMigration = await migrateDatabase();
  if (firstMigration.applied.join(",") !== expectedVersions.join(",")) {
    throw new Error(`MIGRATION_MANIFEST_APPLICATION_FAILURE:${firstMigration.applied.join(",")}`);
  }
  const secondMigration = await migrateDatabase();
  if (secondMigration.applied.length !== 0 || secondMigration.alreadyApplied.join(",") !== expectedVersions.join(",")) {
    throw new Error("MIGRATION_NOT_IDEMPOTENT");
  }

  const root = await mkdtemp(join(tmpdir(), "ooh-persist-it-"));
  const valid = join(root, "valid");
  const invalid = join(root, "invalid");
  await buildFixture(valid, 1);
  await buildFixture(invalid, 2);

  await persist(valid);
  await persist(valid);

  const expectedAfterRerun: Array<[string, number]> = [
    ["ooh_data.ooh_observations", 1],
    ["ooh_data.faan_monthly_observations", 1],
    ["ooh_data.faan_annual_observations", 1],
    ["ooh_data.quarantine_records", 1],
    ["ooh_data.source_artifact_revisions", 1],
  ];
  for (const [table, expected] of expectedAfterRerun) {
    const actual = await scalar(`SELECT count(*) FROM ${table};\n`);
    if (actual !== expected) throw new Error(`IDEMPOTENCY_FAILURE:${table}:${actual}`);
  }
  const succeeded = await scalar("SELECT count(*) FROM ooh_data.ingestion_runs WHERE status='succeeded';\n");
  if (succeeded !== 2) throw new Error(`SUCCEEDED_RUN_AUDIT_FAILURE:${succeeded}`);
  const firstRunIds = await scalar("SELECT count(DISTINCT first_ingestion_run_id) FROM ooh_data.ooh_observations;\n");
  if (firstRunIds !== 1) throw new Error(`FIRST_RUN_LINEAGE_FAILURE:${firstRunIds}`);

  await persist(invalid, true);
  const failed = await scalar("SELECT count(*) FROM ooh_data.ingestion_runs WHERE status='failed';\n");
  if (failed !== 1) throw new Error(`FAILED_RUN_AUDIT_FAILURE:${failed}`);
  const oohAfterFailure = await scalar("SELECT count(*) FROM ooh_data.ooh_observations;\n");
  if (oohAfterFailure !== 1) throw new Error(`FAILED_RUN_ATOMICITY_FAILURE:${oohAfterFailure}`);

  const migrationRows = await scalar("SELECT count(*) FROM ooh_data.schema_migrations;\n");
  if (migrationRows !== manifest.length) {
    throw new Error(`MIGRATION_HISTORY_FAILURE:${migrationRows}:${manifest.length}`);
  }

  const report = JSON.parse(await readFile(join(valid, "seed-report.json"), "utf8")) as { catalogVersion: string };
  process.stdout.write(JSON.stringify({
    ok: true,
    catalogVersion: report.catalogVersion,
    migrationCount: migrationRows,
    succeededRuns: succeeded,
    failedRuns: failed,
    idempotentObservationCount: oohAfterFailure,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`data persistence integration failed: ${message}\n`);
  process.exitCode = 1;
});
