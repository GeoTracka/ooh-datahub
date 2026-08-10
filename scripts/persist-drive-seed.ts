import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import type {
  FaanAnnualFlowRecord,
  FaanAnnualWeightRecord,
  FaanMonthlyFlowRecord,
  FaanMonthlyWeightRecord,
} from "../src/seed/faan";
import type {
  OohBoardQualityObservation,
  OohObservation,
  SeedQuarantineRecord,
} from "../src/seed/ooh";
import { migrateDatabase } from "./db-migrate";
import {
  assertIngestionTransition,
  copyStart,
  copyTextRow,
  joinStorageUri,
  quarantineRecordId,
  sha256Text,
  sqlLiteral,
  validateRetentionUri,
} from "./data/persistenceFormat";
import { runPsql, startPsql, type PsqlSession } from "./data/psql";
import { SeedReportSchema, type SeedReport } from "./data/seedReport";

const LOADER_VERSION = "drive-seed-postgres-v1";

const OOH_COLUMNS = [
  "source_id", "source_sha256", "source_record_id", "sheet", "source_row",
  "first_ingestion_run_id", "canonical_status", "natural_key", "advertiser",
  "national_region", "state", "city", "address", "brand", "category", "board_type",
  "format_category", "classification", "annual_rate_ngn", "monthly_rate_ngn",
  "year", "quarter", "period", "quality_flags", "record_json",
] as const;

const BOARD_QUALITY_COLUMNS = [
  "source_id", "source_sha256", "source_record_id", "sheet", "source_row",
  "first_ingestion_run_id", "natural_key", "company", "state", "city", "address",
  "brand", "category", "board_type", "board_quality", "classification",
  "annual_rate_ngn", "monthly_rate_ngn", "year", "quarter", "period",
  "quality_flags", "record_json",
] as const;

const FAAN_MONTHLY_COLUMNS = [
  "source_id", "source_sha256", "source_record_id", "sheet", "source_row",
  "first_ingestion_run_id", "natural_key", "year", "month", "month_label",
  "metric", "scope", "airport_state_label", "airport_name", "airport_label", "unit",
  "arrivals", "departures", "imports", "exports", "reported_total", "derived_total",
  "raw_values", "quality_flags", "record_json",
] as const;

const FAAN_ANNUAL_COLUMNS = [
  "source_id", "source_sha256", "source_record_id", "sheet", "source_row",
  "first_ingestion_run_id", "natural_key", "year", "metric", "scope",
  "airport_state_label", "airport_name", "airport_label", "unit", "arrivals",
  "departures", "imports", "exports", "reported_total", "derived_total",
  "prior_year_total", "growth_percent", "growth_difference", "quality_flags",
  "record_json",
] as const;

const QUARANTINE_COLUMNS = [
  "quarantine_id", "source_id", "source_sha256", "sheet", "source_row", "reason",
  "raw", "first_ingestion_run_id",
] as const;

type FaanMonthlyRecord = FaanMonthlyFlowRecord | FaanMonthlyWeightRecord;
type FaanAnnualRecord = FaanAnnualFlowRecord | FaanAnnualWeightRecord;

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

type StagingArtifactChecks = Record<
  "ooh" | "boardQuality" | "faanMonthly" | "faanAnnual" | "quarantine",
  { fileName: string; sha256: string; fileSizeBytes: number }
>;

async function collectStagingArtifactChecks(
  seedDir: string,
  report: SeedReport,
): Promise<StagingArtifactChecks> {
  const keys = ["ooh", "boardQuality", "faanMonthly", "faanAnnual", "quarantine"] as const;
  const checks = {} as StagingArtifactChecks;
  for (const key of keys) {
    const fileName = report.outputs[key];
    const path = resolve(seedDir, fileName);
    const [actualSha, fileStat] = await Promise.all([sha256File(path), stat(path)]);
    if (!fileStat.isFile()) throw new Error(`STAGING_NOT_FILE:${key}`);
    checks[key] = {
      fileName,
      sha256: actualSha,
      fileSizeBytes: fileStat.size,
    };
  }
  return checks;
}

