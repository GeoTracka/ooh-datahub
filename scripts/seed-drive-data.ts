import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { join, resolve } from "node:path";
import readXlsxFile from "read-excel-file/node";
import {
  SEED_SOURCE_CATALOG_VERSION,
  seedSourceCatalog,
  type FaanSourceSpec,
  type OohSourceSpec,
} from "../src/seed/sourceCatalog";
import { nonEmptyRowCount } from "../src/seed/normalize";
import {
  iterateOohBoardQualityRows,
  iterateOohPlacementRows,
  type SeedQuarantineRecord,
} from "../src/seed/ooh";
import { parseFaanFlowSection, parseFaanWeightSection } from "../src/seed/faan";

const OUTPUT_FILES = {
  ooh: "ooh-observations.ndjson",
  boardQuality: "ooh-board-quality.ndjson",
  faanMonthly: "faan-monthly.ndjson",
  faanAnnual: "faan-annual.ndjson",
  quarantine: "quarantine.ndjson",
  report: "seed-report.json",
} as const;

type QualityCounts = Record<string, number>;

type SeedCounts = {
  oohAccepted: number;
  oohActive: number;
  oohSuperseded: number;
  boardQualityAccepted: number;
  faanMonthlyAccepted: number;
  faanAnnualAccepted: number;
  quarantined: number;
};

type VerifiedSource = {
  id: string;
  fileName: string;
  driveFileId: string;
  sha256: string;
  fileSizeBytes: number;
};

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function verifySources(sourceDir: string): Promise<VerifiedSource[]> {
  const verified: VerifiedSource[] = [];
  for (const source of seedSourceCatalog) {
    const path = join(sourceDir, source.fileName);
    let fileStat;
    try {
      fileStat = await stat(path);
    } catch {
      throw new Error(`SOURCE_FILE_MISSING:${source.id}:${source.fileName}`);
    }
    if (!fileStat.isFile()) throw new Error(`SOURCE_NOT_FILE:${source.id}:${source.fileName}`);
    const actual = await sha256File(path);
    if (actual !== source.sha256) {
      throw new Error(`SOURCE_CHECKSUM_MISMATCH:${source.id}:expected=${source.sha256}:actual=${actual}`);
    }
    verified.push({
      id: source.id,
      fileName: source.fileName,
      driveFileId: source.driveFileId,
      sha256: actual,
      fileSizeBytes: fileStat.size,
    });
  }
  return verified;
}

async function readSheet(path: string, sheet: string): Promise<unknown[][]> {
  const rows = await readXlsxFile(path, { sheet });
  return rows as unknown[][];
}

