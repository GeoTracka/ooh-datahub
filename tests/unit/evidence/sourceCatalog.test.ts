import { describe, expect, it } from "vitest";
import { rblLoma2026Sources } from "@/evidence/sourceCatalog";
import {
  RBL_COLUMNS,
  RBL_MULTI_COLUMN_RANGES,
} from "@/evidence/rblLoma2026/columns";

describe("RBL/LOMA 2026 catalog", () => {
  it("pins both reviewed source revisions", () => {
    expect(rblLoma2026Sources.map((source) => source.sha256)).toEqual([
      "780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2",
      "a93b78fae81abee0f02a9248e7f69eaa065d94d3ebef81fea6105bccab44c0ff",
    ]);
    expect(new Set(rblLoma2026Sources.map((source) => source.id)).size).toBe(2);
  });

  it("maps only reviewed survey fields using one-based workbook columns", () => {
    expect(RBL_COLUMNS.city).toBe(14);
    expect(RBL_COLUMNS.commuteEligibility).toBe(115);
    expect(RBL_COLUMNS.fourWeekRecall).toBe(205);
    expect(RBL_MULTI_COLUMN_RANGES.formatRatings).toEqual([226, 258]);

    const permittedColumns = [
      ...Object.values(RBL_COLUMNS),
      ...Object.values(RBL_MULTI_COLUMN_RANGES).flatMap(([start, end]) =>
        Array.from({ length: end - start + 1 }, (_, index) => start + index),
      ),
    ];
    expect(permittedColumns).not.toContain(7);
    expect(permittedColumns).not.toContain(8);
    expect(permittedColumns).not.toContain(9);
    expect(permittedColumns).not.toContain(298);
  });

  it("marks respondent workbook access as restricted", () => {
    expect(rblLoma2026Sources[0]).toMatchObject({
      kind: "survey_workbook",
      accessClass: "restricted_respondent_source",
    });
    expect(rblLoma2026Sources[1]).toMatchObject({
      kind: "published_report",
      accessClass: "reviewed_narrative_source",
    });
  });
});
