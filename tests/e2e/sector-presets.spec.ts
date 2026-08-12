import { expect, test } from "@playwright/test";

for (const preset of [
  { label: "Consumer goods · Broad reach", sector: "fmcg" },
  { label: "Real Estate · Priority audience", sector: "real_estate" },
  { label: "Bank / Fintech · Likely customers", sector: "bank_fintech" },
]) {
  test(preset.label + " builds from the same evidence-labelled explorer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: preset.label }).click();
    await page.getByRole("button", { name: "Continue to timing" }).click();
    await page.getByRole("button", { name: "Show recommended areas" }).click();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await expect(page.getByText(/Estimated audience reach/).first()).toBeVisible();
    await expect(page.getByText(/Early estimate/).first()).toBeVisible();
    await expect(page.getByLabel("Sector")).not.toBeVisible();
  });
}

test("default-profile skip goes directly to the recommendation decision", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ })).toBeVisible();
  await expect(page.getByTestId("zone-card")).toHaveCount(3);
});

test("fine-tune blocks an invalid removal until Undo restores the package", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await page.getByRole("button", { name: /^Adjust package/ }).click();

  await page.getByLabel("Media location to remove").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Remove selected location" }).click();
  const apply = page.getByRole("button", { name: "Apply & review supplier request" });
  await expect(apply).toBeDisabled();

  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect(page.getByRole("button", { name: "Review supplier request" })).toBeEnabled();
});
