import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function assertAccessible(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("locks the sparse result, four lenses, six causal stages, dirty draft and RFQ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page).toHaveScreenshot("sparse-first-result.png", { animations: "disabled" });
  await assertAccessible(page);

  for (const lens of ["Plan", "Activity", "Reach", "Influence"]) {
    await page.getByRole("tab", { name: lens }).click();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await expect(page).toHaveScreenshot("lens-" + lens.toLowerCase() + ".png", {
      animations: "disabled",
    });
  }

  const firstZone = page.getByTestId("zone-card").first();
  await firstZone.getByRole("button").first().click();
  const explanation = page.getByRole("dialog", { name: "How delivery was estimated" });
  await explanation.getByRole("button", { name: /^Site / }).first().click();
  for (const stage of ["Location", "Places", "Movement", "OTS", "Target", "Unique"]) {
    await page.getByRole("button", { name: stage }).click();
    await expect(page.getByText("Transformation")).toBeVisible();
    await expect(page).toHaveScreenshot("causal-" + stage.toLowerCase() + ".png", {
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByLabel("Campaign time").selectOption("evening");
  await expect(page).toHaveScreenshot("dirty-draft.png", { animations: "disabled" });
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  await expect(page).toHaveScreenshot("rfq-review.png", { animations: "disabled" });
  await assertAccessible(page);
});

test("keeps the core visual legible at 390 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page).toHaveScreenshot("mobile-390.png", {
    animations: "disabled",
    fullPage: true,
  });
  await assertAccessible(page);
});
