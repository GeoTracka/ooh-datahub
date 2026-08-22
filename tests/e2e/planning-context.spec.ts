import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  captureUxReview,
} from "./helpers/uxReview";

async function reachRecommendedPackage(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use default timing & budget" })
    .click();
  await expect(
    page.getByRole("region", {
      name: /Step 3 of 5: Choose a planning approach/,
    }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
});

test("exposes three Lagos survey signals without changing package evidence", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reachRecommendedPackage(page);

  const packageBefore = await page.getByTestId("package-strip").innerText();
  const context = page.getByRole("region", { name: "Planning context" });
  await expect(context).toBeVisible();
  await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
  await expect(context).toContainText("4.14 / 5");
  await expect(context).toContainText("Large billboard overall affinity");
  await expect(context).toContainText("35%");
  await expect(context).toContainText("Major roads or highways");
  await expect(context).toContainText("28%");
  await expect(context).toContainText("Creative design");
  await expect(context).toContainText("Lagos");
  await expect(context).toContainText("n=204");
  await expect(context).toContainText("20 May–3 Jun 2026");
  await expect(context).toContainText("Context only");

  const explore = context.getByRole("button", {
    name: "Explore survey context",
  });
  await explore.click();
  const drawer = page.getByRole("dialog", { name: "Consumer survey context" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("177 applicable responses");
  await expect(drawer).toContainText("202 applicable responses");
  await expect(drawer).toContainText("unweighted descriptive aggregates");
  await expect(drawer).toContainText(
    "It is not observed movement, exposure geometry, OTS, reach, frequency, unique reach, target share, influence, Planning Fit, or calibration evidence.",
  );
  await drawer.getByText("Technical source details").click();
  await expect(drawer).toContainText(
    "c0644a87d54060b71963f7b9cedaf994efec3828a62400d5c4c92340ea1b64fa",
  );
  await expect(drawer).toContainText(
    "cb9aefb8119ff0c1d6c7a7935b0b184600466d8a47bf73d2667c0bffb330bf8a",
  );

  await assertNoHorizontalOverflow(page, "planning-context drawer");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await captureUxReview(page, testInfo, "planning-context-desktop-drawer", {
    fullPage: false,
  });

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(explore).toBeFocused();
  expect(await page.getByTestId("package-strip").innerText()).toBe(
    packageBefore,
  );
});

test("keeps the compact context strip and drawer horizontally contained on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reachRecommendedPackage(page);
  await assertNoHorizontalOverflow(page, "mobile planning-context strip");

  const context = page.getByRole("region", { name: "Planning context" });
  await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
  await context.getByRole("button", { name: "Explore survey context" }).click();
  await expect(
    page.getByRole("dialog", { name: "Consumer survey context" }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page, "mobile planning-context drawer");
  await captureUxReview(page, testInfo, "planning-context-mobile-drawer", {
    fullPage: false,
  });
});
