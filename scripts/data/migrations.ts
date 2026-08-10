import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type Migration = {
  version: string;
  fileName: string;
  path: string;
  checksum: string;
  sql: string;
};

const MIGRATION_FILE = /^(\d{3,})_([a-z0-9][a-z0-9_-]*)\.sql$/;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sqlLiteral(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'";
}

export function validateMigrationNames(fileNames: readonly string[]): string[] {
  const versions = new Set<string>();
  return fileNames
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => {
      const leftMatch = MIGRATION_FILE.exec(left);
      const rightMatch = MIGRATION_FILE.exec(right);
      if (!leftMatch || !rightMatch) return left.localeCompare(right);
      const numeric = BigInt(leftMatch[1]) - BigInt(rightMatch[1]);
      return numeric < 0n ? -1 : numeric > 0n ? 1 : left.localeCompare(right);
    })
    .map((fileName) => {
      const match = MIGRATION_FILE.exec(fileName);
      if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${fileName}`);
      const version = match[1];
      if (versions.has(version)) throw new Error(`DUPLICATE_MIGRATION_VERSION:${version}`);
      versions.add(version);
      return fileName;
    });
}

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const absolute = resolve(directory);
  const names = validateMigrationNames(await readdir(absolute));
  return Promise.all(names.map(async (fileName) => {
    const match = MIGRATION_FILE.exec(fileName);
    if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${fileName}`);
    const path = resolve(absolute, fileName);
    const sql = await readFile(path, "utf8");
    if (sql.trim().length === 0) throw new Error(`EMPTY_MIGRATION:${fileName}`);
    return {
      version: match[1],
      fileName,
      path,
      checksum: sha256(sql),
      sql,
    };
  }));
}

export function parseAppliedMigrations(output: string): Map<string, string> {
  const applied = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [version, checksum, ...rest] = line.split("\t");
    if (!version || !checksum || rest.length > 0 || !/^[0-9a-f]{64}$/.test(checksum)) {
      throw new Error(`INVALID_APPLIED_MIGRATION_ROW:${line}`);
    }
    if (applied.has(version)) throw new Error(`DUPLICATE_APPLIED_MIGRATION:${version}`);
    applied.set(version, checksum);
  }
  return applied;
}

export function assertMigrationChecksums(
  migrations: readonly Migration[],
  applied: ReadonlyMap<string, string>,
): void {
  const known = new Set(migrations.map((migration) => migration.version));
  for (const [version] of applied) {
    if (!known.has(version)) throw new Error(`UNKNOWN_APPLIED_MIGRATION:${version}`);
  }
  for (const migration of migrations) {
    const existing = applied.get(migration.version);
    if (existing && existing !== migration.checksum) {
      throw new Error(`MIGRATION_CHECKSUM_DRIFT:${migration.version}`);
    }
  }
}

export function buildBootstrapMigrationSql(): string {
  return [
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    "SELECT pg_advisory_xact_lock(hashtextextended('ooh-datahub:migrations', 0));",
    "CREATE SCHEMA IF NOT EXISTS ooh_data;",
    "CREATE TABLE IF NOT EXISTS ooh_data.schema_migrations (",
    "  version text PRIMARY KEY,",
    "  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),",
    "  file_name text NOT NULL,",
    "  applied_at timestamptz NOT NULL DEFAULT now()",
    ");",
    "COMMIT;",
    "",
  ].join("\n");
}

export function buildApplyMigrationSql(migrations: readonly Migration[]): string {
  const lines = ["\\set ON_ERROR_STOP on"];
  for (const migration of migrations) {
    const variable = `apply_${migration.version}`;
    lines.push(
      "BEGIN;",
      "SELECT pg_advisory_xact_lock(hashtextextended('ooh-datahub:migrations', 0));",
      "DO $migration_guard$",
      "BEGIN",
      `  IF EXISTS (SELECT 1 FROM ooh_data.schema_migrations WHERE version = ${sqlLiteral(migration.version)} AND checksum <> ${sqlLiteral(migration.checksum)}) THEN`,
      `    RAISE EXCEPTION 'MIGRATION_CHECKSUM_DRIFT:${migration.version}';`,
      "  END IF;",
      "END",
      "$migration_guard$;",
      `SELECT NOT EXISTS (SELECT 1 FROM ooh_data.schema_migrations WHERE version = ${sqlLiteral(migration.version)}) AS ${variable} \\gset`,
      `\\if :${variable}`,
      migration.sql.trimEnd(),
      `INSERT INTO ooh_data.schema_migrations (version, checksum, file_name) VALUES (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.checksum)}, ${sqlLiteral(migration.fileName)});`,
      "\\endif",
      "COMMIT;",
      "",
    );
  }
  return lines.join("\n");
}
