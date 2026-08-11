import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  collectUxReviewDiagnostics,
} from "./helpers/uxReview";

async function assertAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function reachFineTune(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await page.getByRole("button", { name: "This package works" }).click();
  await page.getByRole("button", { name: /Fine-tune package/ }).click();
  const step = page.getByRole("region", { name: /Step 5 of 5: Make this package yours/ });
  await expect(step).toBeVisible();
  return step;
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

async function expectNoInternalScroll(step: Locator, label: string): Promise<void> {
  const geometry = await step.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(
    geometry.scrollHeight,
    `${label}: desktop Step 5 should fit without an internal vertical scrollbar`,
  ).toBeLessThanOrEqual(geometry.clientHeight + 2);
}

async function expectFullyInViewport(locator: Locator, label: string): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label}: should have geometry`).not.toBeNull();
  const viewport = await locator.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectAllAdjustmentModes(page: Page): Promise<void> {
  for (const name of [
    "Add a compatible face",
    "Swap a face",
    "Replace a zone",
    "Remove a face",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

test.describe("desktop fine-tune workspace", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("fits the clean editing workspace and decision action in one viewport", async ({ page }) => {
    const step = await reachFineTune(page);
    await expectNoInternalScroll(step, "clean fine-tune");
    await expectAllAdjustmentModes(page);
    await expectFullyInViewport(page.getByRole("button", { name: "Review RFQ" }), "Review RFQ");

    const rail = await page.locator(".explorer-card-rail").boundingBox();
    expect(rail).not.toBeNull();
    expect(rail!.width).toBeGreaterThanOrEqual(850);
    expect(
      1440 - (rail!.x + rail!.width),
      "fine-tune workspace should retain meaningful map context",
    ).toBeGreaterThanOrEqual(300);

    const diagnostics = await collectUxReviewDiagnostics(page);
    expect(diagnostics.actionableNestedScrollCandidates).toEqual([]);
    await assertNoHorizontalOverflow(page, "desktop clean fine-tune");
    await assertAccessible(page);
  });

  test("keeps dirty decision evidence beside edits without reintroducing card scroll", async ({ page }) => {
    const step = await reachFineTune(page);
    await makeExplicitSwap(page);
    await expect(page.getByText("Unapplied changes")).toBeVisible();
    await expect(page.getByRole("region", { name: "Proposed package change summary" })).toBeVisible();
    await expectAllAdjustmentModes(page);
    await expectNoInternalScroll(step, "dirty fine-tune");
    await expectFullyInViewport(
      page.getByRole("button", { name: "Apply & review RFQ" }),
      "Apply & review RFQ",
    );

    const diagnostics = await collectUxReviewDiagnostics(page);
    expect(diagnostics.actionableNestedScrollCandidates).toEqual([]);
    await assertNoHorizontalOverflow(page, "desktop dirty fine-tune");
    await assertAccessible(page);
  });
});

test("keeps the 1024px fine-tune workspace coherent and horizontally contained", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await reachFineTune(page);
  await expectAllAdjustmentModes(page);
  await assertNoHorizontalOverflow(page, "1024px fine-tune");
  const action = page.getByRole("button", { name: "Review RFQ" });
  await action.scrollIntoViewIfNeeded();
  await expectFullyInViewport(action, "1024px Review RFQ");
  await assertAccessible(page);
});

test("does not rank intentional mobile and tablet primary scrolling as nested-scroll debt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const mobile = await collectUxReviewDiagnostics(page);
  expect(mobile.nestedScrollableContainers.length).toBeGreaterThan(0);
  expect(mobile.actionableNestedScrollCandidates).toEqual([]);

  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Recommended package/ })).toBeVisible();
  const tablet = await collectUxReviewDiagnostics(page);
  expect(tablet.nestedScrollableContainers.length).toBeGreaterThan(0);
  expect(tablet.actionableNestedScrollCandidates).toEqual([]);
});
