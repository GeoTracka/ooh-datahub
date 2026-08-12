import { expect, test } from "@playwright/test";

test("seeded explorer makes no external request", async ({ page }) => {
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
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByTestId("package-strip")).toBeVisible();
  await expect(page.getByTestId("maplibre-renderer"))
    .toHaveAttribute("data-context-state", "loaded");
  expect(external).toEqual([]);
});
