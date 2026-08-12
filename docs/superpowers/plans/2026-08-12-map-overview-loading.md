# Package Overview and Map Loading Implementation Plan

> **For Codex:** Execute this plan with subagent-driven development, test-driven development, and independent UI/UX review.

**Goal:** Make Step 3 open on the complete recommended package and make the Lagos context map fast, legible, and recoverable without adding dashboard bloat.

**Architecture:** Keep package selection in `PlannerPage`, camera actions in renderer-agnostic props, and MapLibre-specific fit/retry behavior inside `MapLibreRenderer`. Reuse the existing warm editorial map styling, add only a compact two-action camera control, and use the existing marker captions as the intentionally sparse location labels. Revision the context asset URL, preload it from the document shell, and enforce cache and payload budgets in tests.

**Tech Stack:** Next.js 16, React 19, TypeScript, MapLibre GL, `@vis.gl/react-maplibre`, Vitest/Testing Library, Playwright.

---

## Task 1: Deterministic package camera model

**Files:**
- Create: `src/maps/mapCamera.ts`
- Create: `tests/unit/maps/mapCamera.test.ts`
- Modify: `src/features/PlannerPage.tsx`
- Modify: `tests/component/PlannerPage.test.tsx`

**Steps:**
1. Add failing unit tests for empty, single-point, and multi-point package camera targets.
2. Implement a pure helper returning Lagos fallback, single-point target, or package bounds.
3. Add a failing Planner test showing entry to Step 3 clears the focused zone.
4. Change Step 3/package changes to default to package overview while preserving deliberate zone selection.
5. Run the focused tests and typecheck.

## Task 2: Compact overview and refocus controls

**Files:**
- Modify: `src/features/MapStage.tsx`
- Modify: `src/maps/MapCanvas.tsx`
- Modify: `src/maps/MapLibreRenderer.tsx`
- Modify: `src/maps/GoogleRenderer.tsx`
- Modify: `src/app/explorer-polish.css`
- Modify: `tests/component/MapStage.test.tsx`
- Create or modify: `tests/component/MapLibreRenderer.test.tsx`

**Steps:**
1. Add failing tests for `Package overview`, a selected-zone refocus action, and request propagation.
2. Add a small top-left camera toolbar with accessible pressed/disabled states and 44px touch targets.
3. Fit all scene coordinates for overview; refocus the selected marker on demand; honor reduced motion.
4. Preserve all package markers and use the existing selected-marker treatment for emphasis.
5. Verify component tests, typecheck, and targeted lint.

## Task 3: Sparse orientation and responsive hierarchy

**Files:**
- Modify: `src/maps/MapLibreRenderer.tsx`
- Modify: `src/app/explorer-polish.css`
- Modify: `tests/component/MapLibreRenderer.test.tsx`
- Modify: `tests/e2e/ui-quality-hierarchy.spec.ts`

**Steps:**
1. Add tests that package zone captions remain visible and selected labels receive stronger emphasis.
2. Keep orientation labels limited to package locations plus existing corridor geometry; do not introduce a dense navigation label layer.
3. Add responsive collision checks for toolbar, lens rail, legend, attribution, and mobile bottom sheet.
4. Capture and inspect desktop, tablet, and mobile screenshots.

## Task 4: Revisioned cache and early fetch

**Files:**
- Create: `src/maps/mapAssets.ts`
- Modify: `src/maps/mapLibreStyle.ts`
- Modify: `src/maps/MapLibreRenderer.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `next.config.ts`
- Create: `tests/unit/maps/mapAssets.test.ts`
- Create: `tests/unit/maps/mapAssetBudget.test.ts`

**Steps:**
1. Add failing tests for a revisioned context URL, document preload, immutable context caching, and payload ceilings.
2. Centralize revisioned context/worker URLs.
3. Preload the context GeoJSON before Step 3 and configure long-lived immutable caching for revisioned URLs.
4. Enforce raw and Brotli size budgets that leave modest growth headroom.
5. Run focused tests and a production build header check.

## Task 5: Delayed loading, retry, and degraded map state

**Files:**
- Create: `src/hooks/useDelayedVisibility.ts`
- Create: `tests/unit/hooks/useDelayedVisibility.test.tsx`
- Modify: `src/maps/MapLibreRenderer.tsx`
- Modify: `src/app/explorer-polish.css`
- Modify: `tests/component/MapLibreRenderer.test.tsx`
- Modify: `tests/e2e/network-disabled.spec.ts`

**Steps:**
1. Add fake-timer tests proving loading UI stays hidden through 300 ms and appears afterward.
2. Add renderer tests for loaded, failed, retrying, and degraded states.
3. Implement a reserved, visually quiet status surface: `Loading Lagos planning context…`, then a clear retry/degraded message if the context source fails.
4. Remount only the map renderer on retry so package markers and the surrounding workflow remain available.
5. Verify keyboard access, live-region behavior, reduced motion, and network-disabled behavior.

## Task 6: Performance, UI/UX, and code-quality gates

**Files:**
- Create or modify: `tests/e2e/map-performance.spec.ts`
- Modify: `tests/e2e/ui-quality-hierarchy.spec.ts`
- Update: `docs/superpowers/plans/2026-08-12-map-overview-loading.md` only if review exposes a contract gap

**Steps:**
1. Add a local map-ready E2E budget and assert the right pane never presents as empty.
2. Run focused unit/component tests, full typecheck, targeted lint, and production build.
3. Run desktop, tablet, mobile, reduced-motion, and failed-context Playwright checks.
4. Have a dedicated UI/UX reviewer evaluate hierarchy, bloat, label collisions, control clarity, loading feedback, and mobile ergonomics.
5. Have an independent code-quality reviewer inspect the final diff; resolve all critical or important findings.

## Completion Criteria

- Step 3 initially shows every package zone/site.
- `Package overview` always restores deterministic bounds; selected-zone refocus is explicit.
- Controls and status UI remain compact and do not compete with recommendations.
- The context asset is fetched early, revisioned, cacheable, and protected by size/map-ready budgets.
- Delayed loading, retry, and degraded states are visible, accessible, and never leave an empty right pane.
- Focused tests, typecheck, lint, build, responsive E2E, UI/UX review, and code review pass.
