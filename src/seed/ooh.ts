import type { OohBoardQualitySheetSpec, OohPlacementSheetSpec } from "./sourceCatalog";
import {
  parseInteger,
  parseLooseNumber,
  parseSourcePeriod,
  sourceText,
  stableNaturalKey,
} from "./normalize";

export type SeedQualityFlag =
  | "missing_address"
  | "missing_rate"
  | "unparsed_period"
  | "year_from_artifact_context";

export type SeedQuarantineRecord = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  reason: "invalid_year" | "invalid_row_shape";
  raw: unknown[];
};

export type OohObservation = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  sourceRecordId: string;
  canonicalStatus: "active" | "superseded";
  naturalKey: string;
  advertiser: string;
  nationalRegion: string | null;
  state: string;
  city: string;
  address: string | null;
  brand: string;
  category: string;
  boardType: string;
  formatCategory: string;
  classification: string;
  annualRateNgn: number | null;
  monthlyRateNgn: number | null;
  year: number;
  quarter: string;
  period: ReturnType<typeof parseSourcePeriod>;
  qualityFlags: SeedQualityFlag[];
};

export type OohBoardQualityObservation = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  sourceRecordId: string;
  naturalKey: string;
  company: string;
  state: string;
  city: string;
  address: string;
  brand: string;
  category: string;
  boardType: string;
  boardQuality: string;
  classification: string;
  annualRateNgn: number | null;
  monthlyRateNgn: number | null;
  year: number;
  quarter: string;
  period: ReturnType<typeof parseSourcePeriod>;
  qualityFlags: SeedQualityFlag[];
};

export type OohPlacementParseItem =
  | { kind: "record"; record: OohObservation }
  | { kind: "quarantine"; quarantine: SeedQuarantineRecord };

export type OohBoardQualityParseItem =
  | { kind: "record"; record: OohBoardQualityObservation }
  | { kind: "quarantine"; quarantine: SeedQuarantineRecord };

function placementColumns(spec: OohPlacementSheetSpec) {
  return spec.layout === "year-quarter-month"
    ? { year: 13, quarter: 14, month: 15 }
    : { year: 15, quarter: 13, month: 14 };
}

function requiredPlacementText(row: unknown[], index: number): string | null {
  return sourceText(row[index]);
}

export function parseOohPlacementRow(
  row: unknown[],
  sourceId: string,
  spec: OohPlacementSheetSpec,
  sourceRow: number,
): OohPlacementParseItem | null {
  if (!row.some((cell) => sourceText(cell) !== null)) return null;
  const columns = placementColumns(spec);
  const year = parseInteger(row[columns.year]);
  if (year === null || year < 1900 || year > 2100) {
    return {
      kind: "quarantine",
      quarantine: { sourceId, sheet: spec.sheet, sourceRow, reason: "invalid_year", raw: row },
    };
  }

  const advertiser = requiredPlacementText(row, 1);
  const state = requiredPlacementText(row, 3);
  const city = requiredPlacementText(row, 4);
  const brand = requiredPlacementText(row, 6);
  const category = requiredPlacementText(row, 7);
  const boardType = requiredPlacementText(row, 8);
  const formatCategory = requiredPlacementText(row, 9);
  const classification = requiredPlacementText(row, 10);
  const quarter = sourceText(row[columns.quarter]);

  if (!advertiser || !state || !city || !brand || !category || !boardType || !formatCategory || !classification || !quarter) {
    return {
      kind: "quarantine",
      quarantine: { sourceId, sheet: spec.sheet, sourceRow, reason: "invalid_row_shape", raw: row },
    };
  }

  const address = sourceText(row[5]);
  const annualRateNgn = parseLooseNumber(row[11]);
  const monthlyRateNgn = parseLooseNumber(row[12]);
  const period = parseSourcePeriod(row[columns.month]);
  const qualityFlags: SeedQualityFlag[] = [];
  if (!address) qualityFlags.push("missing_address");
  if (annualRateNgn === null || monthlyRateNgn === null) qualityFlags.push("missing_rate");
  if (period.kind === "unparsed") qualityFlags.push("unparsed_period");

  const nationalRegion = sourceText(row[2]);
  const naturalKey = stableNaturalKey([
    advertiser,
    nationalRegion,
    state,
    city,
    address,
    brand,
    category,
    boardType,
    formatCategory,
    classification,
    year,
    quarter,
    period.rawMonth,
    annualRateNgn,
    monthlyRateNgn,
  ]);

  return {
    kind: "record",
    record: {
      sourceId,
      sheet: spec.sheet,
      sourceRow,
      sourceRecordId: `${sourceId}:${spec.sheet}:${sourceRow}`,
      canonicalStatus: spec.supersedeYears?.includes(year) ? "superseded" : "active",
      naturalKey,
      advertiser,
      nationalRegion,
      state,
      city,
      address,
      brand,
      category,
      boardType,
      formatCategory,
      classification,
      annualRateNgn,
      monthlyRateNgn,
      year,
      quarter,
      period,
      qualityFlags,
    },
  };
}

