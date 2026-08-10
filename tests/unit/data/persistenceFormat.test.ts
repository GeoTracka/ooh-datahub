import { describe, expect, it } from "vitest";
import {
  assertIngestionTransition,
  copyStart,
  copyTextRow,
  joinStorageUri,
  quarantineRecordId,
  sourceRevisionKey,
  validateRetentionUri,
} from "../../../scripts/data/persistenceFormat";

describe("PostgreSQL persistence format", () => {
  it("builds immutable source revision and quarantine identities", () => {
    const sha = "a".repeat(64);
    expect(sourceRevisionKey("source-a", sha)).toBe(`source-a@${sha}`);

    const first = quarantineRecordId({
      sourceId: "source-a",
      sourceSha256: sha,
      sheet: "DATA",
      sourceRow: 12,
      reason: "invalid_year",
      raw: ["x", 12],
    });
    const again = quarantineRecordId({
      sourceId: "source-a",
      sourceSha256: sha,
      sheet: "DATA",
      sourceRow: 12,
      reason: "invalid_year",
      raw: ["x", 12],
    });
    const revised = quarantineRecordId({
      sourceId: "source-a",
      sourceSha256: "b".repeat(64),
      sheet: "DATA",
      sourceRow: 12,
      reason: "invalid_year",
      raw: ["x", 12],
    });

    expect(first).toHaveLength(64);
    expect(again).toBe(first);
    expect(revised).not.toBe(first);
  });

  it("serializes COPY text without losing tabs, newlines, backslashes or nulls", () => {
    expect(copyTextRow(["a\tb", "x\ny", "c\\d", null, 12, true])).toBe(
      "a\\tb\tx\\ny\tc\\\\d\t\\N\t12\tt\n",
    );
    expect(copyStart("ooh_data.test_rows", ["source_id", "record_json"])).toContain(
      "COPY ooh_data.test_rows (source_id, record_json) FROM STDIN",
    );
    expect(() => copyStart("bad-table", ["source_id"])).toThrow("INVALID_SQL_IDENTIFIER");
  });

  it("allows only running to terminal ingestion transitions", () => {
    expect(() => assertIngestionTransition("running", "succeeded")).not.toThrow();
    expect(() => assertIngestionTransition("running", "failed")).not.toThrow();
    expect(() => assertIngestionTransition("succeeded", "failed")).toThrow(
      "INVALID_INGESTION_TRANSITION:succeeded:failed",
    );
  });

  it("requires non-secret retention URIs and joins exact source filenames", () => {
    expect(validateRetentionUri("s3://ooh-raw/reviewed/", "raw")).toBe(
      "s3://ooh-raw/reviewed/",
    );
    expect(joinStorageUri(
      "s3://ooh-raw/reviewed/",
      "OOH Industry Data (FY 2024 - Q1 2025).xlsx",
    )).toBe(
      "s3://ooh-raw/reviewed/OOH%20Industry%20Data%20(FY%202024%20-%20Q1%202025).xlsx",
    );
    expect(() => validateRetentionUri("ftp://example.com/raw", "raw")).toThrow(
      "UNSUPPORTED_RAW_URI_SCHEME:ftp:",
    );
    expect(() => validateRetentionUri("https://user:secret@example.com/raw", "raw")).toThrow(
      "CREDENTIALS_NOT_ALLOWED_IN_RAW_URI",
    );
  });
});
