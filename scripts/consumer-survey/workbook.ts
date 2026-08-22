import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import type { SurveySpreadsheetCell } from "@/server/survey/rblLoma2026";

export type LoadedConsumerSurveyWorkbook = {
  sourceSha256: string;
  sheetName: string;
  headers: string[];
  rows: SurveySpreadsheetCell[][];
};

function primitiveCellValue(value: unknown): SurveySpreadsheetCell {
  if (
    value === null || value === undefined || value instanceof Date ||
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  ) {
    return value;
  }
  return null;
}

function cellValue(cell: ExcelJS.Cell): SurveySpreadsheetCell {
  const direct = primitiveCellValue(cell.value);
  if (direct !== null || cell.value === null) return direct;
  const structured = cell.value as {
    result?: unknown;
    richText?: Array<{ text: string }>;
    text?: string;
  };
  const result = primitiveCellValue(structured.result);
  if (result !== null && result !== undefined) return result;
  if (structured.richText) return structured.richText.map((part) => part.text).join("");
  if (typeof structured.text === "string") return structured.text;
  return cell.text || null;
}

export async function loadConsumerSurveyWorkbook(input: {
  sourcePath: string;
  sheetName: string;
}): Promise<LoadedConsumerSurveyWorkbook> {
  const bytes = await readFile(input.sourcePath);
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const worksheet = workbook.getWorksheet(input.sheetName);
  if (!worksheet) throw new Error(`SURVEY_SHEET_MISSING:${input.sheetName}`);
  const columnCount = worksheet.actualColumnCount;
  const headers = Array.from({ length: columnCount }, (_, offset) => {
    const value = cellValue(worksheet.getRow(1).getCell(offset + 1));
    return value instanceof Date ? value.toISOString() : String(value ?? "");
  });
  const rows = Array.from({ length: Math.max(0, worksheet.actualRowCount - 1) }, (_, offset) => {
    const row = worksheet.getRow(offset + 2);
    return Array.from({ length: columnCount }, (_, columnOffset) =>
      cellValue(row.getCell(columnOffset + 1)),
    );
  });
  return { sourceSha256, sheetName: worksheet.name, headers, rows };
}
