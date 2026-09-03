import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  captureUxReview,
  type UxReviewDiagnostics,
} from "./helpers/uxReview";

function actionableSmallTargets(diagnostics: UxReviewDiagnostics) {
  return diagnostics.undersizedInteractiveCandidates.filter((candidate) =>
    candidate.role !== "tabpanel" && !(candidate.tag === "a" && candidate.name === "MapLibre")
  );
}

async function assertReviewClean(page: Page, diagnostics: UxReviewDiagnostics, label: string) {
  await assertNoHorizontalOverflow(page, label);
  expect(actionableSmallTargets(diagnostics), `${label}: actionable small targets`).toEqual([]);
  expect(diagnostics.clippedTextCandidates, `${label}: clipped text`).toEqual([]);
  expect(diagnostics.actionableNestedScrollCandidates, `${label}: actionable nested scroll`).toEqual([]);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function reachActionStep(page: Page): Promise<void> {
  await page.goto("/planner");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ })).toBeVisible();
  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
}

async function openUploadWithFixture(page: Page): Promise<void> {
  await reachActionStep(page);
  await page.getByRole("button", { name: /Upload customer inventory/ }).click();
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("keeps enrichment preflight single-flight and visibly locked", async ({ page }, testInfo) => {
  let calls = 0;
  let release = () => {};
  await page.route("**/api/enrichment/preflight", async (route) => {
    calls += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: {
      id: "pf-transition",
      providerProducts: ["Google Geocoding API v4"],
      transmittedFields: ["address"],
      maximumCalls: 1,
      eligibility: "context only",
    } });
  });

  await openUploadWithFixture(page);
  const dialog = page.getByRole("dialog", { name: "Upload inventory" });
  const review = dialog.getByRole("button", { name: "Check location details" });
  await review.dblclick();

  await expect(dialog.getByRole("status", { name: "Checking location-service requirements…" }))
    .toBeVisible();
  expect(calls).toBe(1);
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.locator(".planner-drawer-body")).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByLabel("Inventory spreadsheet")).toBeDisabled();
  await expect(dialog.getByRole("checkbox", { name: /UP-001/ })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Checking requirements…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeEnabled();

  const diagnostics = await captureUxReview(
    page,
    testInfo,
    "transition-01-enrichment-preflight",
    { fullPage: false },
  );
  await assertReviewClean(page, diagnostics, "enrichment preflight transition");

  release();
  await expect(dialog.getByRole("status", { name: "Checking location-service requirements…" }))
    .toHaveCount(0);
  await expect(dialog.getByRole("region", { name: "Location-service requirements" })).toBeVisible();
});

test("invalidates preflight on selection change and locks provider enrichment", async ({ page }, testInfo) => {
  let preflightCalls = 0;
  let runCalls = 0;
  let releaseRun = () => {};
  await page.route("**/api/enrichment/preflight", async (route) => {
    preflightCalls += 1;
    await route.fulfill({ json: {
      id: `pf-transition-${preflightCalls}`,
      providerProducts: ["Google Geocoding API v4"],
      transmittedFields: ["address"],
      maximumCalls: 1,
      eligibility: "context only",
    } });
  });
  await page.route("**/api/enrichment/run", async (route) => {
    runCalls += 1;
    await new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    await route.fulfill({ json: [] });
  });

  await openUploadWithFixture(page);
  const dialog = page.getByRole("dialog", { name: "Upload inventory" });
  const review = dialog.getByRole("button", { name: "Check location details" });
  const row = dialog.getByRole("checkbox", { name: /UP-001/ });

  await review.click();
  await expect(dialog.getByRole("region", { name: "Location-service requirements" })).toBeVisible();
  await row.uncheck();
  await expect(dialog.getByRole("region", { name: "Location-service requirements" })).toHaveCount(0);
  await row.check();
  await review.click();
  expect(preflightCalls).toBe(2);

  const enrich = dialog.getByRole("button", { name: "Check suggested locations" });
  await enrich.dblclick();
  await expect(dialog.getByRole("status", { name: "Checking suggested locations…" }))
    .toBeVisible();
  expect(runCalls).toBe(1);
  await expect(row).toBeDisabled();
  await expect(dialog.getByLabel("Inventory spreadsheet")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Checking locations…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Add reviewed inventory to the plan" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeEnabled();

  const diagnostics = await captureUxReview(
    page,
    testInfo,
    "transition-02-provider-enrichment",
    { fullPage: false },
  );
  await assertReviewClean(page, diagnostics, "provider enrichment transition");

  releaseRun();
  await expect(dialog.getByRole("status", { name: "Checking suggested locations…" }))
    .toHaveCount(0);
});
