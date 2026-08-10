import { describe, expect, it } from "vitest";
import { seedSourceCatalog } from "@/seed/sourceCatalog";

describe("Drive seed source catalog", () => {
  it("pins all six reviewed Drive workbooks", () => {
    expect(seedSourceCatalog).toHaveLength(6);
    expect(new Set(seedSourceCatalog.map((source) => source.driveFileId)).size).toBe(6);
    expect(seedSourceCatalog.every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
  });

  it("records the supplied 2025 FAAN coverage gap rather than inventing zeros", () => {
    const source = seedSourceCatalog.find((candidate) => candidate.id === "faan-traffic-2025-r1");
    expect(source?.kind).toBe("faan");
    if (!source || source.kind !== "faan") throw new Error("missing 2025 source");
    expect(new Set(source.flowSections.map((section) => section.metric))).toEqual(new Set(["passenger"]));
    expect(source.weightSections).toHaveLength(0);
  });

  it("seeds only canonical FY2023 DATA plus separate NB SOV, not duplicated pivot/working tabs", () => {
    const source = seedSourceCatalog.find((candidate) => candidate.id === "ooh-full-year-2023-r1");
    expect(source?.kind).toBe("ooh");
    if (!source || source.kind !== "ooh") throw new Error("missing FY2023 source");
    expect(source.placementSheets.map((sheet) => sheet.sheet)).toEqual(["DATA"]);
    expect(source.boardQualitySheets?.map((sheet) => sheet.sheet)).toEqual(["NB SOV"]);
  });
});
