import { describe, expect, it } from "vitest";
import type { Migration } from "../../../scripts/data/migrations";
import {
  assertMigrationChecksums,
  buildApplyMigrationSql,
  parseAppliedMigrations,
  validateMigrationNames,
} from "../../../scripts/data/migrations";

function migration(version: string, checksum: string): Migration {
  return {
    version,
    checksum,
    fileName: `${version}_test.sql`,
    path: `/tmp/${version}_test.sql`,
    sql: `SELECT ${Number(version)};`,
  };
}

describe("data migration manifest", () => {
  it("orders versions numerically and rejects duplicate versions", () => {
    expect(validateMigrationNames([
      "1000_later.sql",
      "002_second.sql",
      "001_first.sql",
    ])).toEqual([
      "001_first.sql",
      "002_second.sql",
      "1000_later.sql",
    ]);

    expect(() => validateMigrationNames([
      "001_first.sql",
      "001_duplicate.sql",
    ])).toThrow("DUPLICATE_MIGRATION_VERSION:001");
  });

  it("parses applied rows and fails closed on checksum drift or unknown history", () => {
    const expected = [
      migration("001", "a".repeat(64)),
      migration("002", "b".repeat(64)),
    ];
    const applied = parseAppliedMigrations(`001\t${"a".repeat(64)}\n`);
    expect(() => assertMigrationChecksums(expected, applied)).not.toThrow();

    expect(() => assertMigrationChecksums(
      expected,
      new Map([["001", "c".repeat(64)]]),
    )).toThrow("MIGRATION_CHECKSUM_DRIFT:001");

    expect(() => assertMigrationChecksums(
      expected,
      new Map([["999", "d".repeat(64)]]),
    )).toThrow("UNKNOWN_APPLIED_MIGRATION:999");
  });

  it("builds a concurrency-locked, checksum-guarded psql migration script", () => {
    const item = migration("001", "a".repeat(64));
    const sql = buildApplyMigrationSql([item]);
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("MIGRATION_CHECKSUM_DRIFT:001");
    expect(sql).toContain("SELECT 1;");
    expect(sql).toContain("\\if :apply_001");
  });
});
