import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.tsx"],
    // Planner fixtures are intentionally compute-heavy. Bounded parallelism
    // and a finite 10s ceiling keep their runtime guardrail meaningful without
    // turning normal CPU contention into flakes.
    maxWorkers: 4,
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "server-only": path.resolve(rootDir, "tests/server-only.ts"),
    },
  },
});