export function* iterateOohPlacementRows(
  rows: unknown[][],
  sourceId: string,
  spec: OohPlacementSheetSpec,
): Generator<OohPlacementParseItem> {
  for (let index = 1; index < rows.length; index += 1) {
    const item = parseOohPlacementRow(rows[index], sourceId, spec, index + 1);
    if (item) yield item;
  }
}

export function parseOohPlacementRows(
  rows: unknown[][],
  sourceId: string,
  spec: OohPlacementSheetSpec,
): { records: OohObservation[]; quarantine: SeedQuarantineRecord[] } {
  const records: OohObservation[] = [];
  const quarantine: SeedQuarantineRecord[] = [];
  for (const item of iterateOohPlacementRows(rows, sourceId, spec)) {
    if (item.kind === "record") records.push(item.record);
    else quarantine.push(item.quarantine);
  }
  return { records, quarantine };
}

export function parseOohBoardQualityRow(
  row: unknown[],
  sourceId: string,
  spec: OohBoardQualitySheetSpec,
  sourceRow: number,
): OohBoardQualityParseItem | null {
  if (!row.some((cell) => sourceText(cell) !== null)) return null;
  const company = sourceText(row[1]);
  const state = sourceText(row[3]);
  const city = sourceText(row[4]);
  const address = sourceText(row[5]);
  const brand = sourceText(row[6]);
  const category = sourceText(row[7]);
  const boardType = sourceText(row[8]);
  const boardQuality = sourceText(row[9]);
  const classification = sourceText(row[10]);
  const quarter = sourceText(row[14]);
  if (!company || !state || !city || !address || !brand || !category || !boardType || !boardQuality || !classification || !quarter) {
    return {
      kind: "quarantine",
      quarantine: { sourceId, sheet: spec.sheet, sourceRow, reason: "invalid_row_shape", raw: row },
    };
  }

  const annualRateNgn = parseLooseNumber(row[11]);
  const monthlyRateNgn = parseLooseNumber(row[12]);
  const period = parseSourcePeriod(row[15]);
  const qualityFlags: SeedQualityFlag[] = ["year_from_artifact_context"];
  if (annualRateNgn === null || monthlyRateNgn === null) qualityFlags.push("missing_rate");
  if (period.kind === "unparsed") qualityFlags.push("unparsed_period");

  return {
    kind: "record",
    record: {
      sourceId,
      sheet: spec.sheet,
      sourceRow,
      sourceRecordId: `${sourceId}:${spec.sheet}:${sourceRow}`,
      naturalKey: stableNaturalKey([
        company,
        state,
        city,
        address,
        brand,
        category,
        boardType,
        boardQuality,
        classification,
        spec.contextYear,
        quarter,
        period.rawMonth,
      ]),
      company,
      state,
      city,
      address,
      brand,
      category,
      boardType,
      boardQuality,
      classification,
      annualRateNgn,
      monthlyRateNgn,
      year: spec.contextYear,
      quarter,
      period,
      qualityFlags,
    },
  };
}

export function* iterateOohBoardQualityRows(
  rows: unknown[][],
  sourceId: string,
  spec: OohBoardQualitySheetSpec,
): Generator<OohBoardQualityParseItem> {
  for (let index = 1; index < rows.length; index += 1) {
    const item = parseOohBoardQualityRow(rows[index], sourceId, spec, index + 1);
    if (item) yield item;
  }
}

export function parseOohBoardQualityRows(
  rows: unknown[][],
  sourceId: string,
  spec: OohBoardQualitySheetSpec,
): { records: OohBoardQualityObservation[]; quarantine: SeedQuarantineRecord[] } {
  const records: OohBoardQualityObservation[] = [];
  const quarantine: SeedQuarantineRecord[] = [];
  for (const item of iterateOohBoardQualityRows(rows, sourceId, spec)) {
    if (item.kind === "record") records.push(item.record);
    else quarantine.push(item.quarantine);
  }
  return { records, quarantine };
}
