import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import { normalizeSurveyRow } from "@/evidence/rblLoma2026/normalize";
import { rblLoma2026Sources } from "@/evidence/sourceCatalog";
import {
  fileSha256,
  requiredEnvironmentPath,
  writeJsonAtomic,
} from "./io";

const EXPECTED_SHEET = "Nigeria OOH 3";
const EXPECTED_ROWS = 1844;
const EXPECTED_COLUMNS = 302;

const RESTRICTED_PUBLICATION_KEYS = [
  "restrictedopentext",
  "opentext",
  "routeopentext",
  "areaopentext",
  "routeraw",
  "arearaw",
  "interviewer",
  "respondentname",
  "respondentidentity",
  "gps",
  "latitude",
  "longitude",
  "altitude",
  "precision",
  "deviceid",
  "submission",
] as const;

export type EvidenceAudit = {
  sourceHashes: Record<string, string>;
  workbook: {
    sheet: typeof EXPECTED_SHEET;
    rows: number;
    columns: number;
    cities: Record<string, number>;
  };
  eligibility: {
    accepted: number;
    quarantined: number;
    reasons: Record<string, number>;
  };
  discrepancies: Array<{
    id: string;
    status: "blocked" | "resolved";
    workbookValue: number | null;
    reportValue: number | null;
    note: string;
  }>;
  privacy: {
    restrictedFieldsObserved: string[];
    restrictedFieldsPublished: [];
  };
};

export type AuditSourcesInput = {
  workbookPath: string;
  reportPath: string;
  expectedWorkbookSha256?: string;
  expectedReportSha256?: string;
  publicationPayload?: unknown;
};

function publicationKeyIsRestricted(key: string): boolean {
  const token = key.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "");
  return RESTRICTED_PUBLICATION_KEYS.some((restricted) =>
    token.includes(restricted),
  );
}

export function assertPublicationPrivacy(value: unknown, trail = "$public"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertPublicationPrivacy(item, `${trail}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (publicationKeyIsRestricted(key)) {
      throw new Error(`PRIVACY_FIELD_IN_PUBLICATION:${trail}.${key}`);
    }
    assertPublicationPrivacy(child, `${trail}.${key}`);
  }
}

function spreadsheetRow(worksheet: ExcelJS.Worksheet, rowNumber: number): unknown[] {
  const row = worksheet.getRow(rowNumber);
  return Array.from({ length: EXPECTED_COLUMNS }, (_, index) =>
    row.getCell(index + 1).text,
  );
}

export async function auditSources({
  workbookPath,
  reportPath,
  expectedWorkbookSha256 = rblLoma2026Sources[0].sha256,
  expectedReportSha256 = rblLoma2026Sources[1].sha256,
  publicationPayload,
}: AuditSourcesInput): Promise<EvidenceAudit> {
  const [workbookSha256, reportSha256] = await Promise.all([
    fileSha256(workbookPath),
    fileSha256(reportPath),
  ]);

  if (workbookSha256 !== expectedWorkbookSha256) {
    throw new Error(
      `SOURCE_CHECKSUM_MISMATCH:workbook:${workbookSha256}:${expectedWorkbookSha256}`,
    );
  }
  if (reportSha256 !== expectedReportSha256) {
    throw new Error(
      `SOURCE_CHECKSUM_MISMATCH:report:${reportSha256}:${expectedReportSha256}`,
    );
  }

  if (publicationPayload !== undefined) {
    assertPublicationPrivacy(publicationPayload);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.getWorksheet(EXPECTED_SHEET);
  const dataRows = worksheet ? worksheet.actualRowCount - 1 : 0;
  const columns = worksheet?.actualColumnCount ?? 0;
  if (
    !worksheet ||
    dataRows !== EXPECTED_ROWS ||
    columns !== EXPECTED_COLUMNS
  ) {
    throw new Error(
      `WORKBOOK_SCHEMA_MISMATCH:${worksheet?.name ?? "missing"}:${dataRows}:${columns}`,
    );
  }

  const cities: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  let accepted = 0;
  let quarantined = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const result = normalizeSurveyRow(
      spreadsheetRow(worksheet, rowNumber),
      rowNumber,
    );
    if (result.kind === "accepted") {
      accepted += 1;
      cities[result.row.city] = (cities[result.row.city] ?? 0) + 1;
    } else {
      quarantined += 1;
      reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
    }
  }

  return {
    sourceHashes: {
      [rblLoma2026Sources[0].id]: workbookSha256,
      [rblLoma2026Sources[1].id]: reportSha256,
    },
    workbook: {
      sheet: EXPECTED_SHEET,
      rows: dataRows,
      columns,
      cities,
    },
    eligibility: { accepted, quarantined, reasons },
    discrepancies: [
      {
        id: "workbook_report_variable_count",
        status: "blocked",
        workbookValue: 302,
        reportValue: 337,
        note: "The workbook and report describe different variable totals; no undocumented transformation is assumed.",
      },
      {
        id: "lagos_four_week_recall",
        status: "blocked",
        workbookValue: 72.1,
        reportValue: 54.9,
        note: "Four-week recall remains unavailable until the denominator or transformation is reconciled.",
      },
      {
        id: "weighting_method",
        status: "blocked",
        workbookValue: null,
        reportValue: null,
        note: "No reproducible weighting formula was supplied; published workbook aggregates are explicitly unweighted.",
      },
    ],
    privacy: {
      restrictedFieldsObserved: [
        "interviewer_name",
        "gps_location",
        "gps_latitude",
        "gps_longitude",
        "device_and_submission_metadata",
        "route_open_text",
        "area_open_text",
      ],
      restrictedFieldsPublished: [],
    },
  };
}

async function main(): Promise<void> {
  const workbookPath = requiredEnvironmentPath("RBL_LOMA_WORKBOOK_PATH");
  const reportPath = requiredEnvironmentPath("RBL_LOMA_REPORT_PATH");
  const stagingDirectory = path.resolve(
    process.env.RBL_LOMA_EVIDENCE_STAGING_DIR?.trim() ||
      ".local/evidence/rbl-loma-2026",
  );
  const audit = await auditSources({ workbookPath, reportPath });
  await writeJsonAtomic(path.join(stagingDirectory, "audit.json"), audit);
  process.stdout.write(
    `RBL/LOMA evidence audit passed: ${audit.eligibility.accepted} accepted, ${audit.eligibility.quarantined} quarantined.\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
