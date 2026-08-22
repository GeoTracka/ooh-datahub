import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts: Record<string, string>;
};

const root = path.resolve(".");
const manifest = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as PackageManifest;

const entrypoints = [
  ["survey:validate", "scripts/validate-consumer-survey.ts"],
  ["survey:derive", "scripts/derive-consumer-survey-context.ts"],
  [
    "survey:publish-context",
    "scripts/publish-consumer-survey-planning-context.ts",
  ],
] as const;

describe("consumer survey CLI entrypoints", () => {
  it.each(entrypoints)(
    "runs %s with the server-only export condition",
    (name, script) => {
      expect(manifest.scripts[name]).toBe(
        `node --conditions=react-server --import tsx ${script}`,
      );

      const execution = spawnSync(
        process.execPath,
        ["--conditions=react-server", "--import", "tsx", script],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, NODE_NO_WARNINGS: "1" },
          timeout: 10_000,
        },
      );

      expect(execution.error).toBeUndefined();
      expect(execution.status).toBe(1);
      expect(execution.stderr).toContain("ARGUMENT_REQUIRED");
      expect(execution.stderr).not.toContain(
        "This module cannot be imported from a Client Component module",
      );
    },
    15_000,
  );
});
