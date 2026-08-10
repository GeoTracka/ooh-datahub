import { resolve } from "node:path";
import {
  assertMigrationChecksums,
  buildApplyMigrationSql,
  buildBootstrapMigrationSql,
  loadMigrations,
  parseAppliedMigrations,
} from "./data/migrations";
import { runPsql } from "./data/psql";

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

export async function migrateDatabase(): Promise<{
  applied: string[];
  alreadyApplied: string[];
}> {
  const url = databaseUrl();
  const migrations = await loadMigrations(resolve("migrations"));
  await runPsql(url, buildBootstrapMigrationSql());

  const current = await runPsql(
    url,
    "SELECT version, checksum FROM ooh_data.schema_migrations ORDER BY version;\n",
    { tuplesOnly: true },
  );
  const applied = parseAppliedMigrations(current.stdout);
  assertMigrationChecksums(migrations, applied);

  const pending = migrations.filter((migration) => !applied.has(migration.version));
  if (pending.length > 0) {
    await runPsql(url, buildApplyMigrationSql(pending));
  }

  return {
    applied: pending.map((migration) => migration.version),
    alreadyApplied: migrations
      .filter((migration) => applied.has(migration.version))
      .map((migration) => migration.version),
  };
}

if (process.argv[1]?.endsWith("db-migrate.ts")) {
  migrateDatabase()
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`db:migrate failed: ${message}\n`);
      process.exitCode = 1;
    });
}
