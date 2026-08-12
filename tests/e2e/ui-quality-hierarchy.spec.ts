import { expect, test, type Locator, type Page } from "@playwright/test";

async function reachRecommendedPackage(page: Page, preset?: string | RegExp): Promise<void> {
  await page.goto("/");
  if (preset) await page.getByRole("button", { name: preset }).click();
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(
    page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ }),
  ).toBeVisible();
}

async function expectPackageMetricsContained(page: Page): Promise<void> {
  const cells = await page.locator(".package-option-metrics > span")
    .evaluateAll((elements) => elements.map((element) => {
      const cell = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        children: Array.from(element.children).map((child) => {
          const box = child.getBoundingClientRect();
          return { left: box.left, right: box.right };
        }),
        left: cell.left,
        right: cell.right,
      };
    }));

  expect(cells.length).toBeGreaterThan(0);
  for (const [cellIndex, cell] of cells.entries()) {
    expect(cell.scrollWidth, `metric cell ${cellIndex + 1} should not overflow`)
      .toBeLessThanOrEqual(cell.clientWidth + 1);
    for (const [childIndex, child] of cell.children.entries()) {
      expect(child.left, `metric ${cellIndex + 1}.${childIndex + 1} left edge`)
        .toBeGreaterThanOrEqual(cell.left - 1);
      expect(child.right, `metric ${cellIndex + 1}.${childIndex + 1} right edge`)
        .toBeLessThanOrEqual(cell.right + 1);
    }
  }
}

async function expectComfortableTarget(
  locator: Locator,
  label: string,
  minimumHeight = 36,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have measurable geometry`).not.toBeNull();
  expect(box!.height, `${label} target height`).toBeGreaterThanOrEqual(minimumHeight);
}

async function expectFullyInViewport(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have measurable geometry`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, `${label} should have a viewport`).not.toBeNull();
  expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height, `${label} bottom edge`).toBeLessThanOrEqual(viewport!.height + 1);
}

type Rect = { x: number; y: number; width: number; height: number };

function expectNoOverlap(first: Rect, second: Rect, label: string): void {
  const overlaps = first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
  expect(
    overlaps,
    `${label} should not overlap; first=${JSON.stringify(first)} second=${JSON.stringify(second)}`,
  ).toBe(false);
}

async function expectCameraHierarchy(page: Page, label: string): Promise<void> {
  const toolbarLocator = page.getByRole("group", { name: "Map camera" });
  const toolbar = await toolbarLocator.boundingBox();
  const lenses = await page.locator(".explorer-lenses").boundingBox();
  const rail = await page.locator(".explorer-card-rail").boundingBox();
  const overlays = await page.locator(".explorer-map-overlays").boundingBox();
  const map = await page.locator(".explorer-map-stage").boundingBox();

  expect(toolbar, `${label} camera toolbar geometry`).not.toBeNull();
  expect(lenses, `${label} lenses geometry`).not.toBeNull();
  expect(rail, `${label} rail geometry`).not.toBeNull();
  expect(overlays, `${label} map overlays geometry`).not.toBeNull();
  expect(map, `${label} map geometry`).not.toBeNull();
  expect(toolbar!.x).toBeGreaterThanOrEqual(map!.x);
  expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(map!.x + map!.width + 1);
  expect(toolbar!.y).toBeGreaterThanOrEqual(map!.y);
  expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(map!.y + map!.height + 1);

  expectNoOverlap(toolbar!, lenses!, `${label} camera toolbar and lenses`);
  expectNoOverlap(toolbar!, rail!, `${label} camera toolbar and rail`);
  expectNoOverlap(toolbar!, overlays!, `${label} camera toolbar and map overlays`);

  const buttons = toolbarLocator.getByRole("button");
  await expect(buttons).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expectComfortableTarget(buttons.nth(index), `${label} camera action ${index + 1}`, 44);
  }

  const markers = page.locator(".map-marker");
  await expect(markers).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const marker = await markers.nth(index).boundingBox();
    expect(marker, `${label} package marker ${index + 1}`).not.toBeNull();
    expect(marker!.width, `${label} package marker ${index + 1} target width`)
      .toBeGreaterThanOrEqual(44);
    expect(marker!.height, `${label} package marker ${index + 1} target height`)
      .toBeGreaterThanOrEqual(44);
    expectNoOverlap(toolbar!, marker!, `${label} camera toolbar and package marker ${index + 1}`);
  }
}

