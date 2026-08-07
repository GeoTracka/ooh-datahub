import { expect, test } from "@playwright/test";

for (const preset of [
  { value: "fmcg", label: "FMCG" },
  { value: "real_estate", label: "Real Estate" },
  { value: "bank_fintech", label: "Bank / Fintech" },
]) {
  test(preset.label + " builds from the same evidence-labelled engine", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Sector").selectOption(preset.value);
    await page.getByRole("button", { name: "Build campaign" }).click();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await expect(page.getByText(/Scenario target reach/)).toBeVisible();
    await expect(page.getByText(/Evidence D/).first()).toBeVisible();
  });
}

test("objective, time, budget, include, remove, swap, undo and apply stay coherent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await page.getByLabel("Objective").selectOption("influential_core");
  await expect(page.getByText(/Marginal influence/).first()).toBeVisible();
  await page.getByLabel("Campaign time").selectOption("evening");
  await page.getByLabel(/Budget \(NGN\)/).fill("20000000");
  await page.getByRole("button", { name: "Include compatible face" }).click();
  await page.getByRole("button", { name: "Swap first face in its zone" }).click();
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await expect(page.getByText("Unapplied changes")).toBeVisible();

  const undo = page.getByRole("button", { name: "Undo" });
  await undo.click();
  await undo.click();
  await undo.click();
  const apply = page.getByRole("button", { name: "Apply & review RFQ" });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByRole("dialog", { name: "Supplier verification RFQ" })).toBeVisible();
});