async function* readNdjson<T>(path: string): AsyncGenerator<T> {
  const input = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as T;
    } catch {
      throw new Error(`INVALID_NDJSON:${path}:${lineNumber}`);
    }
  }
}

function sourceShaLookup(report: SeedReport): Map<string, string> {
  return new Map(report.sourceChecks.map((source) => [source.id, source.sha256]));
}

function sourceSha(sourceHashes: ReadonlyMap<string, string>, sourceId: string): string {
  const sha = sourceHashes.get(sourceId);
  if (!sha) throw new Error(`SOURCE_REVISION_NOT_IN_REPORT:${sourceId}`);
  return sha;
}

function sourceRunLookup(report: SeedReport): Map<string, unknown> {
  return new Map(report.sourceRuns.map((run) => [run.sourceId, run]));
}

function metadataGuardSql(report: SeedReport): string {
  const statements: string[] = [];
  for (const source of report.sourceChecks) {
    statements.push(
      "DO $artifact_guard$",
      "BEGIN",
      "  IF EXISTS (",
      "    SELECT 1 FROM ooh_data.source_artifact_revisions",
      `    WHERE source_id = ${sqlLiteral(source.id)} AND sha256 = ${sqlLiteral(source.sha256)}`,
      "      AND (",
      `        drive_file_id <> ${sqlLiteral(source.driveFileId)}`,
      `        OR file_name <> ${sqlLiteral(source.fileName)}`,
      `        OR file_size_bytes <> ${source.fileSizeBytes}`,
      "      )",
      "  ) THEN",
      `    RAISE EXCEPTION 'SOURCE_ARTIFACT_METADATA_DRIFT:${source.id}:${source.sha256}';`,
      "  END IF;",
      "END",
      "$artifact_guard$;",
    );
  }
  return statements.join("\n");
}

function registerRunSql(input: {
  report: SeedReport;
  runId: string;
  reportSha256: string;
  rawRootUri: string;
  stagingUri: string;
  stagingChecks: StagingArtifactChecks;
}): string {
  const sourceRuns = sourceRunLookup(input.report);
  const lines = [
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    metadataGuardSql(input.report),
  ];

  for (const source of input.report.sourceChecks) {
    const rawUri = joinStorageUri(input.rawRootUri, source.fileName);
    lines.push(
      "INSERT INTO ooh_data.source_artifact_revisions",
      "  (source_id, sha256, drive_file_id, file_name, file_size_bytes)",
      `VALUES (${sqlLiteral(source.id)}, ${sqlLiteral(source.sha256)}, ${sqlLiteral(source.driveFileId)}, ${sqlLiteral(source.fileName)}, ${source.fileSizeBytes})`,
      "ON CONFLICT (source_id, sha256) DO NOTHING;",
      "INSERT INTO ooh_data.source_artifact_locations (source_id, sha256, storage_uri)",
      `VALUES (${sqlLiteral(source.id)}, ${sqlLiteral(source.sha256)}, ${sqlLiteral(rawUri)})`,
      "ON CONFLICT (source_id, sha256, storage_uri) DO NOTHING;",
    );
  }

  lines.push(
    "INSERT INTO ooh_data.ingestion_runs",
    "  (run_id, status, catalog_version, seed_schema_version, loader_version, seed_report_sha256, staging_storage_uri, staging_artifact_checks, processed_counts, quality_flag_counts, coverage)",
    `VALUES (${sqlLiteral(input.runId)}::uuid, 'running', ${sqlLiteral(input.report.catalogVersion)}, ${input.report.schemaVersion}, ${sqlLiteral(LOADER_VERSION)}, ${sqlLiteral(input.reportSha256)}, ${sqlLiteral(input.stagingUri)}, ${sqlLiteral(JSON.stringify(input.stagingChecks))}::jsonb, ${sqlLiteral(JSON.stringify(input.report.counts))}::jsonb, ${sqlLiteral(JSON.stringify(input.report.qualityFlagCounts))}::jsonb, ${sqlLiteral(JSON.stringify(input.report.coverage))}::jsonb);`,
  );

  for (const source of input.report.sourceChecks) {
    const sourceRun = sourceRuns.get(source.id) ?? {};
    lines.push(
      "INSERT INTO ooh_data.ingestion_run_sources (run_id, source_id, source_sha256, source_run)",
      `VALUES (${sqlLiteral(input.runId)}::uuid, ${sqlLiteral(source.id)}, ${sqlLiteral(source.sha256)}, ${sqlLiteral(JSON.stringify(sourceRun))}::jsonb);`,
    );
  }

  lines.push("COMMIT;", "");
  return lines.join("\n");
}

