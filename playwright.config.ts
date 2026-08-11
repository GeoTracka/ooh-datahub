import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Map rendering and UX diagnostics are timing-sensitive under heavy CPU
  // contention. Keep concurrency bounded so screenshots settle consistently.
  workers: 4,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
});
