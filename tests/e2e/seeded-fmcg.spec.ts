import { expect, test } from "@playwright/test";

test("four-minute FMCG path reaches a verification RFQ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page.getByTestId("zone-card")).toHaveCount(3);
  await expect(page.getByText(/Scenario target reach/)).toBeVisible();
  await expect(page.getByText(/Evidence D/).first()).toBeVisible();

  const firstZone = page.getByTestId("zone-card").first();
  await firstZone.getByRole("button").first().click();
  const explanation = page.getByRole("dialog", { name: "How delivery was estimated" });
  await explanation.getByRole("button", { name: /^Site / }).first().click();
  await expect(explanation).toBeVisible();
  for (const stage of ["Location", "Places", "Movement", "OTS", "Target", "Unique"]) {
    await expect(explanation.getByRole("button", { name: stage, exact: true })).toBeVisible();
  }
  await explanation.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Campaign time").selectOption("evening");
  await expect(page.getByText("Unapplied changes")).toBeVisible();
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  await expect(page.getByText("DEMO — DO NOT SEND")).toBeVisible();
  await page.getByLabel("Buyer name").fill("Demo Buyer");
  await page.getByLabel("Buyer email").fill("buyer@example.test");
  await page.getByLabel("Response deadline").fill("2026-08-20");
  await page.getByLabel("Dates confirmed").check();
  await page.getByRole("button", { name: "Generate RFQ" }).click();
  await expect(page.getByText("Generated", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Download consolidated internal request",
  })).toBeVisible();
});