function oohRow(
  record: OohObservation,
  runId: string,
  sourceHashes: ReadonlyMap<string, string>,
): readonly unknown[] {
  return [
    record.sourceId,
    sourceSha(sourceHashes, record.sourceId),
    record.sourceRecordId,
    record.sheet,
    record.sourceRow,
    runId,
    record.canonicalStatus,
    record.naturalKey,
    record.advertiser,
    record.nationalRegion,
    record.state,
    record.city,
    record.address,
    record.brand,
    record.category,
    record.boardType,
    record.formatCategory,
    record.classification,
    record.annualRateNgn,
    record.monthlyRateNgn,
    record.year,
    record.quarter,
    record.period,
    record.qualityFlags,
    record,
  ];
}

function boardQualityRow(
  record: OohBoardQualityObservation,
  runId: string,
  sourceHashes: ReadonlyMap<string, string>,
): readonly unknown[] {
  return [
    record.sourceId,
    sourceSha(sourceHashes, record.sourceId),
    record.sourceRecordId,
    record.sheet,
    record.sourceRow,
    runId,
    record.naturalKey,
    record.company,
    record.state,
    record.city,
    record.address,
    record.brand,
    record.category,
    record.boardType,
    record.boardQuality,
    record.classification,
    record.annualRateNgn,
    record.monthlyRateNgn,
    record.year,
    record.quarter,
    record.period,
    record.qualityFlags,
    record,
  ];
}

function isMonthlyFlow(record: FaanMonthlyRecord): record is FaanMonthlyFlowRecord {
  return "arrivals" in record;
}

function faanMonthlyRow(
  record: FaanMonthlyRecord,
  runId: string,
  sourceHashes: ReadonlyMap<string, string>,
): readonly unknown[] {
  const flow = isMonthlyFlow(record);
  return [
    record.sourceId,
    sourceSha(sourceHashes, record.sourceId),
    record.sourceRecordId,
    record.sheet,
    record.sourceRow,
    runId,
    record.naturalKey,
    record.year,
    record.month,
    record.monthLabel,
    record.metric,
    flow ? record.scope : null,
    flow ? record.airportStateLabel : null,
    flow ? record.airportName : null,
    flow ? null : record.airportLabel,
    flow ? null : record.unit,
    flow ? record.arrivals : null,
    flow ? record.departures : null,
    flow ? null : record.imports,
    flow ? null : record.exports,
    record.reportedTotal,
    record.derivedTotal,
    flow
      ? {
          arrivals: record.rawArrivals,
          departures: record.rawDepartures,
          reportedTotal: record.rawReportedTotal,
        }
      : {
          imports: record.rawImports,
          exports: record.rawExports,
          reportedTotal: record.rawReportedTotal,
        },
    record.qualityFlags,
    record,
  ];
}

function isAnnualFlow(record: FaanAnnualRecord): record is FaanAnnualFlowRecord {
  return "arrivals" in record;
}

