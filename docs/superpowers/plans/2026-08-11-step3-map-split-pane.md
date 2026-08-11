# Step 3 Map Split-Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Step 3 desktop map a visible, correctly centered right-hand pane instead of a full-screen map hidden behind an oversized recommendation rail.

**Architecture:** Keep the component tree and map behavior unchanged. Use a Step 3-scoped CSS custom property as the shared pane boundary for both the recommendation rail and fixed map stage, allowing MapLibre's container resize handling to recenter the scene inside the visible pane. Preserve the existing responsive layout below 1024 pixels.

**Tech Stack:** Next.js 16, React 19, CSS, MapLibre GL, Playwright

---

### Task 1: Lock the desktop map-pane geometry

**Files:**
- Modify: `tests/e2e/ui-quality-hierarchy.spec.ts`

- [ ] **Step 1: Add the failing desktop geometry test**

Add a Playwright test after the existing desktop comparison-width test:

```ts
test("keeps Step 3 map content inside a true right-hand pane", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await reachRecommendedPackage(page);
  await expect(page.getByTestId("maplibre-renderer"))
    .toHaveAttribute("data-camera-focus-state", "selected");

  const rail = await page.locator(".explorer-card-rail").boundingBox();
  const map = await page.locator(".explorer-map-stage").boundingBox();
  const selectedMarker = await page.locator(".map-marker.selected").boundingBox();
  const lensTabs = await page.getByRole("tablist", { name: "Map lens" }).boundingBox();
  const legend = await page.getByRole("complementary", { name: "Map lens legend" }).boundingBox();

  expect(rail).not.toBeNull();
  expect(map).not.toBeNull();
  expect(selectedMarker).not.toBeNull();
  expect(lensTabs).not.toBeNull();
  expect(legend).not.toBeNull();
  expect(rail!.width).toBeGreaterThanOrEqual(720);
  expect(rail!.width).toBeLessThanOrEqual(800);
  expect(map!.x).toBeGreaterThanOrEqual(rail!.x + rail!.width - 1);
  expect(map!.width).toBeGreaterThanOrEqual(600);
  expect(selectedMarker!.x).toBeGreaterThanOrEqual(map!.x);
  expect(selectedMarker!.x + selectedMarker!.width).toBeLessThanOrEqual(map!.x + map!.width);
  expect(lensTabs!.x).toBeGreaterThanOrEqual(map!.x);
  expect(legend!.x).toBeGreaterThanOrEqual(map!.x);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
pnpm exec playwright test tests/e2e/ui-quality-hierarchy.spec.ts --grep "true right-hand pane"
```

Expected: FAIL because the current rail is about 1,000 pixels and `.explorer-map-stage` still begins at `x = 0`.

- [ ] **Step 3: Commit the regression test**

```powershell
git add tests/e2e/ui-quality-hierarchy.spec.ts
git commit -m "test: reproduce hidden Step 3 map pane"
```

### Task 2: Make Step 3 a true split pane

**Files:**
- Modify: `src/app/package-options.css`
- Test: `tests/e2e/ui-quality-hierarchy.spec.ts`

- [ ] **Step 1: Implement the shared pane boundary**

Replace the current Step 3 desktop rail-width rule with:

```css
@media (min-width: 1024px) {
  .explorer-shell:has(.explorer-step-card[aria-label^="Step 3 of 5: Choose a planning approach"]) {
    --step-three-rail-width: clamp(720px, 52vw, 800px);
  }

  .explorer-card-rail:has(.explorer-step-card[aria-label^="Step 3 of 5: Choose a planning approach"]) {
    width: var(--step-three-rail-width);
  }

  .explorer-shell:has(.explorer-step-card[aria-label^="Step 3 of 5: Choose a planning approach"]) .explorer-map-stage {
    left: var(--step-three-rail-width);
  }
}
```

Keep all other Step 3 comparison, package strip, carousel, and sticky action rules unchanged.

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```powershell
pnpm exec playwright test tests/e2e/ui-quality-hierarchy.spec.ts --grep "true right-hand pane"
```

Expected: PASS with the map beginning at the recommendation rail edge and selected marker visible inside the map pane.

- [ ] **Step 3: Run responsive and visual verification**

Run:

```powershell
pnpm exec playwright test tests/e2e/ui-quality-hierarchy.spec.ts tests/e2e/ux-review.spec.ts tests/e2e/visual-accessibility.spec.ts
```

Expected: PASS at 1440, 1024, 834, and 390 pixel layouts with no accessibility violations or horizontal overflow. Update only platform-local visual snapshots for inspection; do not commit Windows baselines.

- [ ] **Step 4: Run complete verification**

Run:

```powershell
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all tests and build checks pass; the known unrelated lint warning in `scripts/rebuild-entity-resolution.ts` may remain.

- [ ] **Step 5: Commit the fix**

```powershell
git add src/app/package-options.css tests/e2e/ui-quality-hierarchy.spec.ts
git commit -m "fix: keep Step 3 map in visible pane"
```

- [ ] **Step 6: Deploy and verify production**

Build a new release image from the exact commit, start it on a temporary loopback port, verify the Step 3 pane with Playwright, then atomically replace only the `ooh-datahub` container. Confirm HTTPS 200, healthy container state, MariaDB started, and no Postgres container.
