import { afterEach, describe, expect, it } from "vitest";
import { evidenceRuntimeConfig } from "@/server/db/runtimeConfig";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("evidenceRuntimeConfig", () => {
  it("requires MariaDB without reusing the PostgreSQL URL", () => {
    delete process.env.MARIADB_URL;
    process.env.DATABASE_URL = "postgresql://legacy";

    expect(() => evidenceRuntimeConfig()).toThrow("MARIADB_URL_REQUIRED");
  });

  it("accepts a MariaDB connection through the MySQL protocol", () => {
    process.env.MARIADB_URL = "mysql://planner:secret@localhost:3306/ooh_runtime";

    expect(evidenceRuntimeConfig()).toEqual({
      url: "mysql://planner:secret@localhost:3306/ooh_runtime",
    });
  });

  it("rejects a PostgreSQL URL supplied as the MariaDB runtime", () => {
    process.env.MARIADB_URL = "postgresql://legacy/ooh";

    expect(() => evidenceRuntimeConfig()).toThrow(
      "MARIADB_URL_MUST_USE_MYSQL_PROTOCOL",
    );
  });
});
