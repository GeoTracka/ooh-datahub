import { expect, test, type Locator, type Page } from "@playwright/test";

async function reachRecommendedPackage(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(
    page.getByRole("region", { name: /Step 3 of 5: Recommended package/ }),
  ).toBeVisible();
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
  const geometry = await page.locator(".recommendation-carousel").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    "desktop recommendation comparison should not require horizontal scrolling",
  ).toBeLessThanOrEqual(geometry.clientWidth + 2);

  const carousel = await page.locator(".recommendation-carousel").boundingBox();
  expect(carousel).not.toBeNull();
  const cards = page.getByTestId("zone-card");
  await expect(cards).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const card = await cards.nth(index).boundingBox();
    expect(card, `recommendation ${index + 1} should have geometry`).not.toBeNull();
    expect(card!.x).toBeGreaterThanOrEqual(carousel!.x - 1);
    expect(card!.x + card!.width).toBeLessThanOrEqual(
      carousel!.x + carousel!.width + 1,
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

test.describe("desktop recommendation hierarchy", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("shows all three recommendation ranks without clipping", async ({ page }) => {
    await reachRecommendedPackage(page);
    await expectComparisonFitsWithoutHorizontalScroll(page);

    const rail = await page.locator(".explorer-card-rail").boundingBox();
    expect(rail).not.toBeNull();
    expect(rail!.width).toBeGreaterThanOrEqual(760);
    expect(
      1440 - (rail!.x + rail!.width),
      "desktop comparison should retain meaningful map width",
    ).toBeGreaterThanOrEqual(300);
  });

  test("gives workflow-critical secondary actions comfortable targets", async ({ page }) => {
    await reachRecommendedPackage(page);

    const deliveryStory = page.getByRole("button", { name: "View delivery story" });
    const fullPackage = page.getByRole("button", { name: "View full package" });
    const back = page.getByRole("button", { name: "Back" });

    await expectComfortableTarget(deliveryStory, "View delivery story");
    await expectComfortableTarget(fullPackage, "View full package");
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

test("keeps all three ranks and the decision CTA visible at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await reachRecommendedPackage(page);
  await expectComparisonFitsWithoutHorizontalScroll(page);
  const primaryAction = page.getByRole("button", { name: "This package works" });
  await expect(primaryAction).toBeVisible();
  await expectFullyInViewport(page, primaryAction, "This package works");
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
    page.getByRole("button", { name: "This package works" }),
    "focused This package works",
  );
});