function bump(map: QualityCounts, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function bumpFlags(map: QualityCounts, flags: readonly string[]): void {
  for (const flag of flags) bump(map, flag);
}

async function replaceOutputDirectory(stagingDir: string, outputDir: string): Promise<void> {
  const backupDir = `${outputDir}.previous-${process.pid}`;
  await rm(backupDir, { recursive: true, force: true });
  let movedPrevious = false;
  try {
    await stat(outputDir);
    await rename(outputDir, backupDir);
    movedPrevious = true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }

  try {
    await rename(stagingDir, outputDir);
  } catch (error) {
    if (movedPrevious) await rename(backupDir, outputDir);
    throw error;
  }

  if (movedPrevious) await rm(backupDir, { recursive: true, force: true });
}

async function writeLine(stream: ReturnType<typeof createWriteStream>, value: unknown): Promise<void> {
  const payload = JSON.stringify(value) + "\n";
  if (!stream.write(payload, "utf8")) await once(stream, "drain");
}

async function closeStream(stream: ReturnType<typeof createWriteStream>): Promise<void> {
  stream.end();
  await once(stream, "finish");
}

function faanCoverage() {
  return [2023, 2024, 2025].map((year) => {
    const source = seedSourceCatalog.find(
      (candidate): candidate is FaanSourceSpec => candidate.kind === "faan" && candidate.year === year,
    );
    if (!source) throw new Error(`FAAN_SOURCE_NOT_CATALOGUED:${year}`);
    const flowMetrics = new Set(source.flowSections.map((section) => section.metric));
    const weightMetrics = new Set(source.weightSections.map((section) => section.metric));
    return {
      year,
      passenger: flowMetrics.has("passenger"),
      aircraft: flowMetrics.has("aircraft"),
      cargo: weightMetrics.has("cargo"),
      mail: weightMetrics.has("mail"),
    };
  });
}

async function processOohSource(
  sourceDir: string,
  source: OohSourceSpec,
  streams: {
    ooh: ReturnType<typeof createWriteStream>;
    boardQuality: ReturnType<typeof createWriteStream>;
    quarantine: ReturnType<typeof createWriteStream>;
  },
  counts: SeedCounts,
  quality: QualityCounts,
): Promise<{ sourceId: string; sheets: { sheet: string; physicalRows: number; accepted: number; quarantined: number }[] }> {
  const path = join(sourceDir, source.fileName);
  const sheets: { sheet: string; physicalRows: number; accepted: number; quarantined: number }[] = [];

  for (const spec of source.placementSheets) {
    const rows = await readSheet(path, spec.sheet);
    const physicalRows = nonEmptyRowCount(rows);
    if (physicalRows !== spec.expectedDataRows) {
      throw new Error(`SOURCE_ROW_COUNT_MISMATCH:${source.id}:${spec.sheet}:expected=${spec.expectedDataRows}:actual=${physicalRows}`);
    }
    let accepted = 0;
    let quarantined = 0;
    for (const item of iterateOohPlacementRows(rows, source.id, spec)) {
      if (item.kind === "record") {
        await writeLine(streams.ooh, item.record);
        accepted += 1;
        counts.oohAccepted += 1;
        if (item.record.canonicalStatus === "active") counts.oohActive += 1;
        else counts.oohSuperseded += 1;
        bumpFlags(quality, item.record.qualityFlags);
      } else {
        await writeLine(streams.quarantine, item.quarantine);
        quarantined += 1;
        counts.quarantined += 1;
        bump(quality, `quarantine:${item.quarantine.reason}`);
      }
    }
    sheets.push({ sheet: spec.sheet, physicalRows, accepted, quarantined });
  }

  for (const spec of source.boardQualitySheets ?? []) {
    const rows = await readSheet(path, spec.sheet);
    const physicalRows = nonEmptyRowCount(rows);
    if (physicalRows !== spec.expectedDataRows) {
      throw new Error(`SOURCE_ROW_COUNT_MISMATCH:${source.id}:${spec.sheet}:expected=${spec.expectedDataRows}:actual=${physicalRows}`);
    }
    let accepted = 0;
    let quarantined = 0;
    for (const item of iterateOohBoardQualityRows(rows, source.id, spec)) {
      if (item.kind === "record") {
        await writeLine(streams.boardQuality, item.record);
        accepted += 1;
        counts.boardQualityAccepted += 1;
        bumpFlags(quality, item.record.qualityFlags);
      } else {
        await writeLine(streams.quarantine, item.quarantine);
        quarantined += 1;
        counts.quarantined += 1;
        bump(quality, `quarantine:${item.quarantine.reason}`);
      }
    }
    sheets.push({ sheet: spec.sheet, physicalRows, accepted, quarantined });
  }

  return { sourceId: source.id, sheets };
}

async function emitQuarantine(
  stream: ReturnType<typeof createWriteStream>,
  records: SeedQuarantineRecord[],
  counts: SeedCounts,
  quality: QualityCounts,
): Promise<void> {
  for (const record of records) {
    await writeLine(stream, record);
    counts.quarantined += 1;
    bump(quality, `quarantine:${record.reason}`);
  }
}

async function processFaanSource(
  sourceDir: string,
  source: FaanSourceSpec,
  streams: {
    monthly: ReturnType<typeof createWriteStream>;
    annual: ReturnType<typeof createWriteStream>;
    quarantine: ReturnType<typeof createWriteStream>;
  },
  counts: SeedCounts,
  quality: QualityCounts,
): Promise<{ sourceId: string; sheets: { sheet: string; parsedSections: number }[] }> {
  const path = join(sourceDir, source.fileName);
  const sheetNames = [...new Set([
    ...source.flowSections.map((section) => section.sheet),
    ...source.weightSections.map((section) => section.sheet),
  ])];
  const sheets = new Map<string, unknown[][]>();
  for (const sheet of sheetNames) sheets.set(sheet, await readSheet(path, sheet));
  const sectionCounts = new Map<string, number>();

  for (const spec of source.flowSections) {
    const parsed = parseFaanFlowSection(sheets.get(spec.sheet) ?? [], source.id, source.year, spec);
    for (const record of parsed.monthly) {
      await writeLine(streams.monthly, record);
      counts.faanMonthlyAccepted += 1;
      bumpFlags(quality, record.qualityFlags);
    }
    for (const record of parsed.annual) {
      await writeLine(streams.annual, record);
      counts.faanAnnualAccepted += 1;
      bumpFlags(quality, record.qualityFlags);
    }
    await emitQuarantine(streams.quarantine, parsed.quarantine, counts, quality);
    sectionCounts.set(spec.sheet, (sectionCounts.get(spec.sheet) ?? 0) + 1);
  }

  for (const spec of source.weightSections) {
    const parsed = parseFaanWeightSection(sheets.get(spec.sheet) ?? [], source.id, source.year, spec);
    for (const record of parsed.monthly) {
      await writeLine(streams.monthly, record);
      counts.faanMonthlyAccepted += 1;
      bumpFlags(quality, record.qualityFlags);
    }
    for (const record of parsed.annual) {
      await writeLine(streams.annual, record);
      counts.faanAnnualAccepted += 1;
      bumpFlags(quality, record.qualityFlags);
    }
    await emitQuarantine(streams.quarantine, parsed.quarantine, counts, quality);
    sectionCounts.set(spec.sheet, (sectionCounts.get(spec.sheet) ?? 0) + 1);
  }

  return {
    sourceId: source.id,
    sheets: [...sectionCounts.entries()].map(([sheet, parsedSections]) => ({ sheet, parsedSections })),
  };
}

async function main(): Promise<void> {
  const sourceDir = resolve(argValue("source-dir", "data/raw/drive"));
  const outputDir = resolve(argValue("output-dir", "data/seeded/drive"));
  const stagingDir = `${outputDir}.tmp-${process.pid}`;

  // Verify every exact artifact before creating outputs. This prevents a partial
  // seed run when one source file has drifted or been replaced in Drive.
  const verifiedSources = await verifySources(sourceDir);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });

  try {
    const streams = {
      ooh: createWriteStream(join(stagingDir, OUTPUT_FILES.ooh), { encoding: "utf8" }),
      boardQuality: createWriteStream(join(stagingDir, OUTPUT_FILES.boardQuality), { encoding: "utf8" }),
      monthly: createWriteStream(join(stagingDir, OUTPUT_FILES.faanMonthly), { encoding: "utf8" }),
      annual: createWriteStream(join(stagingDir, OUTPUT_FILES.faanAnnual), { encoding: "utf8" }),
      quarantine: createWriteStream(join(stagingDir, OUTPUT_FILES.quarantine), { encoding: "utf8" }),
    };
    const counts: SeedCounts = {
      oohAccepted: 0,
      oohActive: 0,
      oohSuperseded: 0,
      boardQualityAccepted: 0,
      faanMonthlyAccepted: 0,
      faanAnnualAccepted: 0,
      quarantined: 0,
    };
    const qualityFlagCounts: QualityCounts = {};
    const sourceRuns: unknown[] = [];

    try {
      for (const source of seedSourceCatalog) {
        if (source.kind === "ooh") {
          sourceRuns.push(await processOohSource(sourceDir, source, streams, counts, qualityFlagCounts));
        } else {
          sourceRuns.push(await processFaanSource(
            sourceDir,
            source,
            { monthly: streams.monthly, annual: streams.annual, quarantine: streams.quarantine },
            counts,
            qualityFlagCounts,
          ));
        }
      }
    } finally {
      await Promise.all([
        closeStream(streams.ooh),
        closeStream(streams.boardQuality),
        closeStream(streams.monthly),
        closeStream(streams.annual),
        closeStream(streams.quarantine),
      ]);
    }

    const report = {
      schemaVersion: 1,
      catalogVersion: SEED_SOURCE_CATALOG_VERSION,
      deterministic: true,
      sourceDirectory: "runtime_argument",
      sourceChecks: verifiedSources,
      sourceRuns,
      counts,
      qualityFlagCounts: Object.fromEntries(Object.entries(qualityFlagCounts).sort(([left], [right]) => left.localeCompare(right))),
      coverage: {
        ooh: {
          years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
          historical2023: "superseded_by_ooh-full-year-2023-r1",
          boardQuality: { year: 2023, period: "January-October", source: "NB SOV" },
          latestPlacementPeriod: "Q1 2025",
        },
        faan: faanCoverage(),
        absentIsNotZero: true,
      },
      outputs: OUTPUT_FILES,
      plannerBoundary: "context_staging_only_not_frozen_demo_or_evidence_promotion",
    };
    const reportPath = join(stagingDir, OUTPUT_FILES.report);
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

    // Reading the report back validates the final artifact is complete JSON before success.
    JSON.parse(await readFile(reportPath, "utf8"));

    // The canonical output is replaced only after the entire run succeeds, so a
    // failed parse never masquerades as a complete seed dataset.
    await replaceOutputDirectory(stagingDir, outputDir);
    process.stdout.write(JSON.stringify({ outputDir, counts, coverage: report.coverage }, null, 2) + "\n");
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`seed:data failed: ${message}\n`);
  process.exitCode = 1;
});
