import type { ReportData } from "@/server/exports/contracts";

function safeText(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  const text = typeof value === "string" ? safeText(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: Array<Array<string | number | null>>) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function buildReportCsv(report: ReportData) {
  if (report.kind === "campaign_plan") {
    return csv([
      [
        "Approach",
        "Style",
        "Cost NGN",
        "Possible ad views",
        "Brief match /100",
        "Evidence grade",
        "Areas",
        "Media locations",
        "Area IDs",
        "Media location IDs",
        "Trade-offs",
        "Selected",
        "Artifact revision",
      ],
      ...report.options.map((option) => [
        option.title,
        option.style,
        option.candidate.costNgn,
        option.candidate.deliveryRaw,
        option.candidate.planningFit,
        option.candidate.evidenceGrade,
        option.candidate.zoneIds.length,
        option.candidate.siteIds.length,
        option.candidate.zoneIds.join(" | "),
        option.candidate.siteIds.join(" | "),
        option.tradeoffs.join(" | "),
        option.id === report.selectedOptionId ? "Yes" : "No",
        report.revision,
      ]),
    ]);
  }
  return csv([
    [
      "Finding",
      "Value",
      "Unit",
      "Respondent base",
      "Geography",
      "Segment",
      "Period",
      "Source",
      "Source field",
      "Report page",
      "Caveat",
      "Artifact revision",
    ],
    ...report.facts.map((fact) => [
      fact.label,
      fact.value,
      fact.unit,
      fact.respondentBase,
      fact.geography,
      Object.entries(fact.segment)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" | "),
      fact.period,
      fact.citation.sourceId,
      fact.citation.workbookField,
      fact.citation.page,
      fact.caveat,
      report.revision,
    ]),
  ]);
}
