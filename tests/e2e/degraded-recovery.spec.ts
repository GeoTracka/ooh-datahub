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
  await page.getByRole("button", { name: "Show recommended areas" }).click();

  await expect(page.getByText("Needs fine-tuning before continuing").first()).toBeVisible();
  await expect(page.getByText(/over budget/i).first()).toBeVisible();
  await expect(page.getByText("BUDGET_EXCEEDED", { exact: true })).toBeHidden();
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

test("summarizes rows needing review or exclusion without echoing sensitive values", async ({ page }, testInfo) => {
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/mixed-validity-inventory.csv"),
  );

  await expect(page.getByText("1 ready · 1 need review · 1 cannot be used")).toBeVisible();
  const summary = page.getByRole("region", { name: "Upload validation summary" });
  await expect(summary).toContainText("Some rows were kept out of planning");
  await expect(summary).toContainText("1 need review · Possible personal data");
  await expect(summary).toContainText("1 cannot be used · Missing asset ID");
  await expect(page.getByText("Ada Example", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Private home", { exact: true })).toHaveCount(0);

  const diagnostics = await captureUxReview(page, testInfo, "degraded-03-upload-validation", { fullPage: false });
  await assertReviewClean(page, diagnostics, "upload validation exclusions");
});

test("keeps local upload usable when provider preflight fails", async ({ page }, testInfo) => {
  await page.route("**/api/enrichment/preflight", async (route) => {
    await route.fulfill({ status: 503, json: { error: "fixture unavailable" } });
  });
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toBeVisible();
  await page.getByRole("button", { name: "Check location details" }).click();

  const alert = page.getByRole("alert", { name: "Location check failure" });
  await expect(alert).toContainText("Location checking is temporarily unavailable");
  await expect(alert).toContainText("Your uploaded details are still available");
  await expect(alert.locator("details")).toContainText("PREFLIGHT_FAILED");
  await expect(page.getByRole("button", { name: "Add uploaded inventory to the plan" })).toBeEnabled();

  const diagnostics = await captureUxReview(page, testInfo, "degraded-04-provider-failure", { fullPage: false });
  await assertReviewClean(page, diagnostics, "provider recovery");
});

test("clears stale upload state when a replacement spreadsheet cannot be read", async ({ page }, testInfo) => {
  await openUpload(page);
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toBeVisible();

  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/unreadable-inventory.xlsx"),
  );
  const alert = page.getByRole("alert", { name: "Spreadsheet read failure" });
  await expect(alert).toContainText("We couldn't read this spreadsheet");
  await expect(alert).toContainText("Nothing from this file has been added to planning");
  await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Location review" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Select up to 50 ready rows" })).toHaveCount(0);

  const diagnostics = await captureUxReview(page, testInfo, "degraded-05-upload-parse-failure", { fullPage: false });
  await assertReviewClean(page, diagnostics, "spreadsheet parse recovery");
});

test("makes RFQ schedule revision a clear recoverable state", async ({ page }, testInfo) => {
  await reachActionStep(page);
  await page.getByRole("button", { name: /Review supplier request/ }).click();
  const rfq = page.getByRole("dialog", { name: "Supplier request" });
  await expect(rfq).toBeVisible();
  await rfq.getByLabel("Flight start").fill("2026-09-08");

  const revision = rfq.getByRole("region", { name: "Schedule revision required" });
  await expect(revision).toContainText(
    "Dates changed. Update the plan with these dates before creating the supplier request.",
  );
  await expect(revision.getByRole("button", { name: "Update plan with these dates" })).toBeEnabled();
  await expect(rfq.getByRole("button", { name: "Create supplier request" })).toBeDisabled();

  const diagnostics = await captureUxReview(page, testInfo, "degraded-06-rfq-schedule-revision", { fullPage: false });
  await assertReviewClean(page, diagnostics, "RFQ schedule revision");
});
