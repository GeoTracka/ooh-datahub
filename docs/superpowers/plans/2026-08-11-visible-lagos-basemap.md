# Visible Lagos Basemap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Step 3 right pane read immediately as a real Lagos map while preserving the app's offline runtime and planning-first visual hierarchy.

**Architecture:** Replace the synthetic-only context GeoJSON with a checked-in, compact OpenStreetMap-derived Lagos dataset containing land/water and major-road feature classes. Extend the existing MapLibre style with semantic cartographic layers and add a persistent, linked OpenStreetMap/ODbL attribution inside the map stage. The existing React marker and camera behavior stays unchanged.

**Tech Stack:** Next.js, React, TypeScript, MapLibre GL, Vitest, Playwright, local GeoJSON.

---

### Task 1: Specify the visible basemap contract

**Files:**
- Create: `tests/unit/maps/mapLibreStyle.test.ts`
- Modify: `tests/component/MapStage.test.tsx`

- [ ] **Step 1: Write failing style tests**

Assert that the MapLibre style contains `water-fill`, `major-road-casing`, `major-roads`, and `secondary-roads` layers, and that `/map/lagos-open-context.geojson` contains `water`, `road-major`, and `road-secondary` features rather than only synthetic planning geometry.

- [ ] **Step 2: Write a failing attribution test**

Render `MapStage` and require a visible `Map data © OpenStreetMap contributors` link whose destination is `https://www.openstreetmap.org/copyright`.

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `pnpm vitest run tests/unit/maps/mapLibreStyle.test.ts tests/component/MapStage.test.tsx`

Expected: FAIL because the cartographic layers, real feature classes, and attribution link do not yet exist.

### Task 2: Bundle recognizable Lagos geography

**Files:**
- Modify: `public/map/lagos-open-context.geojson`
- Modify: `src/maps/mapLibreStyle.ts`

- [ ] **Step 1: Download major-road and water geometry from OpenStreetMap**

Use an Overpass `out geom` query for the Lagos planning bounds, retain only motorway/trunk/primary/secondary roads and water/coastline geometry, convert ways to GeoJSON, and commit the derived dataset so the application performs no runtime tile requests.

- [ ] **Step 2: Add semantic MapLibre layers**

Render pale-blue water fills and lines below road casings; render primary roads stronger than secondary roads; keep planning corridors visually distinct with a dashed accent; retain existing zone points and selected markers.

- [ ] **Step 3: Run focused style tests and confirm GREEN**

Run: `pnpm vitest run tests/unit/maps/mapLibreStyle.test.ts`

Expected: PASS.

### Task 3: Add attribution and visual integration

**Files:**
- Modify: `src/features/MapStage.tsx`
- Modify: `src/app/explorer-polish.css`
- Test: `tests/component/MapStage.test.tsx`

- [ ] **Step 1: Add compliant map attribution**

Render a compact link reading `Map data © OpenStreetMap contributors` in the map's lower edge next to the existing planning-context disclaimer.

- [ ] **Step 2: Style attribution for legibility**

Use a translucent light surface, dark text, visible focus styling, and a stable bottom position that does not overlap the legend or package markers.

- [ ] **Step 3: Run component tests and confirm GREEN**

Run: `pnpm vitest run tests/component/MapStage.test.tsx`

Expected: PASS.

### Task 4: Verify visually, offline, and in production

**Files:**
- Modify if needed: `tests/e2e/ui-quality-hierarchy.spec.ts`
- Modify if needed: `tests/e2e/network-disabled.spec.ts`

- [ ] **Step 1: Run local quality gates**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`

Expected: all commands pass, with no new lint warnings.

- [ ] **Step 2: Capture Step 3 at desktop and mobile widths**

Confirm recognizable Lagos road/water context, clear package markers, no legend/attribution collisions, and no external network requests at 1440px and 375px.

- [ ] **Step 3: Commit and deploy**

Commit the focused change, build the release on `139.162.171.44`, keep MariaDB configuration unchanged, replace the app container only after its health check passes, and preserve the previous container as rollback.

- [ ] **Step 4: Verify the public URL**

Open `https://ooh.brainpad.me`, reach Step 3, confirm the map is visibly geographic and interactive, and confirm the deployed container remains healthy.
