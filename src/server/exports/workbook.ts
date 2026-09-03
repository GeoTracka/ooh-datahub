import ExcelJS from "exceljs";

import type {
  CampaignReportData,
  EvidenceReportData,
  ReportData,
} from "@/server/exports/contracts";

const BRAND = "145C54";
const BRAND_DARK = "0F4942";
const BRAND_LIGHT = "DEEBE7";
const CANVAS = "F6F5F2";
const TEXT = "17231F";
const MUTED = "68726D";
const BORDER = "D9E0DD";
const WARNING = "FFF3E2";

function titleRow(sheet: ExcelJS.Worksheet, title: string, lastColumn: string) {
  sheet.mergeCells(`A1:${lastColumn}1`);
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_DARK}` } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 34;
}

function header(row: ExcelJS.Row) {
  row.font = { name: "Aptos", size: 10, bold: true, color: { argb: `FF${TEXT}` } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_LIGHT}` } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 30;
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: `FF${BRAND}` } } };
  });
}

function baseSheet(sheet: ExcelJS.Worksheet) {
  sheet.properties.defaultRowHeight = 20;
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function setColumns(
  sheet: ExcelJS.Worksheet,
  columns: Array<{ key: string; width: number }>,
) {
  columns.forEach((column, index) => {
    const target = sheet.getColumn(index + 1);
    target.key = column.key;
    target.width = column.width;
    target.font = { name: "Aptos", size: 10, color: { argb: `FF${TEXT}` } };
    target.alignment = { vertical: "top", wrapText: true };
  });
}

function campaignSummary(workbook: ExcelJS.Workbook, report: CampaignReportData) {
  const sheet = workbook.addWorksheet("Summary");
  baseSheet(sheet);
  setColumns(sheet, [
    { key: "label", width: 24 },
    { key: "value", width: 54 },
    { key: "note", width: 28 },
    { key: "detail", width: 28 },
  ]);
  titleRow(sheet, report.title, "D");
  sheet.getCell("A2").value = `Campaign plan report · Revision ${report.revision}`;
  sheet.getCell("A2").font = { bold: true, color: { argb: `FF${BRAND}` } };
  const rows: Array<[string, string | number]> = [
    ["Campaign", report.brief.productName],
    ["Description", report.brief.productDescription],
    ["Audience", report.brief.targetAudience],
    ["Objective", report.brief.objective.replaceAll("_", " ")],
    ["Sector", report.brief.sector.replaceAll("_", " ")],
    ["Budget", report.brief.budgetNgn],
    ["Flight", `${report.brief.flightStart} to ${report.brief.flightEnd}`],
    ["Time of day", report.brief.daypart.replaceAll("_", " ")],
    ["Selected approach", report.options.find((item) => item.id === report.selectedOptionId)?.title ?? "No approach selected"],
  ];
  rows.forEach(([label, value], index) => {
    const row = index + 4;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true, color: { argb: `FF${MUTED}` } };
    sheet.getCell(row, 2).value = value;
    sheet.getCell(row, 2).alignment = { wrapText: true, vertical: "top" };
  });
  sheet.getCell("B9").numFmt = '[$₦-en-NG]#,##0';
  sheet.getCell("A15").value = "Planning status";
  sheet.getCell("A15").font = { bold: true, color: { argb: `FF${BRAND}` } };
  sheet.getCell("B15").value = report.saveState === "saved" ? "Saved draft, not booked" : "Draft, not booked";
  sheet.getCell("B15").fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${WARNING}` } };
  return sheet;
}

function campaignOptions(workbook: ExcelJS.Workbook, report: CampaignReportData) {
  const sheet = workbook.addWorksheet("Plan options");
  baseSheet(sheet);
  setColumns(sheet, [
    { key: "approach", width: 22 },
    { key: "cost", width: 16 },
    { key: "delivery", width: 18 },
    { key: "fit", width: 15 },
    { key: "grade", width: 14 },
    { key: "areas", width: 12 },
    { key: "locations", width: 15 },
    { key: "zoneIds", width: 34 },
    { key: "siteIds", width: 42 },
    { key: "tradeoffs", width: 48 },
    { key: "selected", width: 12 },
  ]);
  sheet.addRow([
    "Approach",
    "Cost (NGN)",
    "Possible ad views",
    "Brief match /100",
    "Evidence grade",
    "Areas",
    "Media locations",
    "Area IDs",
    "Media location IDs",
    "Main trade-offs",
    "Selected",
  ]);
  header(sheet.getRow(1));
  report.options.forEach((option) => {
    sheet.addRow([
      option.title,
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
    ]);
  });
  sheet.getColumn(2).numFmt = '[$₦-en-NG]#,##0';
  sheet.getColumn(3).numFmt = "#,##0";
  sheet.getColumn(4).numFmt = "0";
  sheet.autoFilter = { from: "A1", to: "K1" };
  sheet.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  return sheet;
}

function campaignLimits(workbook: ExcelJS.Workbook, report: CampaignReportData) {
  const sheet = workbook.addWorksheet("Sources & limits");
  baseSheet(sheet);
  setColumns(sheet, [
    { key: "item", width: 34 },
    { key: "detail", width: 92 },
  ]);
  titleRow(sheet, "Sources, assumptions and limits", "B");
  sheet.getCell("A3").value = "Status";
  sheet.getCell("A3").font = { bold: true, color: { argb: `FF${BRAND}` } };
  sheet.getCell("A4").value = "Draft, not booked";
  sheet.getCell("B4").value = "Media availability and final rates need confirmation before booking.";
  let row = 6;
  sheet.getCell(row, 1).value = "Assumptions";
  sheet.getCell(row, 1).font = { bold: true, color: { argb: `FF${BRAND}` } };
  report.assumptions.forEach((value) => {
    row += 1;
    sheet.getCell(row, 1).value = `Assumption ${row - 6}`;
    sheet.getCell(row, 2).value = value;
  });
  row += 2;
  sheet.getCell(row, 1).value = "Important limits";
  sheet.getCell(row, 1).font = { bold: true, color: { argb: `FF${BRAND}` } };
  report.limitations.forEach((value, index) => {
    sheet.getCell(row + index + 1, 1).value = `Limit ${index + 1}`;
    sheet.getCell(row + index + 1, 2).value = value;
  });
  row += report.limitations.length + 2;
  sheet.getCell(row, 1).value = "Artifact";
  sheet.getCell(row, 2).value = `${report.artifactId} · revision ${report.revision}`;
  return sheet;
}

function evidenceSummary(workbook: ExcelJS.Workbook, report: EvidenceReportData) {
  const sheet = workbook.addWorksheet("Summary");
  baseSheet(sheet);
  setColumns(sheet, [
    { key: "label", width: 28 },
    { key: "value", width: 80 },
    { key: "detail", width: 24 },
  ]);
  titleRow(sheet, report.title, "C");
  sheet.getCell("A2").value = `Governed evidence report · Revision ${report.revision}`;
  sheet.getCell("A2").font = { bold: true, color: { argb: `FF${BRAND}` } };
  sheet.getCell("A4").value = "Approved findings";
  sheet.getCell("B4").value = report.facts.length;
  sheet.getCell("A5").value = "Coverage";
  sheet.getCell("B5").value = [...new Set(report.facts.map((fact) => fact.geography))].join(", ");
  sheet.getCell("A7").value = "Interpretation";
  sheet.getCell("B7").value = report.limitations[0];
  sheet.getCell("B7").alignment = { wrapText: true };
  return sheet;
}

function evidenceFindings(workbook: ExcelJS.Workbook, report: EvidenceReportData) {
  const sheet = workbook.addWorksheet("Findings");
  baseSheet(sheet);
  setColumns(sheet, [
    { key: "finding", width: 42 },
    { key: "value", width: 12 },
    { key: "unit", width: 16 },
    { key: "base", width: 18 },
    { key: "geography", width: 16 },
    { key: "segment", width: 34 },
    { key: "period", width: 14 },
    { key: "source", width: 42 },
    { key: "field", width: 16 },
    { key: "page", width: 14 },
    { key: "caveat", width: 52 },
  ]);
  sheet.addRow([
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
  ]);
  header(sheet.getRow(1));
  report.facts.forEach((fact) => {
    sheet.addRow([
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
    ]);
  });
  sheet.getColumn(2).numFmt = "0.0";
  sheet.getColumn(4).numFmt = "0";
  sheet.autoFilter = { from: "A1", to: "K1" };
  sheet.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  return sheet;
}

function evidenceLimits(workbook: ExcelJS.Workbook, report: EvidenceReportData) {
  const sheet = workbook.addWorksheet("Sources & limits");
  baseSheet(sheet);
  setColumns(sheet, [
    { key: "item", width: 34 },
    { key: "detail", width: 92 },
  ]);
  titleRow(sheet, "Sources and limits", "B");
  sheet.addRow([]);
  sheet.addRow(["Artifact", `${report.artifactId} · revision ${report.revision}`]);
  report.limitations.forEach((value, index) => {
    sheet.addRow([`Limit ${index + 1}`, value]);
  });
  const sources = new Map<string, string>();
  report.facts.forEach((fact) => sources.set(fact.citation.sourceId, fact.citation.sha256));
  sheet.addRow([]);
  sheet.addRow(["Approved sources", "SHA-256"]);
  header(sheet.getRow(sheet.rowCount));
  sources.forEach((sha256, sourceId) => sheet.addRow([sourceId, sha256]));
  return sheet;
}

export async function buildReportWorkbook(report: ReportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Brainpad OOH Planner";
  workbook.company = "Brainpad";
  workbook.created = new Date(0);
  workbook.modified = new Date(0);
  workbook.calcProperties.fullCalcOnLoad = true;
  if (report.kind === "campaign_plan") {
    campaignSummary(workbook, report);
    campaignOptions(workbook, report);
    campaignLimits(workbook, report);
  } else {
    evidenceSummary(workbook, report);
    evidenceFindings(workbook, report);
    evidenceLimits(workbook, report);
  }
  workbook.worksheets.forEach((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (!cell.font) cell.font = { name: "Aptos", size: 10, color: { argb: `FF${TEXT}` } };
        if (!cell.alignment) cell.alignment = { vertical: "top", wrapText: true };
      });
    });
  });
  const bytes = await workbook.xlsx.writeBuffer();
  return bytes;
}