function faanAnnualRow(
  record: FaanAnnualRecord,
  runId: string,
  sourceHashes: ReadonlyMap<string, string>,
): readonly unknown[] {
  const flow = isAnnualFlow(record);
  return [
    record.sourceId,
    sourceSha(sourceHashes, record.sourceId),
    record.sourceRecordId,
    record.sheet,
    record.sourceRow,
    runId,
    record.naturalKey,
    record.year,
    record.metric,
    flow ? record.scope : null,
    flow ? record.airportStateLabel : null,
    flow ? record.airportName : null,
    flow ? null : record.airportLabel,
    flow ? null : record.unit,
    flow ? record.arrivals : null,
    flow ? record.departures : null,
    flow ? null : record.imports,
    flow ? null : record.exports,
    record.reportedTotal,
    record.derivedTotal,
    record.priorYearTotal,
    record.growthPercent,
    flow ? record.growthDifference : null,
    record.qualityFlags,
    record,
  ];
}

function quarantineRow(
  record: SeedQuarantineRecord,
  runId: string,
  sourceHashes: ReadonlyMap<string, string>,
): readonly unknown[] {
  const sha = sourceSha(sourceHashes, record.sourceId);
  return [
    quarantineRecordId({
      sourceId: record.sourceId,
      sourceSha256: sha,
      sheet: record.sheet,
      sourceRow: record.sourceRow,
      reason: record.reason,
      raw: record.raw,
    }),
    record.sourceId,
    sha,
    record.sheet,
    record.sourceRow,
    record.reason,
    record.raw,
    runId,
  ];
}

async function copyNdjson<T>(
  session: PsqlSession,
  path: string,
  tempTable: string,
  targetTable: string,
  columns: readonly string[],
  conflictColumns: readonly string[],
  row: (record: T) => readonly unknown[],
): Promise<number> {
  await session.write(
    `CREATE TEMP TABLE ${tempTable} (LIKE ${targetTable} INCLUDING DEFAULTS) ON COMMIT DROP;\n`,
  );
  await session.write(copyStart(tempTable, columns));
  let count = 0;
  try {
    for await (const record of readNdjson<T>(path)) {
      await session.write(copyTextRow(row(record)));
      count += 1;
    }
  } catch (error) {
    await session.write("\\.\n");
    throw error;
  }
  await session.write("\\.\n");
  await session.write(
    `INSERT INTO ${targetTable} (${columns.join(", ")}) SELECT ${columns.join(", ")} FROM ${tempTable} ON CONFLICT (${conflictColumns.join(", ")}) DO NOTHING;\n`,
  );
  await session.write(`DROP TABLE ${tempTable};\n`);
  return count;
}

async function markFailed(databaseUrl: string, runId: string, error: unknown): Promise<void> {
  assertIngestionTransition("running", "failed");
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const code = detail.split(":")[0] || "PERSISTENCE_FAILED";
  await runPsql(
    databaseUrl,
    [
      "\\set ON_ERROR_STOP on",
      "UPDATE ooh_data.ingestion_runs",
      "SET status = 'failed', completed_at = now(),",
      `    error_code = ${sqlLiteral(code)}, error_detail = ${sqlLiteral(detail)}`,
      `WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';`,
      "",
    ].join("\n"),
  );
}

