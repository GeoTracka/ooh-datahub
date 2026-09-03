import { expect, test } from "@playwright/test";

type Rect = { x: number; y: number; width: number; height: number };

function overlaps(first: Rect, second: Rect, clearance = 0): boolean {
  return first.x < second.x + second.width + clearance &&
    first.x + first.width + clearance > second.x &&
    first.y < second.y + second.height + clearance &&
    first.y + first.height + clearance > second.y;
}

function expectClear(first: Rect, second: Rect, label: string): void {
  expect(
    overlaps(first, second, 4),
    `${label}: ${JSON.stringify(first)} should not collide with ${JSON.stringify(second)}`,
  ).toBe(false);
}

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
  await page.goto("/planner");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByTestId("package-strip")).toBeVisible();
  await expect(page.getByTestId("maplibre-renderer"))
    .toHaveAttribute("data-context-state", "loaded");
  expect(external).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900, label: "desktop" },
  { width: 390, height: 844, label: "mobile" },
]) {
  test(`keeps package locations and selected camera focus through a local context retry on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const contextPattern = "**/map/lagos-open-context.geojson*";
    await page.route(contextPattern, (route) => route.abort("failed"));

    await page.goto("/planner");
    await page.getByRole("button", { name: "Use default timing & budget" }).click();

    const renderer = page.getByTestId("maplibre-renderer");
    await expect(renderer).toHaveAttribute("data-context-state", "error");
    await expect(renderer).toHaveAttribute("aria-busy", "false");
    const degraded = page.locator(".map-context-status-error");
    await expect(degraded).toContainText(
      "The Lagos planning map is unavailable. Package locations are still shown.",
    );
    const markers = page.locator(".map-marker");
    await expect(markers).toHaveCount(3);
    const toolbar = page.getByRole("group", { name: "Map camera" });
    await expect(toolbar).toBeVisible();

    const degradedBox = await degraded.boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    const railBox = await page.locator(".explorer-card-rail").boundingBox();
    expect(degradedBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    expectClear(degradedBox!, toolbarBox!, "degraded status and camera toolbar");
    expectClear(degradedBox!, railBox!, "degraded status and card rail");
    expectClear(toolbarBox!, railBox!, "camera toolbar and card rail");

    const markerBoxes = await markers.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    for (const markerBox of markerBoxes) {
      expectClear(markerBox, degradedBox!, "package marker and degraded status");
      expectClear(markerBox, toolbarBox!, "package marker and camera toolbar");
      expectClear(markerBox, railBox!, "package marker and card rail");
    }

    const cards = page.getByTestId("zone-card");
    let selectedMarkerLabel: string | null = null;
    if (viewport.label === "desktop") {
      await cards.nth(1).getByRole("button").first().click();
      await expect(cards.nth(1)).toHaveClass(/selected/);
      await expect(renderer).toHaveAttribute("data-camera-focus-state", "selected");
      const selectedMarker = page.locator(".map-marker.selected");
      await expect(selectedMarker).toHaveCount(1);
      selectedMarkerLabel = await selectedMarker.getAttribute("aria-label");
      expect(selectedMarkerLabel).toBeTruthy();
    } else {
      await expect(renderer).toHaveAttribute("data-camera-focus-state", "overview");
    }

    const retry = page.getByRole("button", { name: "Retry map" });
    const retryBox = await retry.boundingBox();
    expect(retryBox).not.toBeNull();
    expect(retryBox!.height).toBeGreaterThanOrEqual(44);

    await page.unroute(contextPattern);
    await retry.click();
    await expect(renderer).toHaveAttribute("data-context-state", "loading");
    await expect(renderer).toHaveAttribute("aria-busy", "true");
    await expect(renderer).toHaveAttribute("data-context-state", "loaded", { timeout: 15_000 });
    await expect(markers).toHaveCount(3);
    if (selectedMarkerLabel) {
      await expect(cards.nth(1)).toHaveClass(/selected/);
      await expect(renderer).toHaveAttribute("data-camera-focus-state", "selected");
      await expect(page.locator(".map-marker.selected")).toHaveAttribute(
        "aria-label",
        selectedMarkerLabel,
      );
    } else {
      await expect(renderer).toHaveAttribute("data-camera-focus-state", "overview");
    }
  });
}
