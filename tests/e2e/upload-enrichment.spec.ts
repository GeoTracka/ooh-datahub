import path from "node:path";
import { expect, test } from "@playwright/test";

test("local upload requires preflight before a fixture enrichment run", async ({ page }) => {
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
  await page.goto("/");
  await page.getByRole("button", { name: "Upload spreadsheet" }).click();
  const initialUploadDialog = page.getByRole("dialog", { name: "Upload inventory" });
  await expect(initialUploadDialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(initialUploadDialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Upload spreadsheet" })).toBeFocused();
  await page.getByRole("button", { name: "Upload spreadsheet" }).click();
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  expect(apiCalls).toEqual([]);
  await expect(page.getByText("1 accepted · 0 quarantined")).toBeVisible();
  await page.getByRole("button", { name: "Use uploaded facts as context" }).click();
  expect(apiCalls).toEqual([]);
  await expect(page.getByText(/Context shortlist/)).toBeVisible();
  await expect(page.getByText(/Evidence unavailable · context only/)).toBeVisible();
  await expect(page.getByText("Unapplied context change")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/Context shortlist/)).not.toBeVisible();

  await page.getByRole("button", { name: "Upload spreadsheet" }).click();
  await page.getByLabel("Inventory spreadsheet").setInputFiles(
    path.resolve("tests/fixtures/customer-owned-inventory.csv"),
  );
  await expect(page.getByText("1 accepted · 0 quarantined")).toBeVisible();
  await page.getByRole("button", { name: "Review enrichment" }).click();
  await expect.poll(() => apiCalls).toEqual(["preflight"]);
  await page.getByRole("button", { name: "Enrich locations" }).click();
  await expect.poll(() => apiCalls).toEqual(["preflight", "run"]);
  await expect(page.getByRole("region", { name: "Geocode review" })).toBeVisible();
  await expect(page.getByText(/Yaba, Lagos, Nigeria/)).toBeVisible();
  await page.getByRole("button", { name: "Use reviewed facts as context" }).click();
  await expect(page.getByText(/Context shortlist/)).toBeVisible();
  await expect(page.getByText("CALIBRATION_BUNDLE_MISMATCH")).toBeVisible();
  await expect(page.getByText(/feature-compatible calibration bundle/)).toBeVisible();
  await expect(page.getByText(/Evidence unavailable · context only/)).toBeVisible();
  await expect(page.getByText("Unapplied context change")).toBeVisible();
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  const rfq = page.getByRole("dialog", { name: "Supplier verification RFQ" });
  await expect(rfq).toBeVisible();
  await rfq.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Applied plan context")).toBeVisible();
  await expect(page).toHaveScreenshot("upload-customer-context.png", {
    animations: "disabled",
  });
});
