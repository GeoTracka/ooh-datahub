import { describe, expect, it } from "vitest";
import { parseOohBoardQualityRows, parseOohPlacementRows } from "@/seed/ooh";
import type { OohBoardQualitySheetSpec, OohPlacementSheetSpec } from "@/seed/sourceCatalog";

const header = Array.from({ length: 16 }, (_, index) => `H${index}`);

function placementRow(overrides: Record<number, unknown> = {}): unknown[] {
  const row: unknown[] = [
    1,
    "Acme",
    "South West",
    "Lagos",
    "Lagos",
    "Airport Road",
    "Demo Brand",
    "Beverage",
    "48 Sheet",
    "Large Format",
    "Static",
    1_200_000,
    100_000,
    2023,
    "Q3",
    "August/September",
  ];
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value;
  return row;
}

describe("OOH source normalization", () => {
  it("marks the partial historical 2023 source as superseded and preserves combined periods", () => {
    const spec: OohPlacementSheetSpec = {
      sheet: "Sheet1",
      layout: "year-quarter-month",
      expectedDataRows: 1,
      supersedeYears: [2023],
    };
    const result = parseOohPlacementRows([header, placementRow()], "historical", spec);
    expect(result.quarantine).toHaveLength(0);
    expect(result.records[0]).toMatchObject({
      canonicalStatus: "superseded",
      year: 2023,
      period: { kind: "combined_months", monthSpan: [8, 9] },
    });
  });

  it("quarantines a shifted row rather than guessing an invalid year", () => {
    const spec: OohPlacementSheetSpec = {
      sheet: "FY 24 - Q1 25",
      layout: "quarter-month-year",
      expectedDataRows: 1,
    };
    const shifted = placementRow({ 13: "Q2", 14: "May", 15: 100_000 });
    const result = parseOohPlacementRows([header, shifted], "fy24", spec);
    expect(result.records).toHaveLength(0);
    expect(result.quarantine[0]).toMatchObject({ reason: "invalid_year", sourceRow: 2 });
  });

  it("keeps board quality in a separate artifact-context dataset", () => {
    const spec: OohBoardQualitySheetSpec = {
      sheet: "NB SOV",
      expectedDataRows: 1,
      contextYear: 2023,
    };
    const row: unknown[] = [
      1,
      "Media Co",
      null,
      "Lagos",
      "Lagos",
      "Airport Road",
      "Demo Brand",
      "Beverage",
      "48 Sheet",
      "Good",
      "Static",
      1_200_000,
      100_000,
      null,
      "Q1",
      "January",
    ];
    const result = parseOohBoardQualityRows([header, row], "fy23", spec);
    expect(result.records[0]).toMatchObject({
      company: "Media Co",
      boardQuality: "Good",
      year: 2023,
      qualityFlags: ["year_from_artifact_context"],
    });
  });
});
