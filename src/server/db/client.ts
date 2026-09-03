import "server-only";

import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import { evidenceRuntimeConfig } from "@/server/db/runtimeConfig";
import * as schema from "@/server/db/schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const { url } = evidenceRuntimeConfig();
  const pool = createPool({
    uri: url,
    connectionLimit: 10,
    enableKeepAlive: true,
    decimalNumbers: true,
  });
  return {
    pool,
    db: drizzle(pool, { schema, mode: "default" }),
  };
}

export function evidenceDatabase() {
  database ??= createDatabase();
  return database;
}

