import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { EvidenceAnswer } from "@/server/evidence/repository";
import { evidenceReportData } from "@/server/exports/data";
import { buildReportCsv } from "@/server/exports/csv";
import { buildReportWorkbook } from "@/server/exports/workbook";

const artifact = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  saveState: "draft" as const,
  payload: {
    type: "evidence" as const,
    version: 1 as const,
    factIds: ["fact-1", "fact-2"],
    excerptIds: [],
  },
};

const answers: EvidenceAnswer[] = [
  {
    factId: "fact-1",
    metricId: "journey_attention_high",
    label: "High attention while travelling",
    value: 60,
    unit: "percent",
    numerator: 30,
    denominator: 50,
    respondentBase: 50,
    geography: "lagos",
    segment: { city: "lagos" },
    period: "2026-05",
    caveat: "Unweighted study sample; not population reach.",
    citation: {
      sourceId: "rbl-loma-ooh-penetration-databook-2026-r1",
      sha256: "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
      workbookField: "Q10",
      page: null,
    },
  },
  {
    factId: "fact-2",
    metricId: "creative_trigger_local_language",
    label: "Local language attracts attention",
    value: 42.5,
    unit: "percent",
    numerator: 34,
    denominator: 80,
    respondentBase: 80,
    geography: "lagos",
    segment: { city: "lagos", ageBand: "25-34" },
    period: "2026-05",
    caveat: "Unweighted study sample; not population reach.",
    citation: {
      sourceId: "rbl-loma-ooh-penetration-databook-2026-r1",
      sha256: "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
      workbookField: "Q27",
      page: 44,
    },
  },
];

describe("governed evidence reports", () => {
  it("includes approved facts, bases, citations and caveats in XLSX", async () => {
    const bytes = await buildReportWorkbook(evidenceReportData(artifact, answers));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const findings = workbook.getWorksheet("Findings");

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Findings",
      "Sources & limits",
    ]);
    expect(findings?.getCell("A2").value).toBe("High attention while travelling");
    expect(findings?.getCell("D2").value).toBe(50);
    expect(findings?.getCell("I2").value).toBe("Q10");
    expect(findings?.getCell("K2").value).toContain("not population reach");
  });

  it("refuses an incomplete fact set", () => {
    expect(() => evidenceReportData(artifact, answers.slice(0, 1))).toThrow(
      "EVIDENCE_EXPORT_INCOMPLETE:fact-2",
    );
  });

  it("escapes formula-like evidence labels in CSV", () => {
    const csv = buildReportCsv(
      evidenceReportData(artifact, [
        { ...answers[0], label: "=HYPERLINK(\"bad\")" },
        answers[1],
      ]),
    );

    expect(csv).toContain("Finding,Value,Unit,Respondent base");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("Q27");
  });
});
