import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["visual-accessibility.spec.ts", "ux-review.spec.ts"],
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
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium" }],
});
