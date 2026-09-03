import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import type { NormalizedSurveyRow } from "@/evidence/contracts";
import {
  categoricalCounts,
  meanRatingFact,
  MINIMUM_SEGMENT_BASE,
  percentageFact,
  selectionFact,
} from "@/evidence/rblLoma2026/aggregate";
import { normalizeSurveyRow } from "@/evidence/rblLoma2026/normalize";
import { evidenceDisposition } from "@/evidence/rblLoma2026/policy";
import { reportEvidence } from "@/evidence/rblLoma2026/reportEvidence";
import { rblLoma2026Sources } from "@/evidence/sourceCatalog";
import { auditSources } from "./audit-rbl-loma";
import {
  replaceDirectoryAtomic,
  requiredEnvironmentPath,
  writeJsonAtomic,
} from "./io";

const WORKSHEET_NAME = "Nigeria OOH 3";
const COLUMN_COUNT = 302;

type Segment = {
  id: string;
  city: NormalizedSurveyRow["city"];
  ageBand?: string;
  gender?: string;
  rows: NormalizedSurveyRow[];
};

type PublicFact = Record<string, unknown> & {
  factId: string;
  metricId: string;
  sourceId: string;
  sourceColumn?: number;
};

const SINGLE_VALUE_METRICS = [
  ["journey_attention", (row: NormalizedSurveyRow) => row.mobility.journeyAttention],
  ["travel_frequency", (row: NormalizedSurveyRow) => row.mobility.travelFrequency],
  ["primary_transport", (row: NormalizedSurveyRow) => row.mobility.primaryTransport],
  ["weekday_time", (row: NormalizedSurveyRow) => row.mobility.weekdayTime],
  ["noticed_frequency", (row: NormalizedSurveyRow) => row.formats.noticedFrequency],
  ["hardest_to_ignore", (row: NormalizedSurveyRow) => row.formats.hardestToIgnore],
  ["commute_mood", (row: NormalizedSurveyRow) => row.formats.commuteMood],
] as const;

const MULTI_VALUE_METRICS = [
  ["weekday_time", (row: NormalizedSurveyRow) => row.mobility.weekdayTimes],
  ["weekly_environment", (row: NormalizedSurveyRow) => row.mobility.weeklyEnvironments],
  ["top_format_seen", (row: NormalizedSurveyRow) => row.formats.topFormats],
  ["commute_attention", (row: NormalizedSurveyRow) => row.formats.commuteAttention],
  ["creative_trigger", (row: NormalizedSurveyRow) => row.creative.triggers],
  ["reported_post_ad_action", (row: NormalizedSurveyRow) => row.actions.reported],
] as const;

const RATING_FAMILIES: Readonly<Record<number, string>> = {
  226: "format_attention_rating",
  227: "format_attention_rating",
  228: "format_attention_rating",
  229: "format_attention_rating",
  230: "format_attention_rating",
  233: "format_recall_rating",
  234: "format_recall_rating",
  235: "format_recall_rating",
  236: "format_recall_rating",
  237: "format_recall_rating",
  240: "format_trust_rating",
  241: "format_trust_rating",
  242: "format_trust_rating",
  243: "format_trust_rating",
  244: "format_trust_rating",
  247: "format_effect_rating",
  248: "format_effect_rating",
  249: "format_effect_rating",
  250: "format_effect_rating",
  251: "format_effect_rating",
  254: "format_quality_rating",
  255: "format_quality_rating",
  256: "format_quality_rating",
  257: "format_quality_rating",
  258: "format_quality_rating",
};

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unspecified";
}

function answerLabel(header: string, column: number): string {
  const fragments = header
    .split("/")
    .map((part) => part.replace(/^\s*(top\s*3:|\d+\.?|_)+\s*/i, "").trim())
    .filter(Boolean);
  return fragments.at(-1) || `Workbook option ${column}`;
}

