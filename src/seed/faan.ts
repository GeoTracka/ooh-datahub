import type {
  FaanFlowSectionSpec,
  FaanWeightSectionSpec,
} from "./sourceCatalog";
import {
  monthNames,
  parseLooseNumber,
  sourceText,
  stableNaturalKey,
  totalMismatch,
} from "./normalize";
import type { SeedQuarantineRecord } from "./ooh";

export type FaanQualityFlag =
  | "arrival_missing"
  | "departure_missing"
  | "reported_total_missing"
  | "reported_total_mismatch"
  | "import_missing"
  | "export_missing"
  | "annual_total_mismatch";

type RawScalar = string | number | boolean | null;

export type FaanMonthlyFlowRecord = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  sourceRecordId: string;
  naturalKey: string;
  year: number;
  month: number;
  monthLabel: string;
  metric: "passenger" | "aircraft";
  scope: "domestic" | "international" | "hajj";
  airportStateLabel: string;
  airportName: string | null;
  arrivals: number | null;
  departures: number | null;
  reportedTotal: number | null;
  derivedTotal: number | null;
  rawArrivals: RawScalar;
  rawDepartures: RawScalar;
  rawReportedTotal: RawScalar;
  qualityFlags: FaanQualityFlag[];
};

export type FaanAnnualFlowRecord = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  sourceRecordId: string;
  naturalKey: string;
  year: number;
  metric: "passenger" | "aircraft";
  scope: "domestic" | "international" | "hajj";
  airportStateLabel: string;
  airportName: string | null;
  arrivals: number | null;
  departures: number | null;
  reportedTotal: number | null;
  derivedTotal: number | null;
  priorYearTotal: number | null;
  growthPercent: number | null;
  growthDifference: number | null;
  qualityFlags: FaanQualityFlag[];
};

export type FaanMonthlyWeightRecord = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  sourceRecordId: string;
  naturalKey: string;
  year: number;
  month: number;
  monthLabel: string;
  metric: "cargo" | "mail";
  airportLabel: string;
  unit: "kg";
  imports: number | null;
  exports: number | null;
  reportedTotal: number | null;
  derivedTotal: number | null;
  rawImports: RawScalar;
  rawExports: RawScalar;
  rawReportedTotal: RawScalar;
  qualityFlags: FaanQualityFlag[];
};

export type FaanAnnualWeightRecord = {
  sourceId: string;
  sheet: string;
  sourceRow: number;
  sourceRecordId: string;
  naturalKey: string;
  year: number;
  metric: "cargo" | "mail";
  airportLabel: string;
  unit: "kg";
  imports: number | null;
  exports: number | null;
  reportedTotal: number | null;
  derivedTotal: number | null;
  priorYearTotal: number | null;
  growthPercent: number | null;
  qualityFlags: FaanQualityFlag[];
};

function rawScalar(value: unknown): RawScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function derivedTotal(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left + right;
}

function flowQualityFlags(
  arrivals: number | null,
  departures: number | null,
  reportedTotal: number | null,
  mismatchFlag: FaanQualityFlag,
): FaanQualityFlag[] {
  const flags: FaanQualityFlag[] = [];
  if (arrivals === null) flags.push("arrival_missing");
  if (departures === null) flags.push("departure_missing");
  if (reportedTotal === null) flags.push("reported_total_missing");
  if (totalMismatch(arrivals, departures, reportedTotal)) flags.push(mismatchFlag);
  return flags;
}

function weightQualityFlags(
  imports: number | null,
  exports: number | null,
  reportedTotal: number | null,
  mismatchFlag: FaanQualityFlag,
  reportedExpected = true,
): FaanQualityFlag[] {
  const flags: FaanQualityFlag[] = [];
  if (imports === null) flags.push("import_missing");
  if (exports === null) flags.push("export_missing");
  if (reportedExpected && reportedTotal === null) flags.push("reported_total_missing");
  if (reportedExpected && totalMismatch(imports, exports, reportedTotal)) flags.push(mismatchFlag);
  return flags;
}

