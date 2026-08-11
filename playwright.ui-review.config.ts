import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "visual-accessibility.spec.ts",
    "ux-review.spec.ts",
    "ui-quality-hierarchy.spec.ts",
    "drawer-ergonomics.spec.ts",
    "fine-tune-workspace.spec.ts",
    "degraded-recovery.spec.ts",
    "transition-quality.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report/ui-ux", open: "never" }],
  ],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
    },
  },
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [{
    name: "chromium",
    use: devices["Desktop Chrome"],
  }],
});