function factIdentity(segment: Segment, metricId: string, suffix?: string) {
  const segmentToken = slug(segment.id);
  return `${metricId}:${segmentToken}${suffix ? `:${slug(suffix)}` : ""}`;
}

function segmentsFor(rows: NormalizedSurveyRow[]): Segment[] {
  const segments: Segment[] = [];
  const cities = new Map<NormalizedSurveyRow["city"], NormalizedSurveyRow[]>();
  for (const row of rows) {
    const cityRows = cities.get(row.city) ?? [];
    cityRows.push(row);
    cities.set(row.city, cityRows);
  }

  for (const [city, cityRows] of cities) {
    segments.push({ id: city, city, rows: cityRows });
    for (const dimension of ["ageBand", "gender"] as const) {
      const values = new Map<string, NormalizedSurveyRow[]>();
      for (const row of cityRows) {
        const value = row[dimension];
        if (!value) continue;
        const valueRows = values.get(value) ?? [];
        valueRows.push(row);
        values.set(value, valueRows);
      }
      for (const [value, valueRows] of values) {
        if (valueRows.length < MINIMUM_SEGMENT_BASE) continue;
        segments.push({
          id: `${city}:${dimension}:${value}`,
          city,
          [dimension]: value,
          rows: valueRows,
        });
      }
    }
  }
  return segments;
}

function publicFact(
  segment: Segment,
  metricId: string,
  value: Record<string, unknown>,
  suffix?: string,
  sourceColumn?: number,
): PublicFact {
  const disposition = evidenceDisposition(metricId, segment.city);
  if (disposition.status !== "approved") {
    throw new Error(`BLOCKED_METRIC_IN_PUBLICATION:${metricId}:${disposition.reason}`);
  }
  return {
    ...value,
    factId: factIdentity(segment, metricId, suffix),
    metricId,
    segment: {
      city: segment.city,
      ...(segment.ageBand ? { ageBand: segment.ageBand } : {}),
      ...(segment.gender ? { gender: segment.gender } : {}),
    },
    sourceId: rblLoma2026Sources[0].id,
    ...(sourceColumn ? { sourceColumn } : {}),
  };
}

function buildPublicFacts(
  rows: NormalizedSurveyRow[],
  headers: Readonly<Record<number, string>>,
): PublicFact[] {
  const facts: PublicFact[] = [];
  for (const segment of segmentsFor(rows)) {
    facts.push(
      publicFact(segment, "sample_base", {
        value: segment.rows.length,
        unit: "respondents",
        respondentBase: segment.rows.length,
        period: "2026-05",
        weighting: "unweighted",
      }),
    );

    for (const [family, read] of SINGLE_VALUE_METRICS) {
      const valid = segment.rows.map(read).filter((value): value is string => Boolean(value));
      if (valid.length < MINIMUM_SEGMENT_BASE) continue;
      for (const { key, label, count } of categoricalCounts(valid)) {
        const metricId = `${family}_${slug(key)}`;
        facts.push(
          publicFact(
            segment,
            metricId,
            {
              ...percentageFact({
                metricId,
                city: segment.city,
                yes: count,
                base: valid.length,
              }),
              label,
            },
            key,
          ),
        );
      }
    }

    for (const [family, read] of MULTI_VALUE_METRICS) {
      const counts = new Map<number, number>();
      for (const row of segment.rows) {
        for (const key of Object.keys(read(row))) {
          const column = Number(key.slice(1));
          counts.set(column, (counts.get(column) ?? 0) + 1);
        }
      }
      for (const [column, count] of counts) {
        const label = answerLabel(headers[column] ?? "", column);
        const metricId = `${family}_${slug(label)}`;
        facts.push(
          publicFact(
            segment,
            metricId,
            {
              ...selectionFact({
                metricId,
                city: segment.city,
                selectionCount: count,
                validRespondentBase: segment.rows.length,
              }),
              label,
            },
            `${column}:${label}`,
            column,
          ),
        );
      }
    }

    for (const [columnText, family] of Object.entries(RATING_FAMILIES)) {
      const column = Number(columnText);
      const ratings = segment.rows
        .map((row) => row.formats.ratings[`c${column}`])
        .filter((rating): rating is number => rating !== undefined);
      if (ratings.length === 0) continue;
      const label = answerLabel(headers[column] ?? "", column);
      const metricId = `${family}_${slug(label)}`;
      facts.push(
        publicFact(
          segment,
          metricId,
          {
            ...meanRatingFact({
              metricId,
              city: segment.city,
              ratings,
              respondentBase: segment.rows.length,
            }),
            label,
          },
          `${column}:${label}`,
          column,
        ),
      );
    }
  }
  return facts;
}

