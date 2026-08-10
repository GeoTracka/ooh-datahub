import { resolve } from "node:path";
import { loadMigrations } from "./data/migrations";

async function main(): Promise<void> {
  const migrations = await loadMigrations(resolve("migrations"));
  if (migrations.length === 0) throw new Error("NO_DATA_MIGRATIONS");
  process.stdout.write(JSON.stringify(
    migrations.map(({ version, fileName, checksum }) => ({ version, fileName, checksum })),
    null,
    2,
  ) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`db:check failed: ${message}\n`);
  process.exitCode = 1;
});
