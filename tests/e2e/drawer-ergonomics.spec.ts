import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow } from "./helpers/uxReview";

async function expectTarget(locator: Locator, label: string, minHeight = 36): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have geometry`).not.toBeNull();
  expect(box!.height, `${label} should have a comfortable target`).toBeGreaterThanOrEqual(minHeight);
}

async function expectDrawerOwnsScroll(page: Page, dialog: Locator, background: Locator): Promise<void> {
  const dialogOverflow = await dialog.evaluate((element) => getComputedStyle(element).overflowY);
  const body = dialog.locator(".planner-drawer-body");
  const bodyOverflow = await body.evaluate((element) => getComputedStyle(element).overflowY);
  const backgroundOverflow = await background.evaluate((element) => getComputedStyle(element).overflowY);

  expect(dialogOverflow, "drawer shell should not be the scrolling region").toBe("hidden");
  expect(bodyOverflow, "drawer body should own vertical scrolling").toBe("auto");
  expect(backgroundOverflow, "background wizard card should not compete for scroll").toBe("hidden");
}

async function reachRecommendedPackage(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ })).toBeVisible();
}

async function openDeliveryStory(page: Page): Promise<Locator> {
  await reachRecommendedPackage(page);
  const zones = page.getByTestId("zone-card");
  await zones.nth(1).getByRole("button").first().click();
  await page.getByRole("button", { name: "See how this was estimated" }).click();
  const dialog = page.getByRole("dialog", { name: "How the estimate was built" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function reachActionStep(page: Page): Promise<void> {
  await reachRecommendedPackage(page);
  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
}

async function makeExplicitSwap(page: Page): Promise<void> {
  const currentFace = page.getByLabel("Current media location to swap");
  const replacementFace = page.getByLabel("Replacement media location");
  const candidateCount = await currentFace.locator("option").count();
  for (let index = 1; index < candidateCount; index += 1) {
    await currentFace.selectOption({ index });
    if (await replacementFace.locator("option").count() > 1) {
      await replacementFace.selectOption({ index: 1 });
      await page.getByRole("button", { name: "Swap selected location" }).click();
      return;
    }
  }
  throw new Error("NO_FINE_TUNE_SWAP_AVAILABLE");
}

async function openRfq(page: Page): Promise<Locator> {
  await reachActionStep(page);
  await page.getByRole("button", { name: /^Adjust package/ }).click();
  await expect(page.getByRole("region", { name: /Step 5 of 5:/ })).toBeVisible();
  await makeExplicitSwap(page);
  await page.getByRole("button", { name: "Apply & review supplier request" }).click();
  const dialog = page.getByRole("dialog", { name: "Supplier request" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

test.describe("drawer ergonomics", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("makes causal navigation and close comfortably interactive", async ({ page }) => {
    const dialog = await openDeliveryStory(page);
    const background = page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ });
    await expectDrawerOwnsScroll(page, dialog, background);

    const stageNames = ["Media locations", "Area information", "Estimated movement", "Possible ad views", "Relevant audience", "Estimated people reached"];
    for (const name of stageNames) {
      await expectTarget(dialog.getByRole("button", { name, exact: true }), `Causal stage ${name}`);
    }
    const close = dialog.getByRole("button", { name: "Close" });
    await expectTarget(close, "Causal drawer Close", 40);

    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    const outlineWidth = await close.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth));
    expect(outlineWidth).toBeGreaterThanOrEqual(2);
    await assertNoHorizontalOverflow(page, "desktop causal drawer");
  });

  test("gives RFQ confirmation a real control surface", async ({ page }) => {
    const dialog = await openRfq(page);
    const background = page.getByRole("region", { name: /Step 5 of 5:/ });
    await expectDrawerOwnsScroll(page, dialog, background);

    const confirmation = dialog.getByRole("checkbox", { name: "Dates confirmed" });
    await expectTarget(confirmation, "Dates confirmed checkbox", 24);
    const label = confirmation.locator("xpath=ancestor::label");
    await expectTarget(label, "Dates confirmed label", 42);
    await expectTarget(dialog.getByRole("button", { name: "Close" }), "RFQ Close", 40);
    await assertNoHorizontalOverflow(page, "RFQ drawer");
  });

  test("makes upload row selection comfortably interactive", async ({ page }) => {
    await reachActionStep(page);
    await page.getByRole("button", { name: /Upload customer inventory/ }).click();
    const dialog = page.getByRole("dialog", { name: "Upload inventory" });
    await expect(dialog).toBeVisible();
    const background = page.getByRole("region", { name: /Step 4 of 5:/ });
    await expectDrawerOwnsScroll(page, dialog, background);

    await page.getByLabel("Inventory spreadsheet").setInputFiles(
      path.resolve("tests/fixtures/customer-owned-inventory.csv"),
    );
    await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toBeVisible();

    const rowCheckbox = dialog.getByRole("checkbox").first();
    await expectTarget(rowCheckbox, "Upload row checkbox", 24);
    const rowLabel = rowCheckbox.locator("xpath=ancestor::label");
    await expectTarget(rowLabel, "Upload row label", 42);
    await expectTarget(dialog.getByRole("button", { name: "Close" }), "Upload Close", 40);
    await assertNoHorizontalOverflow(page, "upload drawer");
  });
});

test("keeps tablet causal navigation comfortable with one scroll owner", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  const dialog = await openDeliveryStory(page);
  const background = page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ });
  await expectDrawerOwnsScroll(page, dialog, background);

  const stageButtons = dialog.getByRole("navigation", { name: "How the estimate was built" }).getByRole("button");
  await expect(stageButtons).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await expectTarget(stageButtons.nth(index), `tablet causal stage ${index + 1}`);
  }
  await assertNoHorizontalOverflow(page, "tablet causal drawer");
});
