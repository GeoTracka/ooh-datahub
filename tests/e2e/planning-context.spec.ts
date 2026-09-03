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
  await page.goto("/planner");
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

async function reachCustomAudience(page: Page, targetAudience: string) {
  await page.goto("/planner");
  await page.getByText("Edit campaign details").click();
  await page.getByLabel("Target audience").fill(targetAudience);
  await page.getByLabel("Product information").fill("Segment resolution test");
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

test("exposes a transparent student-segment lens without changing package evidence", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reachRecommendedPackage(page);

  const packageBefore = await page.getByTestId("package-strip").innerText();
  const optionsBefore = await page.locator(".package-option-grid").innerText();
  const context = page.getByRole("region", { name: "Planning context" });
  await expect(context).toBeVisible();
  await expect(
    context.getByRole("group", { name: "Survey audience lens" }),
  ).toContainText("Aged 18–25");
  await expect(context).toContainText("Next available matched segment");
  await expect(context).toContainText(
    "Matched brief terms: “students”, “young workers”",
  );
  await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
  await expect(context).toContainText("4.12 / 5");
  await expect(context).toContainText("Large billboard overall affinity");
  await expect(context).toContainText("35%");
  await expect(context).toContainText("Major roads or highways");
  await expect(context).toContainText("23%");
  await expect(context).toContainText("Creative design");
  await expect(context).toContainText("Lagos");
  await expect(context).toContainText("n=43");
  await expect(context).toContainText("20 May–3 Jun 2026");
  await expect(context).toContainText("Context only");

  const explore = context.getByRole("button", {
    name: "Explore survey context",
  });
  await explore.click();
  const drawer = page.getByRole("dialog", { name: "Consumer survey context" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Aged 18–25");
  await expect(drawer).toContainText("43 respondents");
  await expect(drawer).toContainText("41 applicable responses");
  await expect(drawer).toContainText(
    "Occupation = Student did not clear the minimum sample of 30",
  );
  await expect(drawer).toContainText("Age band = 18-25");
  await expect(drawer).toContainText("unweighted descriptive aggregates");
  await expect(drawer).toContainText(
    "It is not observed movement, exposure geometry, OTS, reach, frequency, unique reach, target share, influence, Planning Fit, or calibration evidence.",
  );
  await drawer.getByText("Technical source details").click();
  await expect(drawer).toContainText(
    "b44c4073ceb9056d88a061c40dbeaa70fa2154ff9ad32b4242bc6863bbb8552e",
  );
  await expect(drawer).toContainText(
    "f050dae3adc181d7f3cb7b530aaa42d19efe95ea30895f9becc861e92ab6d42b",
  );
  await expect(drawer).toContainText(
    "3a4f9fcd8c88b1cf1246328cf677147bb22f94e33088ee7288ed30314173a99c",
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
  expect(await page.locator(".package-option-grid").innerText()).toBe(
    optionsBefore,
  );
});

test("allows a reviewed manual audience lens, restores automatic mode, and resets a stale override after an audience change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reachRecommendedPackage(page);

  const packageBefore = await page.getByTestId("package-strip").innerText();
  const optionsBefore = await page.locator(".package-option-grid").innerText();
  const context = page.getByRole("region", { name: "Planning context" });
  await context.getByRole("button", { name: "Explore survey context" }).click();

  const drawer = page.getByRole("dialog", { name: "Consumer survey context" });
  const lensSelect = drawer.getByLabel("Audience lens");
  await expect(lensSelect).toHaveValue("__automatic__");
  await lensSelect.selectOption("occupation:business-trader");
  await drawer.getByRole("button", { name: "Apply lens" }).click();

  await expect(drawer).toContainText("Manual override");
  await expect(drawer).toContainText("Business owners and traders");
  await expect(drawer).toContainText("77 respondents");
  await expect(context).toHaveAttribute("data-audience-lens-mode", "manual");
  await expect(context).toContainText("Business owners and traders");
  await expect(context).toContainText("Manual override");
  await expect(context).toContainText("n=77");
  await expect(context).toContainText("4.09 / 5");
  await expect(context).toContainText("39%");
  await expect(context).toContainText("30%");
  expect(await page.getByTestId("package-strip").innerText()).toBe(
    packageBefore,
  );
  expect(await page.locator(".package-option-grid").innerText()).toBe(
    optionsBefore,
  );

  await drawer.getByRole("button", { name: "Use automatic match" }).click();
  await expect(drawer).toContainText("Automatic from brief");
  await expect(context).toHaveAttribute("data-audience-lens-mode", "automatic");
  await expect(context).toContainText("Aged 18–25");
  await expect(context).toContainText("n=43");

  await lensSelect.selectOption("transportMode:bus-or-brt");
  await drawer.getByRole("button", { name: "Apply lens" }).click();
  await expect(context).toContainText("Bus or BRT users");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByText("Edit campaign details").click();
  await page.getByLabel("Target audience").fill("SME owners and merchants");
  await page.getByLabel("Product information").fill("Audience basis changed");
  await page
    .getByRole("button", { name: "Use default timing & budget" })
    .click();

  await expect(
    page.getByRole("region", {
      name: /Step 3 of 5: Choose a planning approach/,
    }),
  ).toBeVisible();
  const refreshedContext = page.getByRole("region", {
    name: "Planning context",
  });
  await expect(refreshedContext).toHaveAttribute(
    "data-audience-lens-mode",
    "automatic",
  );
  await expect(refreshedContext).toContainText("Business owners and traders");
  await expect(refreshedContext).toContainText("Matched from campaign brief");
  await expect(refreshedContext).toContainText("n=77");
});

test("selects independent segment and context families for each campaign preset", async ({
  page,
}) => {
  const cases = [
    {
      preset: /^Consumer goods .* Broad reach$/,
      audience: "Aged 18–25",
      sample: "n=43",
      expected: [
        "4.12 / 5",
        "Large billboard overall affinity",
        "35%",
        "Major roads or highways",
        "23%",
        "Creative design",
      ],
    },
    {
      preset: /^Real Estate .* Priority audience$/,
      audience: "Business owners and traders",
      sample: "n=77",
      expected: [
        "4.03 / 5",
        "Large billboard — trust",
        "78%",
        "Recalled an OOH advertisement in the previous four weeks",
        "30%",
        "Size/visibility",
      ],
    },
    {
      preset: /^Bank \/ Fintech .* Likely customers$/,
      audience: "Business owners and traders",
      sample: "n=77",
      expected: [
        "14%",
        "Searched online",
        "21%",
        "Visited store or location",
        "17%",
        "Purchased product or service",
      ],
    },
  ] as const;

  for (const item of cases) {
    await reachRecommendedPackage(page, item.preset);
    const context = page.getByRole("region", { name: "Planning context" });
    await expect(context.getByTestId("planning-context-signal")).toHaveCount(3);
    await expect(context).toContainText(item.audience);
    await expect(context).toContainText(item.sample);
    for (const expected of item.expected) {
      await expect(context).toContainText(expected);
    }
  }
});

test("falls back visibly when a requested audience segment is below n=30", async ({
  page,
}) => {
  await reachCustomAudience(page, "Private car commuters and remote workers");
  const context = page.getByRole("region", { name: "Planning context" });
  await expect(context).toContainText("All Lagos respondents");
  await expect(context).toContainText("Broader sample used");
  await expect(context).toContainText("n=204");

  await context.getByRole("button", { name: "Explore survey context" }).click();
  const drawer = page.getByRole("dialog", { name: "Consumer survey context" });
  await expect(drawer).toContainText("Broader city fallback");
  await expect(drawer).toContainText("Primary transport = Private car");
  await expect(drawer).toContainText("Mobility pattern = Remote");
  await expect(drawer).toContainText(
    "did not clear the minimum sample of 30; using the broader Lagos sample",
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
