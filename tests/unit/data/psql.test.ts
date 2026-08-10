import { describe, expect, it } from "vitest";
import { postgresEnvironment } from "../../../scripts/data/psql";

describe("psql connection environment", () => {
  it("keeps database credentials out of command arguments by using libpq env", () => {
    const env = postgresEnvironment(
      "postgresql://loader:p%40ss@db.example.com:5433/ooh?sslmode=require&application_name=ooh-loader",
    );
    expect(env.PGHOST).toBe("db.example.com");
    expect(env.PGPORT).toBe("5433");
    expect(env.PGDATABASE).toBe("ooh");
    expect(env.PGUSER).toBe("loader");
    expect(env.PGPASSWORD).toBe("p@ss");
    expect(env.PGSSLMODE).toBe("require");
    expect(env.PGAPPNAME).toBe("ooh-loader");
  });

  it("rejects non-PostgreSQL and incomplete URLs", () => {
    expect(() => postgresEnvironment("mysql://db.example/ooh")).toThrow(
      "INVALID_DATABASE_PROTOCOL",
    );
    expect(() => postgresEnvironment("postgresql:///ooh")).toThrow(
      "INCOMPLETE_DATABASE_URL",
    );
  });
});
