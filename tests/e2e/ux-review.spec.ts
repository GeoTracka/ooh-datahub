import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertCriticalControlInViewport,
  assertFocusInside,
  assertNoHorizontalOverflow,
  captureUxReview,
} from "./helpers/uxReview";

async function assertAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function assertFocusCycle(page: Page, dialog: Locator, label: string): Promise<void> {
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Tab");
    await assertFocusInside(dialog, `${label} forward tab ${index + 1}`);
  }
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Shift+Tab");
    await assertFocusInside(dialog, `${label} reverse tab ${index + 1}`);
  }
}

async function makeExplicitSwap(page: Page): Promise<void> {
  const currentFace = page.getByLabel("Current face to swap");
  const replacementFace = page.getByLabel("Replacement face");
  const candidateCount = await currentFace.locator("option").count();
  for (let index = 1; index < candidateCount; index += 1) {
    await currentFace.selectOption({ index });
    if (await replacementFace.locator("option").count() > 1) {
      await replacementFace.selectOption({ index: 1 });
      await page.getByRole("button", { name: "Swap selected face" }).click();
      return;
    }
  }
  throw new Error("NO_FINE_TUNE_SWAP_AVAILABLE");
}

async function reachRecommendedPackage(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Recommended package/ })).toBeVisible();
}

