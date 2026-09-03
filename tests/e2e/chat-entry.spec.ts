import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 820, height: 700 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
  test(`chat is the homepage with reachable manual planning at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole("heading", { name: "What are we planning today?" })).toBeVisible();
    const composer = page.getByRole("textbox", { name: "Describe your campaign" });
    await expect(composer).toBeVisible();
    const box = await composer.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (viewport.width <= 1000) await page.getByText("Menu", { exact: true }).click();
    const navigation = viewport.width <= 1000 ? page.getByRole("navigation", { name: "Workspace menu" }) : page.getByRole("navigation", { name: "Planning tools" });
    await navigation.getByRole("link", { name: "Plan manually" }).click();
    await expect(page).toHaveURL(/\/planner$/);
    await expect(page.getByRole("link", { name: "AI chat", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "AI chat", exact: true }).click();
    await expect(composer).toBeVisible();
  });
}

test("guest can compose before sign-in without sending an AI request", async ({ page }) => {
  let aiRequests = 0;
  page.on("request", request => { if (request.url().includes("/api/chat/")) aiRequests++; });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Describe your campaign" }).fill("Plan a Lagos campaign");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=\/chat$/);
  expect(aiRequests).toBe(0);
  await page.goto("/chat");
  await expect(page.getByRole("textbox")).toHaveValue("Plan a Lagos campaign");
});

test("tablet manual planner retains its map area", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 700 });
  await page.goto("/planner");
  const card = page.locator(".explorer-step-card");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(700 * 0.55 + 1);
  expect(box!.y).toBeGreaterThan(200);
});

test("phone menu can be opened with the keyboard and dismissed with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const summary = page.locator(".ai-navigation-menu summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Workspace menu" }).getByRole("link", { name: "Plan manually" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".ai-navigation-menu")).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
});
