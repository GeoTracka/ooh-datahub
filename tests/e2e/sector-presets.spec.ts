import { expect, test } from "@playwright/test";

for (const preset of [
  { label: "FMCG · Broad reach", sector: "fmcg" },
  { label: "Real Estate · Influential core", sector: "real_estate" },
  { label: "Bank / Fintech · Near conversion", sector: "bank_fintech" },
]) {
  test(preset.label + " builds from the same evidence-labelled explorer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: preset.label }).click();
    await page.getByRole("button", { name: "Continue to timing" }).click();
    await page.getByRole("button", { name: "Show recommended zones" }).click();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await expect(page.getByText(/Scenario target reach/)).toBeVisible();
    await expect(page.getByText(/Evidence D/).first()).toBeVisible();
    await expect(page.getByLabel("Sector")).not.toBeVisible();
  });
}

test("default-profile skip goes directly to the recommendation decision", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Recommended package/ })).toBeVisible();
  await expect(page.getByTestId("zone-card")).toHaveCount(3);
});

test("fine-tune blocks an invalid removal until Undo restores the package", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await page.getByRole("button", { name: "This package works" }).click();
  await page.getByRole("button", { name: /Fine-tune package/ }).click();

  await page.getByLabel("Face to remove").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Remove selected face" }).click();
  const apply = page.getByRole("button", { name: "Apply & review RFQ" });
  await expect(apply).toBeDisabled();

  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect(page.getByRole("button", { name: "Review RFQ" })).toBeEnabled();
});
