import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(path.resolve("package.json"), "utf8"),
) as PackageManifest;

describe("consumer survey CLI entrypoints", () => {
  it.each([
    ["survey:validate", "scripts/validate-consumer-survey.ts"],
    ["survey:derive", "scripts/derive-consumer-survey-context.ts"],
    [
      "survey:publish-context",
      "scripts/publish-consumer-survey-planning-context.ts",
    ],
  ] as const)(
    "runs %s with the server-only export condition",
    (name, script) => {
      expect(manifest.scripts[name]).toBe(
        `node --conditions=react-server --import tsx ${script}`,
      );
    },
  );
});
