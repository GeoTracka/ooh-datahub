import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  captureUxReview,
  type UxReviewDiagnostics,
} from "./helpers/uxReview";

async function assertAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

function actionableSmallTargets(diagnostics: UxReviewDiagnostics) {
  return diagnostics.undersizedInteractiveCandidates.filter((candidate) =>
    candidate.role !== "tabpanel" && !(candidate.tag === "a" && candidate.name === "MapLibre")
  );
}

async function assertReviewClean(page: Page, diagnostics: UxReviewDiagnostics, label: string) {
  await assertNoHorizontalOverflow(page, label);
  expect(actionableSmallTargets(diagnostics), `${label}: actionable small targets`).toEqual([]);
  expect(diagnostics.clippedTextCandidates, `${label}: clipped text`).toEqual([]);
  await assertAccessible(page);
}

async function reachActionStep(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
}

async function openUpload(page: Page): Promise<void> {
  await reachActionStep(page);
  await page.getByRole("button", { name: /Upload customer inventory/ }).click();
  await expect(page.getByRole("dialog", { name: "Upload inventory" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("reviews invalid package recovery without leading with machine codes", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue to timing" }).click();
  const budget = page.getByLabel("Budget (NGN)");
  await budget.fill("1");
  await page.getByRole("button", { name: "Show recommended zones" }).click();

  const alert = page.getByRole("alert", { name: "Package constraints" });
  await expect(alert).toContainText("over the campaign budget");
  await expect(alert.locator(".recovery-notice-copy")).not.toContainText("BUDGET_EXCEEDED");
  await expect(alert.locator("details")).toContainText("BUDGET_EXCEEDED");
  await expect(page.getByRole("button", { name: "Continue with selected package" })).toBeDisabled();

  const diagnostics = await captureUxReview(page, testInfo, "degraded-01-invalid-package");
  await assertReviewClean(page, diagnostics, "invalid package recovery");
});

test("reviews approximate column mapping before any rows are used", async ({ page }, testInfo) => {
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/approximate-headers.csv"),
  );

  const mapping = page.getByRole("region", { name: "Review column mappings" });
  await expect(mapping).toContainText("Review required before rows can be used");
  await expect(mapping).toContainText("approximate matches are never applied automatically");
  await expect(mapping.getByRole("button", { name: "Confirm mappings" })).toBeEnabled();

  const diagnostics = await captureUxReview(page, testInfo, "degraded-02-upload-mapping-review", { fullPage: false });
  await assertReviewClean(page, diagnostics, "upload mapping review");
});

test("summarizes quarantined and rejected rows without echoing sensitive values", async ({ page }, testInfo) => {
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/mixed-validity-inventory.csv"),
  );

  await expect(page.getByText("1 accepted · 1 quarantined · 1 rejected")).toBeVisible();
  const summary = page.getByRole("region", { name: "Upload validation summary" });
  await expect(summary).toContainText("Some rows were kept out of planning");
  await expect(summary).toContainText("1 quarantined · Possible personal data");
  await expect(summary).toContainText("1 rejected · Missing asset ID");
  await expect(page.getByText("Ada Example", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Private home", { exact: true })).toHaveCount(0);

  const diagnostics = await captureUxReview(page, testInfo, "degraded-03-upload-validation", { fullPage: false });
  await assertReviewClean(page, diagnostics, "upload quarantine and rejection");
});

test("keeps local upload usable when provider preflight fails", async ({ page }, testInfo) => {
  await page.route("**/api/enrichment/preflight", async (route) => {
    await route.fulfill({ status: 503, json: { error: "fixture unavailable" } });
  });
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 accepted · 0 quarantined · 0 rejected")).toBeVisible();
  await page.getByRole("button", { name: "Review enrichment" }).click();

  const alert = page.getByRole("alert", { name: "Enrichment failure" });
  await expect(alert).toContainText("Location enrichment is temporarily unavailable");
  await expect(alert).toContainText("uploaded facts are still available offline");
  await expect(alert.locator("details")).toContainText("PREFLIGHT_FAILED");
  await expect(page.getByRole("button", { name: "Use uploaded facts as context" })).toBeEnabled();

  const diagnostics = await captureUxReview(page, testInfo, "degraded-04-provider-failure", { fullPage: false });
  await assertReviewClean(page, diagnostics, "provider recovery");
});

test("clears stale upload state when a replacement spreadsheet cannot be read", async ({ page }, testInfo) => {
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 accepted · 0 quarantined · 0 rejected")).toBeVisible();

  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/unreadable-inventory.xlsx"),
  );
  const alert = page.getByRole("alert", { name: "Spreadsheet read failure" });
  await expect(alert).toContainText("We couldn't read this spreadsheet");
  await expect(alert).toContainText("Nothing from this file has been added to planning");
  await expect(page.getByText("1 accepted · 0 quarantined · 0 rejected")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Geocode review" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Select up to 50 accepted rows" })).toHaveCount(0);

  const diagnostics = await captureUxReview(page, testInfo, "degraded-05-upload-parse-failure", { fullPage: false });
  await assertReviewClean(page, diagnostics, "spreadsheet parse recovery");
});

test("makes RFQ schedule revision a clear recoverable state", async ({ page }, testInfo) => {
  await reachActionStep(page);
  await page.getByRole("button", { name: /Review RFQ/ }).click();
  const rfq = page.getByRole("dialog", { name: "Supplier verification RFQ" });
  await expect(rfq).toBeVisible();
  await rfq.getByLabel("Flight start").fill("2026-09-08");

  const revision = rfq.getByRole("region", { name: "Schedule revision required" });
  await expect(revision).toContainText("Recompute a dirty plan revision before generating the RFQ");
  await expect(revision.getByRole("button", { name: "Recompute plan with these dates" })).toBeEnabled();
  await expect(rfq.getByRole("button", { name: "Generate RFQ" })).toBeDisabled();

  const diagnostics = await captureUxReview(page, testInfo, "degraded-06-rfq-schedule-revision", { fullPage: false });
  await assertReviewClean(page, diagnostics, "RFQ schedule revision");
});
