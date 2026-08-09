import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function assertAccessible(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  // Visual regression should capture settled spatial states rather than a
  // mid-flight MapLibre camera frame. This exercises the same reduced-motion
  // accessibility path supported by the production renderer.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("locks the split-canvas explorer hierarchy and interaction states", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: /Step 1 of 5:/ })).toBeVisible();
  await expect(page).toHaveScreenshot("explorer-step1.png", { animations: "disabled" });
  await assertAccessible(page);

  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Recommended package/ })).toBeVisible();
  await expect(page).toHaveScreenshot("explorer-step3.png", { animations: "disabled" });

  const zones = page.getByTestId("zone-card");
  await zones.nth(1).getByRole("button").first().click();
  await expect(page.getByRole("button", { name: "View delivery story" })).toBeVisible();
  await expect(page).toHaveScreenshot("explorer-step3-focused.png", { animations: "disabled" });
  await assertAccessible(page);

  await page.getByRole("button", { name: "This package works" }).click();
  await page.getByRole("button", { name: /Fine-tune package/ }).click();
  await page.getByRole("button", { name: "Swap first face in its zone" }).click();
  await expect(page.getByText("Unapplied changes")).toBeVisible();
  await expect(page).toHaveScreenshot("explorer-step5-dirty.png", { animations: "disabled" });
  await assertAccessible(page);
});

test("keeps the explorer legible at 390 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5:/ })).toBeVisible();
  await expect(page).toHaveScreenshot("explorer-mobile-390.png", {
    animations: "disabled",
    fullPage: true,
  });
  await assertAccessible(page);
});
