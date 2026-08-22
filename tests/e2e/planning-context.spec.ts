import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  captureUxReview,
} from "./helpers/uxReview";

async function reachRecommendedPackage(
  page: Page,
  preset?: string | RegExp,
): Promise<void> {
  await page.goto("/");
  if (preset) {
    await page.getByRole("button", { name: preset }).click();
  }
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
    "686f005fd0b0a43669971f7d9ecf8c6d861aa70c1390223f71a0b0107d33a075",
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

test("selects independent context families for each campaign objective", async ({
  page,
}) => {
  const cases = [
    {
      preset: /^Consumer goods .* Broad reach$/,
      expected: [
        "Large billboard overall affinity",
        "Major roads or highways",
        "Creative design",
      ],
      absent: ["Searched online", "Large billboard — trust"],
    },
    {
      preset: /^Real Estate .* Priority audience$/,
      expected: [
        "Large billboard — trust",
        "Recalled an OOH advertisement in the previous four weeks",
        "Creative design",
      ],
      absent: ["Major roads or highways", "Searched online"],
    },
    {
      preset: /^Bank \/ Fintech .* Likely customers$/,
      expected: [
        "Searched online",
        "Visited store or location",
        "Purchased product or service",
      ],
      absent: ["Major roads or highways", "Large billboard — trust"],
    },
  ] as const;

  for (const item of cases) {
    await reachRecommendedPackage(page, item.preset);
    const context = page.getByRole("region", { name: "Planning context" });
    await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
    for (const expected of item.expected) {
      await expect(context).toContainText(expected);
    }
    for (const absent of item.absent) {
      await expect(context).not.toContainText(absent);
    }
  }
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
