import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createConnection } from "mysql2/promise";

import { evidenceRuntimeConfig } from "@/server/db/runtimeConfig";

export async function migrateEvidenceDatabase(): Promise<void> {
  const { url } = evidenceRuntimeConfig();
  const migrationPath = path.resolve(
    "migrations-mariadb/0001_evidence_foundation.sql",
  );
  const sql = await readFile(migrationPath, "utf8");
  const connection = await createConnection({ uri: url, multipleStatements: true });
  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  migrateEvidenceDatabase()
    .then(() => process.stdout.write("MariaDB evidence schema is ready.\n"))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
