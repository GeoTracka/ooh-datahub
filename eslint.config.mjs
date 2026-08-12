import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".codex-recover-plan.mjs",
    ".next/**",
    ".worktrees/**",
    "coverage/**",
    "playwright-report/**",
    "public/maplibre/**",
    "scripts/reconstruct-plan.mjs",
    "test-results/**",
  ]),
]);
