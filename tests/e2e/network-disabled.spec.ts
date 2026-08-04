import { expect, test } from "@playwright/test";

test("seeded flow makes no external request", async ({ page }) => {
  const external: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      external.push(url.toString());
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page.getByTestId("package-strip")).toBeVisible();
  expect(external).toEqual([]);
});
