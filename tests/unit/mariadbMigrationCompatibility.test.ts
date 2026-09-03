import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("MariaDB migration compatibility", () => {
  it("keeps session expiry fixed when last-seen changes", () => {
    const migration = readFileSync(
      path.resolve("migrations-mariadb/0004_fix_session_expiry.sql"),
      "utf8",
    );

    expect(migration).toMatch(
      /ALTER TABLE app_sessions\s+MODIFY expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;/,
    );
    expect(migration).not.toMatch(/expires_at[\s\S]*ON UPDATE CURRENT_TIMESTAMP/i);
  });

  it("does not cascade updates into columns used by the artifact citation check", () => {
    const migration = readFileSync(
      path.resolve("migrations-mariadb/0003_ai_threads_artifacts.sql"),
      "utf8",
    );

    for (const constraint of ["artifact_citations_fact_fk", "artifact_citations_excerpt_fk"]) {
      const definition = migration.match(
        new RegExp(`CONSTRAINT ${constraint}[\\s\\S]*?(?=,\\n  CONSTRAINT|\\n\\))`),
      )?.[0];

      expect(definition, `${constraint} should exist`).toBeDefined();
      expect(definition).not.toContain("ON UPDATE CASCADE");
    }
  });
});
