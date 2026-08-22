import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function reachActionStep(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use default timing & budget" }).click();
  await expect(page.getByRole("region", { name: /Step 3 of 5: Choose a planning approach/ })).toBeVisible();
  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();
}

test("local upload stays context-only and requires preflight before provider enrichment", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-04T00:00:00Z") });
  const apiCalls: string[] = [];
  const googlePolicy = (sourceField: string) => ({
    sourceProduct: "google.geocoding.v4",
    sourceField,
    contentClass: "GOOGLE_MAPS_CONTENT",
    allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
    displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
    persistence: { kind: "DELETE_AT", expiresAt: "2026-09-02T12:00:00.000Z" },
    attributionId: "google-maps",
    policyVersion: "2026-08-03",
    receivedAt: "2026-08-03T12:00:00.000Z",
  });
  await page.route("**/api/enrichment/preflight", async (route) => {
    apiCalls.push("preflight");
    await route.fulfill({ json: {
      id: "pf-fixture",
      providerProducts: ["Google Geocoding API v4"],
      transmittedFields: ["address", "Accept-Language: en"],
      maximumCalls: 1,
      costEstimate: "Cost unavailable — rate card not configured",
      retention: "30 consecutive days",
      attribution: "Google Maps",
      eligibility: "context only",
      disabledCapabilities: {
        placesAggregate: { enabled: false, reason: "LEGAL_AND_COMMERCIAL_APPROVAL_REQUIRED" },
        routes: { enabled: false, reason: "DISPLAY_CONTEXT_APPROVAL_REQUIRED" },
      },
    }});
  });
  await page.route("**/api/enrichment/run", async (route) => {
    apiCalls.push("run");
    await route.fulfill({ json: [{
      status: "REVIEW_REQUIRED",
      candidates: [{
        candidateToken: "fixture-low-precision",
        providerPlaceId: { value: "places/fixture-yaba", policy: googlePolicy("results.placeId") },
        coordinate: { value: { latitude: 6.5158, longitude: 3.3717 }, policy: googlePolicy("results.location") },
        granularity: { value: "APPROXIMATE", policy: googlePolicy("results.granularity") },
        formattedAddress: { value: "Yaba, Lagos, Nigeria", policy: googlePolicy("results.formattedAddress") },
        resultTypes: { value: ["locality"], policy: googlePolicy("results.types") },
        quality: {
          resultOrdinal: 0,
          resultCount: 1,
          countryMatches: true,
          localityMatches: true,
          viewportAmbiguous: true,
          partialMatch: "UNAVAILABLE_IN_V4",
        },
      }],
    }] });
  });

  await reachActionStep(page);
  const uploadTrigger = page.getByRole("button", { name: /Upload customer inventory/ });
  await uploadTrigger.click();
  const initialUploadDialog = page.getByRole("dialog", { name: "Upload inventory" });
  await expect(initialUploadDialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(initialUploadDialog).not.toBeVisible();
  await expect(uploadTrigger).toBeFocused();

  await uploadTrigger.click();
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  expect(apiCalls).toEqual([]);
  await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toBeVisible();
  await page.getByRole("button", { name: "Add uploaded inventory to the plan" }).click();
  expect(apiCalls).toEqual([]);

  const firstStatus = page.getByRole("complementary", { name: "Uploaded inventory status" });
  await expect(firstStatus).toContainText("Uploaded inventory · comparison only");
  await expect(firstStatus).toContainText("Add audience-checking data");
  await expect(firstStatus).toContainText("Inventory change not yet applied");

  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await page.getByRole("button", { name: /^Adjust package/ }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("region", { name: /Step 4 of 5:/ })).toBeVisible();

  await page.getByRole("button", { name: /Upload customer inventory/ }).click();
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 ready · 0 need review · 0 cannot be used")).toBeVisible();
  await page.getByRole("button", { name: "Check location details" }).click();
  await expect.poll(() => apiCalls).toEqual(["preflight"]);
  await page.getByRole("button", { name: "Check suggested locations" }).click();
  await expect.poll(() => apiCalls).toEqual(["preflight", "run"]);
  await expect(page.getByRole("region", { name: "Location review" })).toBeVisible();
  await expect(page.getByText(/Yaba, Lagos, Nigeria/)).toBeVisible();
  await page.getByRole("button", { name: "Add reviewed inventory to the plan" }).click();

  const reviewedStatus = page.getByRole("complementary", { name: "Uploaded inventory status" });
  await expect(reviewedStatus).toContainText("Uploaded inventory · comparison only");
  await expect(reviewedStatus).toContainText("Add audience-checking data");
  await expect(reviewedStatus).toContainText("Inventory change not yet applied");

  await page.getByRole("button", { name: "Continue with selected package" }).click();
  await page.getByRole("button", { name: /^Adjust package/ }).click();
  await page.getByRole("button", { name: "Review supplier request" }).click();
  const rfq = page.getByRole("dialog", { name: "Supplier request" });
  await expect(rfq).toBeVisible();
  await rfq.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("complementary", { name: "Uploaded planning status" })).toContainText("Applied plan context");
});
