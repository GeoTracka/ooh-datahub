export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const monthLookup = new Map(monthNames.map((month, index) => [month.toLowerCase(), index + 1]));

export type SourcePeriod = {
  rawMonth: string | null;
  month: number | null;
  monthSpan: number[];
  kind: "month" | "combined_months" | "quarter_only" | "unparsed";
};

export function sourceText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : null;
}

export function normalizedText(value: unknown): string {
  return (sourceText(value) ?? "").toLowerCase();
}

export function parseLooseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = sourceText(value);
  if (!text || /^[-–—]+$/.test(text)) return null;
  const normalized = text.replace(/[,%\s]/g, "");
  if (!normalized || /^[-–—]+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInteger(value: unknown): number | null {
  const parsed = parseLooseNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

export function parseSourcePeriod(rawMonth: unknown): SourcePeriod {
  const label = sourceText(rawMonth);
  if (!label) {
    return { rawMonth: null, month: null, monthSpan: [], kind: "quarter_only" };
  }

  const direct = monthLookup.get(label.toLowerCase());
  if (direct) {
    return { rawMonth: label, month: direct, monthSpan: [direct], kind: "month" };
  }

  const parts = label.split("/").map((part) => sourceText(part)).filter((part): part is string => Boolean(part));
  if (parts.length > 1) {
    const months = parts.map((part) => monthLookup.get(part.toLowerCase()) ?? null);
    if (months.every((month): month is number => month !== null)) {
      return { rawMonth: label, month: null, monthSpan: months, kind: "combined_months" };
    }
  }

  return { rawMonth: label, month: null, monthSpan: [], kind: "unparsed" };
}

export function nonEmptyRowCount(rows: unknown[][], headerRows = 1): number {
  return rows.slice(headerRows).filter((row) => row.some((cell) => sourceText(cell) !== null)).length;
}

export function totalMismatch(
  left: number | null,
  right: number | null,
  reported: number | null,
  tolerance = 0.5,
): boolean {
  return left !== null && right !== null && reported !== null && Math.abs(left + right - reported) > tolerance;
}

export function stableNaturalKey(parts: unknown[]): string {
  return parts.map((part) => normalizedText(part)).join("|");
}
