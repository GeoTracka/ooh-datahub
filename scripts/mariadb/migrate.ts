import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RowDataPacket } from "mysql2/promise";
import { createConnection } from "mysql2/promise";

import { evidenceRuntimeConfig } from "@/server/db/runtimeConfig";

export async function migrateEvidenceDatabase(): Promise<void> {
  const { url } = evidenceRuntimeConfig();
  const migrationDirectory = path.resolve("migrations-mariadb");
  const connection = await createConnection({ uri: url, multipleStatements: true });
  try {
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS app_schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        sha256 CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    const migrations = (await readdir(migrationDirectory))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();
    for (const id of migrations) {
      const sql = await readFile(path.join(migrationDirectory, id), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const [rows] = await connection.query<Array<RowDataPacket & { sha256: string }>>(
        "SELECT sha256 FROM app_schema_migrations WHERE id = ?",
        [id],
      );
      if (rows[0]) {
        if (rows[0].sha256 !== hash) throw new Error(`MIGRATION_HASH_MISMATCH:${id}`);
        continue;
      }
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.execute(
          "INSERT INTO app_schema_migrations (id, sha256) VALUES (?, ?)",
          [id, hash],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
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