export function parseFaanFlowSection(
  rows: unknown[][],
  sourceId: string,
  year: number,
  spec: FaanFlowSectionSpec,
): {
  monthly: FaanMonthlyFlowRecord[];
  annual: FaanAnnualFlowRecord[];
  quarantine: SeedQuarantineRecord[];
} {
  const monthly: FaanMonthlyFlowRecord[] = [];
  const annual: FaanAnnualFlowRecord[] = [];
  const quarantine: SeedQuarantineRecord[] = [];

  for (let sourceRow = spec.rowStart; sourceRow <= spec.rowEnd; sourceRow += 1) {
    const row = rows[sourceRow - 1] ?? [];
    const airportStateLabel = sourceText(row[spec.airportStateColumn]);
    const airportName = spec.airportNameColumn === null
      ? null
      : sourceText(row[spec.airportNameColumn]);

    if (!airportStateLabel && !airportName) {
      quarantine.push({ sourceId, sheet: spec.sheet, sourceRow, reason: "invalid_row_shape", raw: row });
      continue;
    }

    const stateLabel = airportStateLabel ?? airportName ?? "UNKNOWN";
    const recordIdentity = `${sourceId}:${spec.sheet}:${sourceRow}:${spec.metric}:${spec.scope}`;

    monthNames.forEach((monthLabel, monthIndex) => {
      const start = spec.monthStartColumn + monthIndex * 3;
      const arrivals = parseLooseNumber(row[start]);
      const departures = parseLooseNumber(row[start + 1]);
      const reportedTotal = parseLooseNumber(row[start + 2]);
      const month = monthIndex + 1;

      monthly.push({
        sourceId,
        sheet: spec.sheet,
        sourceRow,
        sourceRecordId: `${recordIdentity}:month:${month}`,
        naturalKey: stableNaturalKey([
          sourceId,
          spec.sheet,
          sourceRow,
          spec.metric,
          spec.scope,
          year,
          month,
        ]),
        year,
        month,
        monthLabel,
        metric: spec.metric,
        scope: spec.scope,
        airportStateLabel: stateLabel,
        airportName,
        arrivals,
        departures,
        reportedTotal,
        derivedTotal: derivedTotal(arrivals, departures),
        rawArrivals: rawScalar(row[start]),
        rawDepartures: rawScalar(row[start + 1]),
        rawReportedTotal: rawScalar(row[start + 2]),
        qualityFlags: flowQualityFlags(arrivals, departures, reportedTotal, "reported_total_mismatch"),
      });
    });

    const annualStart = spec.monthStartColumn + 36;
    const arrivals = parseLooseNumber(row[annualStart]);
    const departures = parseLooseNumber(row[annualStart + 1]);
    const reportedTotal = parseLooseNumber(row[annualStart + 2]);
    const priorYearTotal = parseLooseNumber(row[annualStart + 3]);
    const growthPercent = parseLooseNumber(row[annualStart + 4]);
    const growthDifference = parseLooseNumber(row[annualStart + 5]);

    annual.push({
      sourceId,
      sheet: spec.sheet,
      sourceRow,
      sourceRecordId: `${recordIdentity}:annual`,
      naturalKey: stableNaturalKey([
        sourceId,
        spec.sheet,
        sourceRow,
        spec.metric,
        spec.scope,
        year,
        "annual",
      ]),
      year,
      metric: spec.metric,
      scope: spec.scope,
      airportStateLabel: stateLabel,
      airportName,
      arrivals,
      departures,
      reportedTotal,
      derivedTotal: derivedTotal(arrivals, departures),
      priorYearTotal,
      growthPercent,
      growthDifference,
      qualityFlags: flowQualityFlags(arrivals, departures, reportedTotal, "annual_total_mismatch"),
    });
  }

  return { monthly, annual, quarantine };
}

export function parseFaanWeightSection(
  rows: unknown[][],
  sourceId: string,
  year: number,
  spec: FaanWeightSectionSpec,
): {
  monthly: FaanMonthlyWeightRecord[];
  annual: FaanAnnualWeightRecord[];
  quarantine: SeedQuarantineRecord[];
} {
  const monthly: FaanMonthlyWeightRecord[] = [];
  const annual: FaanAnnualWeightRecord[] = [];
  const quarantine: SeedQuarantineRecord[] = [];

  for (let sourceRow = spec.rowStart; sourceRow <= spec.rowEnd; sourceRow += 1) {
    const row = rows[sourceRow - 1] ?? [];
    const airportLabel = sourceText(row[spec.airportColumn]);
    if (!airportLabel) {
      quarantine.push({ sourceId, sheet: spec.sheet, sourceRow, reason: "invalid_row_shape", raw: row });
      continue;
    }

    const recordIdentity = `${sourceId}:${spec.sheet}:${sourceRow}:${spec.metric}`;

    spec.monthStartColumns.forEach((start, monthIndex) => {
      const nextStart = monthIndex < spec.monthStartColumns.length - 1
        ? spec.monthStartColumns[monthIndex + 1]
        : spec.annualStartColumn;
      const hasReportedTotal = nextStart - start >= 3;
      const imports = parseLooseNumber(row[start]);
      const exports = parseLooseNumber(row[start + 1]);
      const reportedTotal = hasReportedTotal ? parseLooseNumber(row[start + 2]) : null;
      const month = monthIndex + 1;

      monthly.push({
        sourceId,
        sheet: spec.sheet,
        sourceRow,
        sourceRecordId: `${recordIdentity}:month:${month}`,
        naturalKey: stableNaturalKey([
          sourceId,
          spec.sheet,
          sourceRow,
          spec.metric,
          year,
          month,
        ]),
        year,
        month,
        monthLabel: monthNames[monthIndex],
        metric: spec.metric,
        airportLabel,
        unit: "kg",
        imports,
        exports,
        reportedTotal,
        derivedTotal: derivedTotal(imports, exports),
        rawImports: rawScalar(row[start]),
        rawExports: rawScalar(row[start + 1]),
        rawReportedTotal: hasReportedTotal ? rawScalar(row[start + 2]) : null,
        qualityFlags: weightQualityFlags(imports, exports, reportedTotal, "reported_total_mismatch", hasReportedTotal),
      });
    });

    const annualStart = spec.annualStartColumn;
    const imports = parseLooseNumber(row[annualStart]);
    const exports = parseLooseNumber(row[annualStart + 1]);
    const reportedTotal = parseLooseNumber(row[annualStart + 2]);
    const priorYearTotal = parseLooseNumber(row[annualStart + 3]);
    const growthPercent = parseLooseNumber(row[annualStart + 4]);

    annual.push({
      sourceId,
      sheet: spec.sheet,
      sourceRow,
      sourceRecordId: `${recordIdentity}:annual`,
      naturalKey: stableNaturalKey([
        sourceId,
        spec.sheet,
        sourceRow,
        spec.metric,
        year,
        "annual",
      ]),
      year,
      metric: spec.metric,
      airportLabel,
      unit: "kg",
      imports,
      exports,
      reportedTotal,
      derivedTotal: derivedTotal(imports, exports),
      priorYearTotal,
      growthPercent,
      qualityFlags: weightQualityFlags(imports, exports, reportedTotal, "annual_total_mismatch"),
    });
  }

  return { monthly, annual, quarantine };
}