async function persistSeed(): Promise<{ runId: string; counts: SeedReport["counts"] }> {
  const databaseUrl = requiredDatabaseUrl();
  const seedDir = resolve(argValue("seed-dir") ?? "data/seeded/drive");
  const reportPath = resolve(seedDir, "seed-report.json");
  const reportText = await readFile(reportPath, "utf8");
  const report = SeedReportSchema.parse(JSON.parse(reportText));
  const reportSha256 = sha256Text(reportText);
  const stagingChecks = await collectStagingArtifactChecks(seedDir, report);

  const rawRoot = validateRetentionUri(
    argValue("raw-uri") ?? process.env.OOH_RAW_SOURCE_URI ?? "",
    "raw_source",
  );
  const stagingUri = validateRetentionUri(
    argValue("staging-uri")
      ?? process.env.OOH_SEED_STAGING_URI
      ?? pathToFileURL(`${seedDir}/`).toString(),
    "staging",
  );

  await migrateDatabase();

  const runId = randomUUID();
  await runPsql(
    databaseUrl,
    registerRunSql({
      report,
      runId,
      reportSha256,
      rawRootUri: rawRoot,
      stagingUri,
      stagingChecks,
    }),
  );

  const sourceHashes = sourceShaLookup(report);
  const session = startPsql(databaseUrl);
  let transactionOpen = false;
  try {
    await session.write("\\set ON_ERROR_STOP on\nBEGIN;\n");
    transactionOpen = true;

    const oohCount = await copyNdjson<OohObservation>(
      session,
      resolve(seedDir, report.outputs.ooh),
      "ingest_ooh",
      "ooh_data.ooh_observations",
      OOH_COLUMNS,
      ["source_id", "source_sha256", "source_record_id"],
      (record) => oohRow(record, runId, sourceHashes),
    );
    const boardQualityCount = await copyNdjson<OohBoardQualityObservation>(
      session,
      resolve(seedDir, report.outputs.boardQuality),
      "ingest_board_quality",
      "ooh_data.ooh_board_quality_observations",
      BOARD_QUALITY_COLUMNS,
      ["source_id", "source_sha256", "source_record_id"],
      (record) => boardQualityRow(record, runId, sourceHashes),
    );
    const faanMonthlyCount = await copyNdjson<FaanMonthlyRecord>(
      session,
      resolve(seedDir, report.outputs.faanMonthly),
      "ingest_faan_monthly",
      "ooh_data.faan_monthly_observations",
      FAAN_MONTHLY_COLUMNS,
      ["source_id", "source_sha256", "source_record_id"],
      (record) => faanMonthlyRow(record, runId, sourceHashes),
    );
    const faanAnnualCount = await copyNdjson<FaanAnnualRecord>(
      session,
      resolve(seedDir, report.outputs.faanAnnual),
      "ingest_faan_annual",
      "ooh_data.faan_annual_observations",
      FAAN_ANNUAL_COLUMNS,
      ["source_id", "source_sha256", "source_record_id"],
      (record) => faanAnnualRow(record, runId, sourceHashes),
    );
    const quarantineCount = await copyNdjson<SeedQuarantineRecord>(
      session,
      resolve(seedDir, report.outputs.quarantine),
      "ingest_quarantine",
      "ooh_data.quarantine_records",
      QUARANTINE_COLUMNS,
      ["quarantine_id"],
      (record) => quarantineRow(record, runId, sourceHashes),
    );

    const expectedCounts = [
      ["ooh", oohCount, report.counts.oohAccepted],
      ["boardQuality", boardQualityCount, report.counts.boardQualityAccepted],
      ["faanMonthly", faanMonthlyCount, report.counts.faanMonthlyAccepted],
      ["faanAnnual", faanAnnualCount, report.counts.faanAnnualAccepted],
      ["quarantine", quarantineCount, report.counts.quarantined],
    ] as const;
    for (const [name, actual, expected] of expectedCounts) {
      if (actual !== expected) {
        throw new Error(`STAGING_ROW_COUNT_MISMATCH:${name}:expected=${expected}:actual=${actual}`);
      }
    }

    assertIngestionTransition("running", "succeeded");
    await session.write(
      [
        "UPDATE ooh_data.ingestion_runs",
        "SET status = 'succeeded', completed_at = now()",
        `WHERE run_id = ${sqlLiteral(runId)}::uuid AND status = 'running';`,
        "COMMIT;",
        "",
      ].join("\n"),
    );
    transactionOpen = false;
    await session.finish();
    return { runId, counts: report.counts };
  } catch (error) {
    if (transactionOpen) {
      try {
        await session.write("ROLLBACK;\n");
      } catch {
        // The psql process may already have exited after a server-side error.
      }
    }
    try {
      await session.finish();
    } catch {
      // The original persistence error is more useful; failure is recorded below.
    }
    try {
      await markFailed(databaseUrl, runId, error);
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : String(auditError);
      process.stderr.write(`seed:persist failure-audit warning: ${auditMessage}\n`);
    }
    throw error;
  }
}

persistSeed()
  .then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`seed:persist failed: ${message}\n`);
    process.exitCode = 1;
  });