async function expectMapAttributionClearAndClickable(page: Page, label: string): Promise<void> {
  const attribution = page.getByRole("link", {
    name: /Map data © OpenStreetMap contributors/i,
  });
  const attributionBox = await attribution.boundingBox();
  const mapBox = await page.locator(".explorer-map-stage").boundingBox();
  const railBox = await page.locator(".explorer-card-rail").boundingBox();

  expect(attributionBox, `${label} attribution geometry`).not.toBeNull();
  expect(mapBox, `${label} map geometry`).not.toBeNull();
  expect(railBox, `${label} rail geometry`).not.toBeNull();
  expect(attributionBox!.width, `${label} attribution target width`).toBeGreaterThanOrEqual(44);
  expect(attributionBox!.height, `${label} attribution target height`).toBeGreaterThanOrEqual(44);
  expect(attributionBox!.x, `${label} attribution left edge`).toBeGreaterThanOrEqual(mapBox!.x);
  expect(attributionBox!.x + attributionBox!.width, `${label} attribution right edge`)
    .toBeLessThanOrEqual(mapBox!.x + mapBox!.width);
  expect(attributionBox!.y, `${label} attribution top edge`).toBeGreaterThanOrEqual(mapBox!.y);
  if (railBox!.y > mapBox!.y) {
    expect(attributionBox!.y + attributionBox!.height, `${label} attribution above rail`)
      .toBeLessThanOrEqual(railBox!.y - 6);
  } else {
    expect(attributionBox!.x, `${label} attribution to the right of rail`)
      .toBeGreaterThanOrEqual(railBox!.x + railBox!.width);
  }

  await attribution.evaluate((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      document.documentElement.dataset.mapAttributionClicked = "true";
    }, { once: true });
  });
  await attribution.click();
  await expect(page.locator("html")).toHaveAttribute("data-map-attribution-clicked", "true");
}

async function expectComparisonFitsWithoutHorizontalScroll(page: Page): Promise<void> {
  const geometry = await page.locator(".package-option-grid").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    "desktop package comparison should not require horizontal scrolling",
  ).toBeLessThanOrEqual(geometry.clientWidth + 2);

  const comparison = await page.locator(".package-option-grid").boundingBox();
  expect(comparison).not.toBeNull();
  const cards = page.locator(".package-option-card");
  await expect(cards).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const card = await cards.nth(index).boundingBox();
    expect(card, `package option ${index + 1} should have geometry`).not.toBeNull();
    expect(card!.x).toBeGreaterThanOrEqual(comparison!.x - 1);
    expect(card!.x + card!.width).toBeLessThanOrEqual(
      comparison!.x + comparison!.width + 1,
    );
  }
}

async function keyboardFocus(page: Page, target: Locator, label: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`KEYBOARD_FOCUS_TARGET_NOT_REACHED: ${label}`);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

