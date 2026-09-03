import { expect, test } from "@playwright/test";

test("five-step consumer-goods planner reaches a supplier request", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.getByRole("region", { name: /Step 1 of 5:/ })).toBeVisible();

  await page.getByRole("button", { name: "Continue to timing" }).click();
  await expect(page.getByRole("region", { name: /Step 2 of 5:/ })).toBeVisible();
  await page.getByRole("group", { name: "Campaign time" })
    .getByRole("button", { name: "Evening" }).click();
  await page.getByRole("button", { name: "Show recommended areas" }).click();

  await expect(page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ })).toBeVisible();
  await expect(page.getByTestId("zone-card")).toHaveCount(3);
  await expect(page.getByText(/Estimated audience reach/).first()).toBeVisible();
  await expect(page.getByText(/Early estimate/).first()).toBeVisible();

  const zoneCards = page.getByTestId("zone-card");
  await zoneCards.nth(1).getByRole("button").first().click();
  await expect(page.getByRole("dialog", { name: "How the estimate was built" }))
    .not.toBeVisible();
  await page.getByRole("button", { name: "See how this was estimated" }).click();
  const explanation = page.getByRole("dialog", { name: "How the estimate was built" });
  await expect(explanation).toBeVisible();
  for (const stage of ["Media locations", "Area information", "Estimated movement", "Possible ad views", "Relevant audience", "Estimated people reached"]) {
    await expect(explanation.getByRole("button", { name: stage, exact: true })).toBeVisible();
  }
  await explanation.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
  await page.getByRole("button", { name: /^Adjust package/ }).click();
  await expect(page.getByRole("region", { name: /Step 5 of 5:/ })).toBeVisible();

  const currentFace = page.getByLabel("Current media location to swap");
  const replacementFace = page.getByLabel("Replacement media location");
  const candidateCount = await currentFace.locator("option").count();
  let foundSwap = false;
  for (let index = 1; index < candidateCount; index += 1) {
    await currentFace.selectOption({ index });
    if (await replacementFace.locator("option").count() > 1) {
      await replacementFace.selectOption({ index: 1 });
      foundSwap = true;
      break;
    }
  }
  expect(foundSwap).toBe(true);
  await page.getByRole("button", { name: "Swap selected location" }).click();
  await expect(page.getByText("Changes not yet applied")).toBeVisible();
  await page.getByRole("button", { name: "Apply & review supplier request" }).click();

  await expect(page.getByText("DRAFT — NOT YET SENT")).toBeVisible();
  await page.getByLabel("Buyer name").fill("Ada Okafor");
  await page.getByLabel("Buyer email").fill("buyer@example.test");
  await page.getByLabel("Response deadline").fill("2026-08-20");
  await page.getByLabel("Dates confirmed").check();
  await page.getByRole("button", { name: "Create supplier request" }).click();
  await expect(page.getByText("Generated", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Download consolidated internal request",
  })).toBeVisible();
});
