import { describe, expect, it } from "vitest";
import { SeedReportSchema } from "../../../scripts/data/seedReport";

describe("persisted seed report contract", () => {
  it("accepts the deterministic T1 report shape and rejects ungoverned revisions", () => {
    const report = {
      schemaVersion: 1,
      catalogVersion: "drive-reviewed-v1",
      deterministic: true,
      sourceDirectory: "runtime_argument",
      sourceChecks: [{
        id: "ooh-2023",
        fileName: "source.xlsx",
        driveFileId: "drive-id",
        sha256: "a".repeat(64),
        fileSizeBytes: 123,
      }],
      sourceRuns: [{ sourceId: "ooh-2023", sheets: [{ sheet: "DATA", accepted: 10 }] }],
      counts: {
        oohAccepted: 10,
        oohActive: 10,
        oohSuperseded: 0,
        boardQualityAccepted: 0,
        faanMonthlyAccepted: 0,
        faanAnnualAccepted: 0,
        quarantined: 0,
      },
      qualityFlagCounts: {},
      coverage: { absentIsNotZero: true },
      outputs: {
        ooh: "ooh-observations.ndjson",
        boardQuality: "ooh-board-quality.ndjson",
        faanMonthly: "faan-monthly.ndjson",
        faanAnnual: "faan-annual.ndjson",
        quarantine: "quarantine.ndjson",
        report: "seed-report.json",
      },
      plannerBoundary: "context_staging_only_not_frozen_demo_or_evidence_promotion",
    };

    expect(SeedReportSchema.parse(report).sourceChecks[0].id).toBe("ooh-2023");
    expect(() => SeedReportSchema.parse({
      ...report,
      sourceChecks: [{ ...report.sourceChecks[0], sha256: "not-a-sha" }],
    })).toThrow();
  });
});