test.describe("desktop package comparison hierarchy", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("shows all three planning approaches without clipping", async ({ page }) => {
    await reachRecommendedPackage(page);
    await expectComparisonFitsWithoutHorizontalScroll(page);

    const rail = await page.locator(".explorer-card-rail").boundingBox();
    expect(rail).not.toBeNull();
    expect(rail!.width).toBeGreaterThanOrEqual(720);
    expect(rail!.width).toBeLessThanOrEqual(800);
    expect(
      1440 - (rail!.x + rail!.width),
      "desktop comparison should retain meaningful map width",
    ).toBeGreaterThanOrEqual(600);
  });

  test("keeps Step 3 map content inside a true right-hand pane", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await reachRecommendedPackage(page);
    await expect(page.getByTestId("maplibre-renderer"))
      .toHaveAttribute("data-camera-focus-state", "overview");

    const rail = await page.locator(".explorer-card-rail").boundingBox();
    const map = await page.locator(".explorer-map-stage").boundingBox();
    const packageMarkers = page.locator(".map-marker");
    const lensTabs = await page.getByRole("tablist", { name: "Map lens" }).boundingBox();
    const legend = await page
      .getByRole("complementary", { name: "Map lens legend" })
      .boundingBox();
    const planningNote = await page.locator(".explorer-map-note").boundingBox();

    expect(rail).not.toBeNull();
    expect(map).not.toBeNull();
    await expect(packageMarkers).toHaveCount(3);
    expect(lensTabs).not.toBeNull();
    expect(legend).not.toBeNull();
    expect(planningNote).not.toBeNull();
    expect(rail!.width).toBeGreaterThanOrEqual(720);
    expect(rail!.width).toBeLessThanOrEqual(800);
    expect(map!.x).toBeGreaterThanOrEqual(rail!.x + rail!.width - 1);
    expect(map!.width).toBeGreaterThanOrEqual(600);
    for (let index = 0; index < 3; index += 1) {
      const marker = await packageMarkers.nth(index).boundingBox();
      expect(marker, `package marker ${index + 1} geometry`).not.toBeNull();
      expect(marker!.x).toBeGreaterThanOrEqual(map!.x);
      expect(marker!.x + marker!.width).toBeLessThanOrEqual(map!.x + map!.width);
      expect(marker!.y).toBeGreaterThanOrEqual(map!.y);
      expect(marker!.y + marker!.height).toBeLessThanOrEqual(map!.y + map!.height);
    }
    for (const [label, control] of [
      ["lens tabs", lensTabs],
      ["legend", legend],
      ["planning note", planningNote],
    ] as const) {
      expect(control!.x, `${label} left edge`).toBeGreaterThanOrEqual(map!.x);
      expect(control!.x + control!.width, `${label} right edge`)
        .toBeLessThanOrEqual(map!.x + map!.width);
      expect(control!.y, `${label} top edge`).toBeGreaterThanOrEqual(map!.y);
      expect(control!.y + control!.height, `${label} bottom edge`)
        .toBeLessThanOrEqual(map!.y + map!.height);
    }
  });

  test("contains package metrics for every objective at desktop breakpoints", async ({ page }) => {
    const presets = [
      /^FMCG .* Broad reach$/,
      /^Real Estate .* Influential core$/,
      /^Bank \/ Fintech .* Near conversion$/,
    ];
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const preset of presets) {
        await reachRecommendedPackage(page, preset);
        await expectPackageMetricsContained(page);
      }
    }
  });

  test("gives workflow-critical secondary actions comfortable targets", async ({ page }) => {
    await reachRecommendedPackage(page);
    await page.getByTestId("zone-card").nth(1).getByRole("button").first().click();

    const deliveryStory = page.getByRole("button", { name: "View delivery story" });
    const fineTune = page.getByRole("button", { name: "Fine-tune selected package" });
    const back = page.getByRole("button", { name: "Back" });

    await expectComfortableTarget(deliveryStory, "View delivery story");
    await expectComfortableTarget(fineTune, "Fine-tune selected package", 44);
    await expectComfortableTarget(back, "Back");

    await keyboardFocus(page, deliveryStory, "View delivery story");
    await expect(deliveryStory).toBeFocused();
    const outline = await deliveryStory.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).not.toBe("none");
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test("makes the pre-recommendation map read as an intentional planning canvas", async ({ page }) => {
    await page.goto("/");
    const content = await page.locator(".explorer-map-stage").evaluate((element) =>
      getComputedStyle(element, "::after").content,
    );
    expect(content).toContain("Planning canvas");
    expect(content).toContain("Recommendations will anchor here");
  });
});

for (const viewport of [
  { width: 1440, height: 900, label: "1440x900 desktop" },
  { width: 900, height: 900, label: "900x900 tablet" },
  { width: 390, height: 844, label: "390x844 mobile" },
]) {
  test(`keeps the compact camera hierarchy collision-free at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await reachRecommendedPackage(page);
    await expect(page.getByTestId("maplibre-renderer"))
      .toHaveAttribute("data-camera-focus-state", "overview");
    await expectCameraHierarchy(page, viewport.label);
  });
}

test("keeps all three approaches and both decision paths visible at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await reachRecommendedPackage(page);
  await expectComparisonFitsWithoutHorizontalScroll(page);
  const primaryAction = page.getByRole("button", { name: "Continue with selected package" });
  const fineTuneAction = page.getByRole("button", { name: "Fine-tune selected package" });
  await expect(primaryAction).toBeVisible();
  await expectFullyInViewport(page, primaryAction, "Continue with selected package");
  await expectFullyInViewport(page, fineTuneAction, "Fine-tune selected package");
});

for (const viewport of [
  { width: 1440, height: 900, label: "1440px desktop" },
  { width: 390, height: 844, label: "390px mobile" },
  { width: 900, height: 900, label: "900px tablet" },
]) {
  test(`keeps responsive map attribution above the Step 3 card rail and clickable at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await reachRecommendedPackage(page);
    await expectMapAttributionClearAndClickable(page, viewport.label);
  });
}

test("keeps a focused recommendation comparable and actionable at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await reachRecommendedPackage(page);
  const cards = page.getByTestId("zone-card");
  await cards.nth(1).getByRole("button").first().click();
  await expect(cards.nth(1)).toHaveClass(/selected/);
  await expectComparisonFitsWithoutHorizontalScroll(page);

  const deliveryStory = page.getByRole("button", { name: "View delivery story" });
  await expect(deliveryStory).toBeVisible();
  await expectComfortableTarget(deliveryStory, "focused View delivery story");
  await expectFullyInViewport(page, deliveryStory, "focused View delivery story");
  await expectFullyInViewport(
    page,
    page.getByRole("button", { name: "Continue with selected package" }),
    "focused Continue with selected package",
  );
});
