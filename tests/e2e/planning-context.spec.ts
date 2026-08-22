import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  captureUxReview,
} from "./helpers/uxReview";

async function reachRecommendedPackage(
  page: import("@playwright/test").Page,
  preset?: string,
) {
  await page.goto("/");
  if (preset) await page.getByRole("button", { name: preset }).click();
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

test("exposes broad-reach Lagos signals without changing package evidence", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reachRecommendedPackage(page);

  const packageBefore = await page.getByTestId("package-strip").innerText();
  const optionOrderBefore = await page
    .locator(".package-option-card")
    .allTextContents();
  const context = page.getByRole("region", { name: "Planning context" });
  await expect(context).toBeVisible();
  await expect(context).toHaveAttribute("data-objective", "broad_reach");
  await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
  await expect(context).toContainText("72%");
  await expect(context).toContainText(
    "Recalled an OOH advertisement in the previous four weeks",
  );
  await expect(context).toContainText("35%");
  await expect(context).toContainText("Major roads or highways");
  await expect(context).toContainText("38%");
  await expect(context).toContainText("Large static billboard");
  await expect(context).toContainText("Lagos");
  await expect(context).toContainText("Broad reach objective");
  await expect(context).toContainText("n=204");
  await expect(context).toContainText("20 May–3 Jun 2026");
  await expect(context).toContainText("Context only");

  const explore = context.getByRole("button", {
    name: "Explore survey context",
  });
  await explore.click();
  const drawer = page.getByRole("dialog", { name: "Consumer survey context" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Broad reach");
  await expect(drawer).toContainText("201 applicable responses");
  await expect(drawer).toContainText("202 applicable responses");
  await expect(drawer).toContainText("204 applicable responses");
  await expect(drawer).toContainText(
    "Prioritizes recent recall, the most common visibility environment, and the format respondents found hardest to ignore.",
  );
  await expect(drawer).toContainText(
    "The campaign objective selects which three facts are surfaced; it does not change the package calculation or ranking.",
  );
  await expect(drawer).toContainText("unweighted descriptive aggregates");
  await expect(drawer).toContainText(
    "It is not observed movement, exposure geometry, OTS, reach, frequency, unique reach, target share, influence, Planning Fit, or calibration evidence.",
  );
  await drawer.getByText("Technical source details").click();
  await expect(drawer).toContainText("broad_reach");
  await expect(drawer).toContainText(
    "c0644a87d54060b71963f7b9cedaf994efec3828a62400d5c4c92340ea1b64fa",
  );
  await expect(drawer).toContainText(
    "795e392c77ef8ece87e4ff3ff35dfbce478ca483def211ec5ba3a47d8497e928",
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
  expect(await page.locator(".package-option-card").allTextContents()).toEqual(
    optionOrderBefore,
  );
});

for (const scenario of [
  {
    objective: "influential_core",
    preset: "Real Estate · Priority audience",
    profileLabel: "Priority audience objective",
    values: ["4.13 / 5", "36%", "28%"],
    metrics: [
      "Large billboard — trust",
      "Relevant to my life",
      "Creative design",
    ],
  },
  {
    objective: "near_conversion",
    preset: "Bank / Fintech · Likely customers",
    profileLabel: "Likely customers objective",
    values: ["4.16 / 5", "27%", "21%"],
    metrics: [
      "Large billboard — effect",
      "Visited store or location",
      "Searched online",
    ],
  },
] as const) {
  test(`selects the ${scenario.profileLabel} survey profile from the campaign brief`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await reachRecommendedPackage(page, scenario.preset);

    const context = page.getByRole("region", { name: "Planning context" });
    await expect(context).toHaveAttribute("data-objective", scenario.objective);
    await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
    await expect(context).toContainText(scenario.profileLabel);
    for (const value of scenario.values)
      await expect(context).toContainText(value);
    for (const metric of scenario.metrics)
      await expect(context).toContainText(metric);
  });
}

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