export async function buildEvidenceArtifacts({
  workbookPath,
  reportPath,
}: {
  workbookPath: string;
  reportPath: string;
}) {
  const audit = await auditSources({ workbookPath, reportPath });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.getWorksheet(WORKSHEET_NAME);
  if (!worksheet) throw new Error("WORKBOOK_SCHEMA_MISMATCH:missing_sheet");

  const headers: Record<number, string> = {};
  for (let column = 1; column <= COLUMN_COUNT; column += 1) {
    headers[column] = worksheet.getRow(1).getCell(column).text;
  }

  const acceptedRows: NormalizedSurveyRow[] = [];
  const quarantine: Array<{ rowNumber: number; reason: string }> = [];
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const cells = Array.from({ length: COLUMN_COUNT }, (_, index) =>
      worksheet.getRow(rowNumber).getCell(index + 1).text,
    );
    const result = normalizeSurveyRow(cells, rowNumber);
    if (result.kind === "accepted") acceptedRows.push(result.row);
    else quarantine.push(result);
  }

  const publication = {
    schemaVersion: 1,
    studyId: "rbl-loma-ooh-audience-penetration-2026",
    generatedAt: new Date().toISOString(),
    sourceHashes: audit.sourceHashes,
    methodology: {
      scope: "12-city urban resident and regular commuter study",
      weighting: "unweighted",
      minimumSegmentBase: MINIMUM_SEGMENT_BASE,
      caveat:
        "Survey evidence describes the study sample and does not estimate population reach, site delivery, price, availability, ROI, radio listening, or activation potential.",
    },
    facts: buildPublicFacts(acceptedRows, headers),
    reportEvidence,
    blockedDiscrepancies: audit.discrepancies.filter(
      (discrepancy) => discrepancy.status === "blocked",
    ),
  };
  await auditSources({ workbookPath, reportPath, publicationPayload: publication });

  return {
    audit,
    restricted: {
      accessClass: "restricted_respondent_staging",
      rows: acceptedRows,
      quarantine,
    },
    publication,
  };
}

async function main(): Promise<void> {
  const workbookPath = requiredEnvironmentPath("RBL_LOMA_WORKBOOK_PATH");
  const reportPath = requiredEnvironmentPath("RBL_LOMA_REPORT_PATH");
  const stagingDirectory = path.resolve(
    process.env.RBL_LOMA_EVIDENCE_STAGING_DIR?.trim() ||
      ".local/evidence/rbl-loma-2026",
  );
  const artifacts = await buildEvidenceArtifacts({ workbookPath, reportPath });
  await replaceDirectoryAtomic(stagingDirectory, async (temporary) => {
    await Promise.all([
      writeJsonAtomic(path.join(temporary, "audit.json"), artifacts.audit),
      writeJsonAtomic(
        path.join(temporary, "restricted-normalized.json"),
        artifacts.restricted,
      ),
      writeJsonAtomic(
        path.join(temporary, "publication.json"),
        artifacts.publication,
      ),
    ]);
  });
  process.stdout.write(
    `Built ${artifacts.publication.facts.length} governed facts from ${artifacts.restricted.rows.length} eligible responses.\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