async function reachActionStep(page: Page): Promise<void> {
  await reachRecommendedPackage(page);
  await page.getByRole("button", { name: "This package works" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

test.describe("desktop workflow review", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("captures the complete seeded decision journey", async ({ page }, testInfo) => {
    await page.goto("/");
    const step1 = page.getByRole("region", { name: /Step 1 of 5:/ });
    await expect(step1).toBeVisible();
    await assertNoHorizontalOverflow(page, "desktop step 1");
    await assertCriticalControlInViewport(page.getByRole("button", { name: "Continue to timing" }), "Continue to timing");
    await captureUxReview(page, testInfo, "desktop-01-brief");
    await assertAccessible(page);

    await page.getByRole("button", { name: "Continue to timing" }).click();
    await expect(page.getByRole("region", { name: /Step 2 of 5:/ })).toBeVisible();
    await assertNoHorizontalOverflow(page, "desktop step 2");
    await captureUxReview(page, testInfo, "desktop-02-timing-budget");

    await page.getByRole("button", { name: "Show recommended zones" }).click();
    await expect(page.getByRole("region", { name: /Step 3 of 5: Recommended package/ })).toBeVisible();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await assertNoHorizontalOverflow(page, "desktop step 3");
    await captureUxReview(page, testInfo, "desktop-03-recommended-package");
    await assertAccessible(page);

    const zones = page.getByTestId("zone-card");
    await zones.nth(1).getByRole("button").first().click();
    const deliveryStoryTrigger = page.getByRole("button", { name: "View delivery story" });
    await expect(deliveryStoryTrigger).toBeVisible();
    await captureUxReview(page, testInfo, "desktop-04-focused-zone");

    await deliveryStoryTrigger.click();
    const causalDialog = page.getByRole("dialog", { name: "How delivery was estimated" });
    await expect(causalDialog).toBeVisible();
    await assertFocusCycle(page, causalDialog, "delivery story");
    await captureUxReview(page, testInfo, "desktop-05-delivery-story", { fullPage: false });
    await assertAccessible(page);
    await causalDialog.getByRole("button", { name: "Close" }).click();
    await expect(deliveryStoryTrigger).toBeFocused();

    await page.getByRole("button", { name: "This package works" }).click();
    await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
    await captureUxReview(page, testInfo, "desktop-06-package-confirmed");

    await page.getByRole("button", { name: /Fine-tune package/ }).click();
    await expect(page.getByRole("region", { name: /Step 5 of 5:/ })).toBeVisible();
    await assertNoHorizontalOverflow(page, "desktop step 5");
    await captureUxReview(page, testInfo, "desktop-07-fine-tune");

    await makeExplicitSwap(page);
    await expect(page.getByText("Unapplied changes")).toBeVisible();
    await captureUxReview(page, testInfo, "desktop-08-fine-tune-dirty");

    await page.getByRole("button", { name: "Apply & review RFQ" }).click();
    const rfq = page.getByRole("dialog", { name: "Supplier verification RFQ" });
    await expect(rfq).toBeVisible();
    await assertFocusCycle(page, rfq, "supplier verification RFQ");
    await captureUxReview(page, testInfo, "desktop-09-rfq-review", { fullPage: false });
    await assertAccessible(page);
  });

  test("captures keyboard focus and upload/context states", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await captureUxReview(page, testInfo, "desktop-10-keyboard-focus", { fullPage: false });

    await reachActionStep(page);
    const uploadTrigger = page.getByRole("button", { name: /Upload customer inventory/ });
    await expect(uploadTrigger).toBeVisible();
    await uploadTrigger.click();
    const upload = page.getByRole("dialog", { name: "Upload inventory" });
    await expect(upload).toBeVisible();
    await assertFocusCycle(page, upload, "upload inventory");
    await captureUxReview(page, testInfo, "desktop-11-upload-dialog", { fullPage: false });
    await assertAccessible(page);

    await page.getByLabel("Inventory spreadsheet").setInputFiles(
      path.resolve("tests/fixtures/customer-owned-inventory.csv"),
    );
    await expect(page.getByText("1 accepted · 0 quarantined")).toBeVisible();
    await captureUxReview(page, testInfo, "desktop-12-upload-preview", { fullPage: false });

    await page.getByRole("button", { name: "Use uploaded facts as context" }).click();
    await expect(page.getByText(/Context shortlist/)).toBeVisible();
    await expect(page.getByText(/Evidence unavailable · context only/)).toBeVisible();
    await assertNoHorizontalOverflow(page, "uploaded context shortlist");
    await captureUxReview(page, testInfo, "desktop-13-context-shortlist");
  });
});

test.describe("responsive review", () => {
  test("keeps compact laptop layout coherent", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await reachRecommendedPackage(page);
    await assertNoHorizontalOverflow(page, "1024px recommended package");
    await captureUxReview(page, testInfo, "responsive-1024-recommended-package");
    await assertAccessible(page);
  });

  test("keeps tablet layout coherent", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await reachRecommendedPackage(page);
    await assertNoHorizontalOverflow(page, "834px recommended package");
    await captureUxReview(page, testInfo, "responsive-834-recommended-package");

    const zones = page.getByTestId("zone-card");
    await zones.nth(0).getByRole("button").first().click();
    await page.getByRole("button", { name: "View delivery story" }).click();
    const causalDialog = page.getByRole("dialog", { name: "How delivery was estimated" });
    await expect(causalDialog).toBeVisible();
    await assertFocusCycle(page, causalDialog, "tablet delivery story");
    await captureUxReview(page, testInfo, "responsive-834-delivery-story", { fullPage: false });
    await assertAccessible(page);
  });

  test("keeps 390px mobile layout free of page overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("region", { name: /Step 1 of 5:/ })).toBeVisible();
    await assertNoHorizontalOverflow(page, "390px step 1");
    await assertCriticalControlInViewport(page.getByRole("button", { name: "Continue to timing" }), "mobile Continue to timing");
    await captureUxReview(page, testInfo, "responsive-390-brief");

    await page.getByRole("button", { name: "Use default timing & budget" }).click();
    await expect(page.getByRole("region", { name: /Step 3 of 5:/ })).toBeVisible();
    await assertNoHorizontalOverflow(page, "390px recommended package");
    await expect(page.getByTestId("maplibre-renderer")).toHaveAttribute("data-camera-focus-state", "selected");
    await captureUxReview(page, testInfo, "responsive-390-recommended-package");
    await assertAccessible(page);
  });
});
