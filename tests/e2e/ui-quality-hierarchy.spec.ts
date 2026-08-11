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
      .toHaveAttribute("data-camera-focus-state", "selected");

    const rail = await page.locator(".explorer-card-rail").boundingBox();
    const map = await page.locator(".explorer-map-stage").boundingBox();
    const selectedMarker = await page.locator(".map-marker.selected").boundingBox();
    const lensTabs = await page.getByRole("tablist", { name: "Map lens" }).boundingBox();
    const legend = await page
      .getByRole("complementary", { name: "Map lens legend" })
      .boundingBox();
    const planningNote = await page.locator(".explorer-map-note").boundingBox();

    expect(rail).not.toBeNull();
    expect(map).not.toBeNull();
    expect(selectedMarker).not.toBeNull();
    expect(lensTabs).not.toBeNull();
    expect(legend).not.toBeNull();
    expect(planningNote).not.toBeNull();
    expect(rail!.width).toBeGreaterThanOrEqual(720);
    expect(rail!.width).toBeLessThanOrEqual(800);
    expect(map!.x).toBeGreaterThanOrEqual(rail!.x + rail!.width - 1);
    expect(map!.width).toBeGreaterThanOrEqual(600);
    expect(selectedMarker!.x).toBeGreaterThanOrEqual(map!.x);
    expect(selectedMarker!.x + selectedMarker!.width)
      .toBeLessThanOrEqual(map!.x + map!.width);
    const markerCenter = selectedMarker!.x + selectedMarker!.width / 2;
    const mapCenter = map!.x + map!.width / 2;
    expect(Math.abs(markerCenter - mapCenter), "selected marker should be centered in map pane")
      .toBeLessThanOrEqual(40);
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
