import "server-only";

import { createHash } from "node:crypto";
import type { SurveySourceSpec } from "@/survey/contracts";

export const RBL_LOMA_2026_SOURCE: SurveySourceSpec = {
  id: "rbl-loma-nigeria-ooh-consumer-penetration-2026-r1",
  fileName: "RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx",
  sha256: "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
  sheetName: "Nigeria OOH 3",
  expectedDataRows: 1_844,
  expectedColumns: 302,
  headerSha256: "8ef2dc4ede086ba1e7b28e78f9c413eeea4463ee658b9f394dfbc7b955d12acc",
  collectionPeriod: { start: "2026-05-20", end: "2026-06-03" },
  authority: "solution_owner_authoritative",
  cleaningStatus: "authoritative_cleaned_final",
  commercialUse: "owner_authorized_unrestricted",
  decisionUse: "context_only",
};

export type RblLoma2026StructureFailure =
  | "SOURCE_SHA256_MISMATCH"
  | "SHEET_NAME_MISMATCH"
  | "COLUMN_COUNT_MISMATCH"
  | "HEADER_SHA256_MISMATCH"
  | "DATA_ROW_COUNT_MISMATCH";

export function rblLoma2026HeaderSha256(headers: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(headers)).digest("hex");
}

export function verifyRblLoma2026Structure(input: {
  sourceSha256: string;
  sheetName: string;
  headers: readonly string[];
  dataRowCount: number;
}): {
  valid: boolean;
  failures: RblLoma2026StructureFailure[];
  headerSha256: string;
} {
  const failures: RblLoma2026StructureFailure[] = [];
  const headerSha256 = rblLoma2026HeaderSha256(input.headers);
  if (input.sourceSha256 !== RBL_LOMA_2026_SOURCE.sha256) failures.push("SOURCE_SHA256_MISMATCH");
  if (input.sheetName !== RBL_LOMA_2026_SOURCE.sheetName) failures.push("SHEET_NAME_MISMATCH");
  if (input.headers.length !== RBL_LOMA_2026_SOURCE.expectedColumns) failures.push("COLUMN_COUNT_MISMATCH");
  if (headerSha256 !== RBL_LOMA_2026_SOURCE.headerSha256) failures.push("HEADER_SHA256_MISMATCH");
  if (input.dataRowCount !== RBL_LOMA_2026_SOURCE.expectedDataRows) failures.push("DATA_ROW_COUNT_MISMATCH");
  return { valid: failures.length === 0, failures, headerSha256 };
}
