import { describe, expect, it } from "vitest";
import { parseFaanFlowSection, parseFaanWeightSection } from "@/seed/faan";
import type { FaanFlowSectionSpec, FaanWeightSectionSpec } from "@/seed/sourceCatalog";

describe("FAAN source normalization", () => {
  it("keeps directional values, derives totals and flags source-total disagreement", () => {
    const rows: unknown[][] = Array.from({ length: 12 }, () => []);
    const row = Array<unknown>(48).fill(null);
    row[2] = "LAGOS";
    row[3] = "MMIA";
    for (let month = 0; month < 12; month += 1) {
      const start = 6 + month * 3;
      row[start] = month === 0 ? "487, 048" : 10;
      row[start + 1] = 50;
      row[start + 2] = month === 0 ? 999 : 60;
    }
    row[42] = 120;
    row[43] = 80;
    row[44] = 200;
    rows[9] = row;

    const spec: FaanFlowSectionSpec = {
      sheet: "Sheet1",
      metric: "passenger",
      scope: "domestic",
      rowStart: 10,
      rowEnd: 10,
      airportStateColumn: 2,
      airportNameColumn: 3,
      monthStartColumn: 6,
    };
    const result = parseFaanFlowSection(rows, "faan-2025", 2025, spec);
    expect(result.monthly[0]).toMatchObject({
      arrivals: 487_048,
      departures: 50,
      reportedTotal: 999,
      derivedTotal: 487_098,
    });
    expect(result.monthly[0].qualityFlags).toContain("reported_total_mismatch");
    expect(result.annual[0].qualityFlags).not.toContain("annual_total_mismatch");
  });

  it("does not pretend an unreported cargo monthly total is missing data", () => {
    const rows: unknown[][] = Array.from({ length: 10 }, () => []);
    const row = Array<unknown>(32).fill(null);
    row[0] = "LAGOS";
    const starts = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
    for (const start of starts) {
      row[start] = 100;
      row[start + 1] = 50;
    }
    row[25] = 1200;
    row[26] = 600;
    row[27] = 1800;
    rows[8] = row;

    const spec: FaanWeightSectionSpec = {
      sheet: "Sheet3",
      metric: "cargo",
      rowStart: 9,
      rowEnd: 9,
      airportColumn: 0,
      monthStartColumns: starts,
      annualStartColumn: 25,
    };
    const result = parseFaanWeightSection(rows, "faan-2024", 2024, spec);
    expect(result.monthly[0]).toMatchObject({
      imports: 100,
      exports: 50,
      reportedTotal: null,
      derivedTotal: 150,
    });
    expect(result.monthly[0].qualityFlags).not.toContain("reported_total_missing");
  });
});
