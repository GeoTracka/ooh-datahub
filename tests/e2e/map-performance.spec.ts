import { expect, test } from "@playwright/test";
import { MAP_CONTEXT_PATH } from "../../src/maps/mapAssets";

const COLD_CONTEXT_READY_BUDGET_MS = 5_000;
const STEP_THREE_READY_BUDGET_MS = 5_000;
const CONTEXT_TRANSFER_BUDGET_MS = 4_000;

type ResourceMeasure = {
  duration: number;
  downloadDuration: number;
  transferSize: number;
};

for (const motion of [
  { label: "default motion", reducedMotion: "no-preference" as const },
  { label: "reduced motion", reducedMotion: "reduce" as const },
]) {
  test(`keeps the local map-ready path within budget with ${motion.label}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion.reducedMotion });

    let contextRequestAt: number | null = null;
    let contextResponseAt: number | null = null;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === MAP_CONTEXT_PATH && contextRequestAt === null) {
        contextRequestAt = performance.now();
      }
    });
    page.on("response", (response) => {
      if (
        new URL(response.url()).pathname === MAP_CONTEXT_PATH &&
        response.ok() &&
        contextResponseAt === null
      ) {
        contextResponseAt = performance.now();
      }
    });

    const navigationStartedAt = performance.now();
    await page.goto("/planner");

    const renderer = page.getByTestId("maplibre-renderer");
    await expect(renderer).toHaveAttribute("data-context-state", "loaded");
    const contextLoadedAt = performance.now();

    const actionStartedAt = performance.now();
    await page.getByRole("button", { name: "Use default timing & budget" }).click();

    await expect(renderer).toHaveAttribute("data-camera-focus-state", "overview");
    const stepThreeReadyAt = performance.now();

    const readResourceMeasure = () => page.evaluate((path) => {
      const resource = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
        .find((entry) => new URL(entry.name).pathname === path);
      if (!resource) return null;
      return {
        duration: resource.duration,
        downloadDuration: resource.responseEnd - resource.responseStart,
        transferSize: resource.transferSize,
      } satisfies ResourceMeasure;
    }, MAP_CONTEXT_PATH);
    await expect.poll(readResourceMeasure).not.toBeNull();
    const timing = await readResourceMeasure();
    expect(timing).not.toBeNull();

    expect(contextRequestAt, "the revisioned local context request should be observed").not.toBeNull();
    expect(contextResponseAt, "the local context response should be observed").not.toBeNull();

    const navigationToContextDuration = contextLoadedAt - navigationStartedAt;
    const requestToContextDuration = contextLoadedAt - contextRequestAt!;
    const responseToContextDuration = contextLoadedAt - contextResponseAt!;
    const stepThreeReadyDuration = stepThreeReadyAt - actionStartedAt;
    console.log(
      `[map-performance] ${motion.label}: navigation-to-context=${navigationToContextDuration.toFixed(1)}ms, ` +
      `request-to-context=${requestToContextDuration.toFixed(1)}ms, ` +
      `response-to-context=${responseToContextDuration.toFixed(1)}ms, ` +
      `action-to-overview=${stepThreeReadyDuration.toFixed(1)}ms, ` +
      `resource=${timing!.duration.toFixed(1)}ms, download=${timing!.downloadDuration.toFixed(1)}ms, ` +
      `transfer=${timing!.transferSize}B`,
    );

    expect(navigationToContextDuration).toBeLessThan(COLD_CONTEXT_READY_BUDGET_MS);
    expect(requestToContextDuration).toBeGreaterThanOrEqual(0);
    expect(requestToContextDuration).toBeLessThan(COLD_CONTEXT_READY_BUDGET_MS);
    expect(responseToContextDuration).toBeGreaterThanOrEqual(0);
    expect(responseToContextDuration).toBeLessThan(CONTEXT_TRANSFER_BUDGET_MS);
    expect(stepThreeReadyDuration).toBeLessThan(STEP_THREE_READY_BUDGET_MS);
    expect(timing!.downloadDuration).toBeLessThan(CONTEXT_TRANSFER_BUDGET_MS);

    const canvas = page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);

    const markers = page.locator(".map-marker:visible");
    await expect(markers).toHaveCount(3);
    for (const marker of await markers.all()) {
      const markerBox = await marker.boundingBox();
      expect(markerBox).not.toBeNull();
      expect(markerBox!.width).toBeGreaterThan(0);
      expect(markerBox!.height).toBeGreaterThan(0);
    }
  });
}
