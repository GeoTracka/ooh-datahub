import { defineConfig } from "drizzle-kit";

if (!process.env.MARIADB_URL) throw new Error("MARIADB_URL_REQUIRED");

export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema/index.ts",
  out: "./migrations-mariadb",
  dbCredentials: { url: process.env.MARIADB_URL },
  strict: true,
  verbose: true,
});
