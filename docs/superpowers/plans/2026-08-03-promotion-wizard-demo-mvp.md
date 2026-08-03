# Promotion Wizard Demo MVP Implementation Plan

> **Status: Superseded — do not execute.** The approved [Calibrated Reach and Live Enrichment Design](../specs/2026-08-03-calibrated-reach-enrichment-design.md) changes the measurement and runtime boundaries. This plan remains as historical context until it is replaced after design-spec review.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a presentation-ready, map-first promotion wizard that turns an FMCG, Real Estate or Bank/Fintech brief into a deterministic Lagos OOH recommendation, navigable audience evidence, reversible adjustments, live spreadsheet enrichment and a watermarked supplier-verification RFQ.

**Architecture:** Ship the first demo as one local-first Vite/React application. Pure TypeScript domain modules perform eligibility, scoring, package construction, audience estimation, adjustments and RFQ generation; browser adapters handle local fixtures, XLSX/CSV parsing, MapLibre rendering and downloads. The typed application contracts mirror the approved API operations so HTTP routes, PostGIS and real providers can replace the in-process adapters later without rewriting the UI or decision logic.

**Tech Stack:** React 19.2.8, TypeScript 7.0.2, Vite 8.2.0, MapLibre GL JS 6.1.0, Zod 4.4.3, ExcelJS 4.4.0, Papa Parse 5.5.4, Vitest 4.1.10, React Testing Library 16.3.2, Playwright 1.62.1, axe-core Playwright 4.12.1, CSS custom properties and local GeoJSON.

---

## Delivery decision

The demo slice deliberately has no backend, database, authentication, external AI, geocoding or remote map-tile dependency. All seeded and uploaded data stays in the browser session. The following approved operations still exist as typed methods in `plannerService.ts`: parse brief, create plan, recalculate draft, apply/reset, preview/confirm import and generate RFQ. A future HTTP adapter may expose those same request/response types at the §12 routes in the approved design.

Explicitly defer PostgreSQL/PostGIS, object storage, arbitrary geocoding, real audience/opinion-leadership providers, full Drive ETL, supplier sending/booking/payment, PDF/DOCX output, real inventory availability, cross-media adapters and generic audience uploads. Inventory uploaded outside synthetic-model coverage remains selectable only with `Audience estimate unavailable`; no reach is fabricated.

The critical path is:

```text
Scaffold → contracts/fixtures → scoring/package builder → audience estimator
         → planner session → map-first UI/drawer → adjustments
         → spreadsheet upload → RFQ → E2E demo lock
```

## File map

| Area | Files | Responsibility |
|---|---|---|
| Tooling | `package.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js` | Reproducible build, unit/component tests, E2E and lint |
| App state | `src/app/App.tsx`, `PlannerProvider.tsx`, `plannerReducer.ts`, `plannerSelectors.ts` | Six experience states, active/baseline/draft state, drawer/lens selection |
| Application seam | `src/application/contracts.ts`, `plannerService.ts` | In-process equivalents of approved API operations |
| Core model | `src/domain/model.ts`, `schemas.ts`, `ruleset.ts` | Canonical types, validation, versions, presets and fixed demo clock |
| Planning | `src/domain/eligibility.ts`, `scoring.ts`, `packageBuilder.ts` | Gates, five-pillar scoring, cohort/mode rules, deterministic package selection |
| Audience | `src/domain/audience/{types,fingerprint,evidence,estimate,marginals,presenter}.ts` | Exact-plan fingerprint, reach/influence formulas, evidence states, map diagnostics |
| Plan state | `src/domain/adjustments.ts`, `evidence.ts` | Immutable baseline, dirty draft, deltas, apply/undo/reset and evidence trail |
| Imports | `src/adapters/workbook/{readSpreadsheet,mapHeaders,validateImport}.ts` | Browser XLSX/CSV sheet discovery, mapping, preview and quarantine |
| Demo data | `src/demo/fixtures/*.ts`, `src/adapters/demoRepository.ts` | Five zones, 30 fictional faces, three briefs, synthetic audience/context/evidence and golden snapshots |
| Map UI | `src/features/map/{PlannerMap,MapErrorFallback,MapLegend}.tsx`, `mapStyle.ts`, `mapLayers.ts` | Local basemap, recommendations, temporary Reach/Influence symbols and fallback list |
| Drawer UI | `src/features/drawer/*.tsx` | Zone/site/method/audience/evidence states, breadcrumbs, focus return |
| Other UI | `src/features/{brief,recommendation,adjustments,upload,rfq,common}/*` | Compact brief, package strip, changes, upload preview, RFQ review/download |
| Styling | `src/styles/tokens.css`, `global.css` | Approved sparse visual system and responsive behavior |
| Tests | `tests/unit/*`, `tests/component/*`, `tests/e2e/*`, `tests/fixtures/*` | Formula, contract, interaction, privacy, claim and full-demo verification |

Use the approved mockup at `C:\Users\Son\.codex\visualizations\2026\07\31\019fb7fa-26cb-7172-ad9e-5e3af4c96caf\promotion-map-first-demo.html` as the visual reference. Preserve its compact top brief, dominant map, floating contextual drawer and single package strip; add the approved second-line audience signal without introducing KPI cards.

## Task 1: Scaffold the local-first React application and test harness

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/vite-env.d.ts`
- Create: `src/app/App.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `tests/setup.ts`
- Test: `tests/component/app-shell.test.tsx`

- [ ] **Step 1: Create the pinned package manifest**

```json
{
  "name": "ooh-promotion-wizard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "preview": "vite preview",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "npm run lint && npm test && npm run build && npm run test:e2e"
  },
  "dependencies": {
    "exceljs": "4.4.0",
    "lucide-react": "1.28.0",
    "maplibre-gl": "6.1.0",
    "papaparse": "5.5.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.12.1",
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.62.1",
    "@testing-library/dom": "10.4.1",
    "@testing-library/jest-dom": "7.0.0",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/geojson": "7946.0.16",
    "@types/node": "26.1.2",
    "@types/papaparse": "5.5.2",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "@vitejs/plugin-react": "6.0.5",
    "eslint": "10.8.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.3",
    "globals": "17.9.0",
    "jsdom": "30.0.1",
    "typescript": "7.0.2",
    "typescript-eslint": "8.65.0",
    "vite": "8.2.0",
    "vite-tsconfig-paths": "6.1.1",
    "vitest": "4.1.10"
  }
}
```

Run: `npm install`

Expected: `package-lock.json` is created and `npm ls --depth=0` exits 0.

Run: `npx playwright install chromium`

Expected: Playwright reports that Chromium is installed; this is the only browser binary required by the plan.

- [ ] **Step 2: Add TypeScript, Vite, Vitest, Playwright and ESLint configuration**

Use `@/* → src/*`, `jsdom` for unit/component tests, Chromium-only E2E, and a Vite web server at `http://127.0.0.1:4173`. Configure Playwright to run `npm run build && npm run preview -- --host 127.0.0.1`.

```ts
// vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true
  }
});
```

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({ plugins: [react(), tsconfigPaths()] });
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

```js
// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "playwright-report", "test-results"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  }
);
```

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false
  }
});
```

Use these remaining scaffold files exactly:

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": [
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "eslint.config.js"
  ]
}
```

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f6f4ee" />
    <title>Promotion Wizard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```ts
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
```

```gitignore
# .gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
*.local
```

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/styles/tokens.css";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 3: Write the failing shell test**

```tsx
// tests/component/app-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/app/App";

describe("App shell", () => {
  it("shows the promotion wizard heading and compact brief", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /booking-ready OOH request/i })).toBeTruthy();
    expect(screen.getByLabelText("Campaign brief")).toBeTruthy();
  });
});
```

Run: `npm test -- tests/component/app-shell.test.tsx`

Expected: FAIL because `App` does not yet exist.

- [ ] **Step 4: Add the minimal accessible app shell and visual tokens**

```tsx
// src/app/App.tsx
export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Promotion wizard</p>
        <h1>From product brief to a booking-ready OOH request</h1>
      </header>
      <section aria-label="Campaign brief" className="brief-strip">
        <label>Sector <select defaultValue="bank_fintech"><option value="fmcg">FMCG</option><option value="real_estate">Real Estate</option><option value="bank_fintech">Bank/Fintech</option></select></label>
        <label>Product <input defaultValue="NovaPay Flex Account" /></label>
        <label>Priority audience <input defaultValue="Young professionals, students and digital merchants" /></label>
        <button type="button">Create recommendation</button>
      </section>
      <section className="map-stage" aria-label="Recommendation map"><p>Map ready</p></section>
    </main>
  );
}
```

Use the approved mockup's warm neutral canvas, orange action and sparse bordered surfaces:

```css
/* src/styles/tokens.css */
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --background: #f6f4ee;
  --surface: #fffefa;
  --surface-soft: #efeee8;
  --foreground: #17201d;
  --muted: #67716c;
  --border: #d8ddd8;
  --primary: #ed5b2a;
  --primary-strong: #cc4319;
  --green: #24765a;
  --amber: #a66a10;
  --red: #ad3e3e;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --shadow-float: 0 16px 42px rgb(25 35 31 / 14%);
}
```

```css
/* src/styles/global.css */
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; margin: 0; }
body { background: var(--background); color: var(--foreground); }
button, input, select { font: inherit; }
button { cursor: pointer; }
.app-shell { min-height: 100vh; padding: 20px; display: grid; grid-template-rows: auto auto minmax(480px, 1fr); gap: 12px; }
.app-header h1 { max-width: 760px; margin: 4px 0 0; font-size: clamp(1.55rem, 2.5vw, 2.5rem); line-height: 1.05; }
.eyebrow { margin: 0; color: var(--primary-strong); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.brief-strip { display: grid; grid-template-columns: .8fr 1.25fr 2fr auto; gap: 10px; align-items: end; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.brief-strip label { display: grid; gap: 5px; color: var(--muted); font-size: .75rem; font-weight: 700; }
.brief-strip input, .brief-strip select { min-width: 0; padding: 10px; color: var(--foreground); background: white; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.brief-strip button { min-height: 40px; padding: 0 16px; color: white; background: var(--primary); border: 0; border-radius: var(--radius-sm); font-weight: 800; }
.map-stage { min-height: 480px; overflow: hidden; background: var(--surface-soft); border: 1px solid var(--border); border-radius: var(--radius-lg); }
@media (max-width: 760px) {
  .app-shell { padding: 10px; grid-template-rows: auto auto minmax(520px, 1fr); }
  .brief-strip { grid-template-columns: 1fr; }
}
```

Do not add a dashboard grid.

- [ ] **Step 5: Verify the scaffold**

Run: `npm run lint && npm test && npm run build`

Expected: all commands exit 0; the component test reports 1 passed test.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json index.html tsconfig*.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js src tests/setup.ts
git commit -m "chore: scaffold promotion wizard web app"
```

## Task 2: Define canonical contracts and deterministic demo fixtures

**Files:**
- Create: `src/domain/model.ts`
- Create: `src/domain/schemas.ts`
- Create: `src/domain/ruleset.ts`
- Create: `src/demo/fixtures/briefs.ts`
- Create: `src/demo/fixtures/zones.ts`
- Create: `src/demo/fixtures/inventory.ts`
- Create: `src/demo/fixtures/context.ts`
- Create: `src/demo/fixtures/evidence.ts`
- Create: `src/adapters/demoRepository.ts`
- Test: `tests/unit/demoRepository.test.ts`

- [ ] **Step 1: Write failing fixture-contract tests**

```ts
// tests/unit/demoRepository.test.ts
import { describe, expect, it } from "vitest";
import { loadDemoRepository } from "@/adapters/demoRepository";

describe("demo repository", () => {
  it("loads the complete deterministic demo universe", () => {
    const data = loadDemoRepository();
    expect(data.zones).toHaveLength(5);
    expect(data.faces).toHaveLength(30);
    expect(new Set(data.faces.map(face => face.ownerId)).size).toBe(3);
    expect(data.briefs.map(brief => brief.sector).sort()).toEqual(["bank_fintech", "fmcg", "real_estate"]);
    expect(data.faces.every(face => face.provenance === "demo" && face.rateAsOf === "2026-08-01")).toBe(true);
  });

  it("keeps movement and historical rows contextual", () => {
    const data = loadDemoRepository();
    expect(data.context.every(row => row.decisionUse === "context_only")).toBe(true);
    expect(data.context.some(row => row.metric === "passenger_movements")).toBe(true);
  });
});
```

Run: `npm test -- tests/unit/demoRepository.test.ts`

Expected: FAIL because repository/contracts do not exist.

- [ ] **Step 2: Create the core domain types and versioned ruleset**

```ts
// src/domain/model.ts
export type Sector = "fmcg" | "real_estate" | "bank_fintech";
export type Objective = "awareness_launch" | "consideration_trust" | "action_leads";
export type DMode = "D_Audience" | "D_LTS" | "D_OTS" | "D_ContextProxy";
export type EMode = "E_CPM" | "E_RatePosition";
export type EvidenceGrade = "A" | "B" | "C" | "D" | "unranked";

export interface CampaignBrief {
  id: string;
  sector: Sector;
  product: string;
  audience: string;
  objective: Objective;
  geographyId: "lagos_demo";
  budgetNgn: number;
  startDate: string;
  endDate: string;
  influenceProfileId: string | null;
  influenceProfileConfirmed: boolean;
}

export interface Zone {
  id: string;
  name: string;
  rankLabel: string;
  polygon: GeoJSON.Polygon;
  contextTags: readonly string[];
}

export interface FacePillars { A: number; D: number; C: number; P: number; E: number; }

export interface InventoryFace {
  id: string;
  structureId: string;
  ownerId: string;
  zoneId: string;
  address: string;
  longitude: number;
  latitude: number;
  format: "static_billboard" | "dooh_screen" | "street_panel";
  rateNgn: number;
  currency: "NGN";
  grossNet: "gross" | "net" | "unknown";
  rateBasis: "four_weeks";
  rateAsOf: string;
  available: boolean;
  permitState: "verified" | "pending" | "unknown" | "rejected" | "conditional_demo";
  brandSafetyState: "pass" | "fail" | "unknown";
  provenance: "demo" | "upload";
  sourceDatasetId: string;
  basisImpressions: number;
  dMode: DMode;
  eMode: EMode;
  pillars: FacePillars;
  evidenceConfidence: number;
  evidenceIds: readonly string[];
}
```

Use the same schema primitives for fixtures and later workbook rows so validation cannot drift:

```ts
// src/domain/schemas.ts
import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PillarsSchema = z.object({
  A: z.number().min(0).max(100),
  D: z.number().min(0).max(100),
  C: z.number().min(0).max(100),
  P: z.number().min(0).max(100),
  E: z.number().min(0).max(100)
}).strict();

export const InventoryFaceSchema = z.object({
  id: z.string().min(1),
  structureId: z.string().min(1),
  ownerId: z.string().min(1),
  zoneId: z.string().min(1),
  address: z.string().min(1),
  longitude: z.number().gte(-180).lte(180),
  latitude: z.number().gte(-90).lte(90),
  format: z.enum(["static_billboard", "dooh_screen", "street_panel"]),
  rateNgn: z.number().positive(),
  currency: z.literal("NGN"),
  grossNet: z.enum(["gross", "net", "unknown"]),
  rateBasis: z.literal("four_weeks"),
  rateAsOf: IsoDate,
  available: z.boolean(),
  permitState: z.enum(["verified", "pending", "unknown", "rejected", "conditional_demo"]),
  brandSafetyState: z.enum(["pass", "fail", "unknown"]),
  provenance: z.enum(["demo", "upload"]),
  sourceDatasetId: z.string().min(1),
  basisImpressions: z.number().positive(),
  dMode: z.enum(["D_Audience", "D_LTS", "D_OTS", "D_ContextProxy"]),
  eMode: z.enum(["E_CPM", "E_RatePosition"]),
  pillars: PillarsSchema,
  evidenceConfidence: z.number().min(0).max(100),
  evidenceIds: z.array(z.string().min(1)).min(1)
}).strict();

export const CampaignBriefSchema = z.object({
  id: z.string().min(1),
  sector: z.enum(["fmcg", "real_estate", "bank_fintech"]),
  product: z.string().min(1),
  audience: z.string().min(1),
  objective: z.enum(["awareness_launch", "consideration_trust", "action_leads"]),
  geographyId: z.literal("lagos_demo"),
  budgetNgn: z.number().positive(),
  startDate: IsoDate,
  endDate: IsoDate,
  influenceProfileId: z.string().min(1).nullable(),
  influenceProfileConfirmed: z.boolean()
}).strict().refine(value => value.startDate <= value.endDate, {
  message: "startDate must be on or before endDate",
  path: ["endDate"]
});
```

```ts
// src/domain/ruleset.ts
import type { Objective, Sector } from "@/domain/model";

export const METHOD_VERSION = "ooh-demo-v1" as const;
export const FIXED_DEMO_NOW = "2026-08-03T12:00:00+01:00" as const;
export type PillarWeights = Readonly<Record<"A" | "D" | "C" | "P" | "E", number>>;

export const SECTOR_PRESETS: Readonly<Record<Sector, PillarWeights>> = {
  fmcg: { A: .20, D: .35, C: .20, P: .15, E: .10 },
  real_estate: { A: .30, D: .15, C: .30, P: .15, E: .10 },
  bank_fintech: { A: .30, D: .25, C: .20, P: .15, E: .10 }
};

export const OBJECTIVE_OVERRIDES: Readonly<Record<Objective, PillarWeights>> = {
  awareness_launch: { A: .20, D: .35, C: .15, P: .20, E: .10 },
  consideration_trust: { A: .30, D: .20, C: .25, P: .15, E: .10 },
  action_leads: { A: .25, D: .15, C: .35, P: .10, E: .15 }
};

export const DEMO_LIMITS = {
  maximumUploadBytes: 5_000_000,
  minimumPackageFaces: 3,
  maximumPackageFaces: 8,
  maximumPackageZones: 3,
  serviceRadiusMetres: 2_000
} as const;
```

- [ ] **Step 3: Build five zone polygons and 30 reproducible fictional faces**

Use these reviewed demo centers and derive the rectangular fixture polygons with half-width `0.018` and half-height `0.012`; the UI labels them `Illustrative planning zone`, not official boundaries:

```ts
// src/demo/fixtures/zones.ts
export const zoneSeeds = [
  { id: "yaba_akoka", name: "Yaba/Akoka", center: [3.3900, 6.5150] as const },
  { id: "ikeja", name: "Ikeja", center: [3.3500, 6.6010] as const },
  { id: "vi_ikoyi", name: "VI/Ikoyi", center: [3.4300, 6.4550] as const },
  { id: "lekki", name: "Lekki", center: [3.5000, 6.4470] as const },
  { id: "surulere", name: "Surulere", center: [3.3500, 6.5000] as const }
] as const;

function rectangle([longitude, latitude]: readonly [number, number]): GeoJSON.Polygon {
  const x = .018;
  const y = .012;
  return { type: "Polygon", coordinates: [[
    [longitude - x, latitude - y], [longitude + x, latitude - y],
    [longitude + x, latitude + y], [longitude - x, latitude + y],
    [longitude - x, latitude - y]
  ]] };
}

export const demoZones = zoneSeeds.map((seed, index) => ({
  id: seed.id,
  name: seed.name,
  rankLabel: String(index + 1),
  polygon: rectangle(seed.center),
  contextTags: ["Illustrative planning zone"]
}));
```

Generate six faces per zone from the fixed arrays below; do not use `Math.random()` or `Date.now()`. Cycle three fictional owners and include source/evidence IDs on every face. Add the three approved briefs and bounded historical/airport context records with `decisionUse: "context_only"`.

```ts
// src/demo/fixtures/inventory.ts
import type { FacePillars, InventoryFace } from "@/domain/model";
import { zoneSeeds } from "@/demo/fixtures/zones";

const OWNER_IDS = ["owner_atlas", "owner_civic", "owner_northstar"] as const;
const FORMATS = ["static_billboard", "dooh_screen", "street_panel"] as const;
const ZONE_PILLAR_BASES: readonly FacePillars[] = [
  { A: 84, D: 90, C: 70, P: 78, E: 75 },
  { A: 82, D: 84, C: 80, P: 82, E: 74 },
  { A: 92, D: 65, C: 94, P: 75, E: 60 },
  { A: 88, D: 60, C: 96, P: 78, E: 62 },
  { A: 65, D: 96, C: 65, P: 80, E: 85 }
];

function buildFixturePillars(zoneIndex: number, faceIndex: number): FacePillars {
  const base = ZONE_PILLAR_BASES[zoneIndex];
  const penalty = faceIndex * 1.5;
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, value - penalty])) as unknown as FacePillars;
}

export const demoFaces: InventoryFace[] = zoneSeeds.flatMap((zone, zoneIndex) =>
  Array.from({ length: 6 }, (_, faceIndex) => ({
    id: `demo-${zone.id}-${faceIndex + 1}`,
    structureId: `structure-${zone.id}-${Math.floor(faceIndex / 2) + 1}`,
    ownerId: OWNER_IDS[(zoneIndex + faceIndex) % OWNER_IDS.length],
    zoneId: zone.id,
    address: `${zone.name} demo corridor ${faceIndex + 1}`,
    longitude: zone.center[0] + (faceIndex - 2.5) * 0.003,
    latitude: zone.center[1] + ((faceIndex % 3) - 1) * 0.002,
    format: FORMATS[faceIndex % FORMATS.length],
    rateNgn: 2_800_000 + zoneIndex * 650_000 + faceIndex * 275_000,
    currency: "NGN",
    grossNet: "gross",
    rateBasis: "four_weeks",
    rateAsOf: "2026-08-01",
    available: true,
    permitState: "conditional_demo",
    brandSafetyState: "unknown",
    provenance: "demo",
    sourceDatasetId: "synthetic-inventory-v1",
    basisImpressions: 180_000 + zoneIndex * 25_000 + faceIndex * 10_000,
    dMode: "D_Audience",
    eMode: "E_CPM",
    pillars: buildFixturePillars(zoneIndex, faceIndex),
    evidenceConfidence: 48 + ((zoneIndex + faceIndex) % 7),
    evidenceIds: [`evidence-${zone.id}-${faceIndex + 1}`]
  }))
);
```

```ts
// src/demo/fixtures/briefs.ts
import type { CampaignBrief } from "@/domain/model";

export const demoBriefs: CampaignBrief[] = [
  { id: "brief-fmcg", sector: "fmcg", product: "ZestUp Hydration",
    audience: "Students, households and convenience shoppers", objective: "awareness_launch",
    geographyId: "lagos_demo", budgetNgn: 12_000_000, startDate: "2026-09-01", endDate: "2026-09-28",
    influenceProfileId: "influence-fmcg-v1", influenceProfileConfirmed: true },
  { id: "brief-real-estate", sector: "real_estate", product: "Harbourview Residences",
    audience: "Professionals, investors and diaspora property buyers", objective: "consideration_trust",
    geographyId: "lagos_demo", budgetNgn: 13_000_000, startDate: "2026-09-01", endDate: "2026-09-28",
    influenceProfileId: "influence-real-estate-v1", influenceProfileConfirmed: true },
  { id: "brief-bank", sector: "bank_fintech", product: "NovaPay Flex Account",
    audience: "Young professionals, students and digital merchants", objective: "consideration_trust",
    geographyId: "lagos_demo", budgetNgn: 12_000_000, startDate: "2026-09-01", endDate: "2026-09-28",
    influenceProfileId: "influence-bank-v1", influenceProfileConfirmed: true }
];
```

```ts
// src/demo/fixtures/context.ts
export const demoContext = [
  { id: "context-airport-2025-03", metric: "passenger_movements", value: 812_440,
    unit: "passenger movements", period: "2025-03", sourceDatasetId: "faan-bounded-demo-extract",
    decisionUse: "context_only" as const },
  { id: "context-placement-yaba-2025q1", metric: "historical_placement_months", value: 18,
    unit: "placement-month rows", period: "2025-Q1", sourceDatasetId: "hub-bounded-demo-extract",
    decisionUse: "context_only" as const }
];
```

```ts
// src/demo/fixtures/evidence.ts
import { demoFaces } from "@/demo/fixtures/inventory";

export const demoEvidence = demoFaces.map(face => ({
  id: face.evidenceIds[0],
  sourceDatasetId: face.sourceDatasetId,
  effectiveDate: face.rateAsOf,
  provenance: "synthetic_demo" as const,
  claimLimit: "Illustrative rate, availability and planning inputs; supplier verification required"
}));
```

- [ ] **Step 4: Validate fixtures at the adapter boundary**

Parse once and deep-freeze the result at the adapter boundary:

```ts
// src/adapters/demoRepository.ts
import { z } from "zod";
import { CampaignBriefSchema, InventoryFaceSchema } from "@/domain/schemas";
import { demoBriefs } from "@/demo/fixtures/briefs";
import { demoContext } from "@/demo/fixtures/context";
import { demoEvidence } from "@/demo/fixtures/evidence";
import { demoFaces } from "@/demo/fixtures/inventory";
import { demoZones } from "@/demo/fixtures/zones";

const DemoBundleSchema = z.object({
  briefs: z.array(CampaignBriefSchema).length(3),
  zones: z.array(z.object({ id: z.string(), name: z.string(), rankLabel: z.string(),
    polygon: z.custom<GeoJSON.Polygon>(), contextTags: z.array(z.string()) })).length(5),
  faces: z.array(InventoryFaceSchema).length(30),
  context: z.array(z.object({ id: z.string(), metric: z.string(), value: z.number(), unit: z.string(),
    period: z.string(), sourceDatasetId: z.string(), decisionUse: z.literal("context_only") })),
  evidence: z.array(z.object({ id: z.string(), sourceDatasetId: z.string(), effectiveDate: z.string(),
    provenance: z.literal("synthetic_demo"), claimLimit: z.string() }))
});

export class DemoFixtureError extends Error {}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(item => deepFreeze(item));
  }
  return value;
}

let memo: Readonly<z.infer<typeof DemoBundleSchema>> | undefined;
export function loadDemoRepository() {
  if (memo) return memo;
  const parsed = DemoBundleSchema.safeParse({
    briefs: demoBriefs, zones: demoZones, faces: demoFaces,
    context: demoContext, evidence: demoEvidence
  });
  if (!parsed.success) throw new DemoFixtureError(z.prettifyError(parsed.error));
  memo = deepFreeze(parsed.data);
  return memo;
}
```

The fixture modules contain only fictional supplier IDs and explicit demo/synthetic sources.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/unit/demoRepository.test.ts && npm run build`

Expected: fixture tests pass; build exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/domain src/demo src/adapters/demoRepository.ts tests/unit/demoRepository.test.ts
git commit -m "feat: add validated promotion demo fixtures"
```

## Task 3: Implement deterministic scoring and package construction

**Files:**
- Create: `src/domain/eligibility.ts`
- Create: `src/domain/scoring.ts`
- Create: `src/domain/packageBuilder.ts`
- Test: `tests/unit/scoring.test.ts`
- Test: `tests/unit/packageBuilder.test.ts`

- [ ] **Step 1: Write failing five-pillar and deterministic-order tests**

```ts
// tests/unit/scoring.test.ts
import { describe, expect, it } from "vitest";
import { computePlanningFit } from "@/domain/scoring";

describe("Planning Fit", () => {
  it("uses all five pillars once", () => {
    const result = computePlanningFit(
      { A: 80, D: 70, C: 60, P: 50, E: 40 },
      { A: 0.30, D: 0.25, C: 0.20, P: 0.15, E: 0.10 }
    );
    expect(result).toEqual({ status: "scored", score: 66.5 });
  });

  it("fails closed when a pillar is missing", () => {
    expect(computePlanningFit(
      { A: 80, D: null, C: 60, P: 50, E: 40 },
      { A: 0.30, D: 0.25, C: 0.20, P: 0.15, E: 0.10 }
    )).toEqual({ status: "insufficient_evidence", missing: ["D"] });
  });
});
```

```ts
// tests/unit/packageBuilder.test.ts
const requireReady = <T extends { status: string }>(result: T) => {
  if (result.status !== "ready") throw new Error(`Expected ready, received ${result.status}`);
  return result as Extract<T, { status: "ready" }>;
};

it("returns the same winner regardless of input order", () => {
  const forward = requireReady(buildRecommendation(bankBrief, demoFaces, demoZones));
  const reverse = requireReady(buildRecommendation(bankBrief, [...demoFaces].reverse(), [...demoZones].reverse()));
  expect(reverse.package.faceIds).toEqual(forward.package.faceIds);
  expect(reverse.package.zoneIds).toEqual(forward.package.zoneIds);
});

it("shows the truthful lower count when only two zones survive", () => {
  const faces = demoFaces.filter(face => ["yaba_akoka", "ikeja"].includes(face.zoneId));
  expect(requireReady(buildRecommendation(bankBrief, faces, demoZones)).package.zoneIds).toHaveLength(2);
});

const sectorWinners: readonly [CampaignBrief, readonly string[], number][] = [
  [bankBrief, ["demo-ikeja-1", "demo-vi_ikoyi-1", "demo-yaba_akoka-1"], 82.1],
  [fmcgBrief, ["demo-ikeja-1", "demo-surulere-1", "demo-yaba_akoka-1"], 82.4],
  [realEstateBrief, ["demo-ikeja-1", "demo-lekki-1", "demo-vi_ikoyi-1"], 83.5]
];
it.each(sectorWinners)("locks the %s sector winner", (brief, faceIds, planningFit) => {
  const result = requireReady(buildRecommendation(brief, demoFaces, demoZones));
  expect(result.package.faceIds).toEqual(faceIds);
  expect(result.package.planningFit).toBe(planningFit);
});
```

Run: `npm test -- tests/unit/scoring.test.ts tests/unit/packageBuilder.test.ts`

Expected: FAIL because planning functions do not exist.

- [ ] **Step 2: Implement eligibility and Planning Fit**

`eligibleFaces()` rejects unavailable, out-of-geography, non-positive-price, missing identity/coordinate/format/rate-basis and known permit/brand-safety failures. Unknown demo permits remain conditional. Freeze one `D_mode`, one `E_mode`, the eligible UUID list and method version before ranking; mixed D/E candidates produce `insufficient_evidence` rather than comparable scores.

```ts
// src/domain/eligibility.ts
import type { InventoryFace } from "@/domain/model";
import { METHOD_VERSION } from "@/domain/ruleset";

export interface EligibilityResult {
  eligible: readonly InventoryFace[];
  excluded: readonly { faceId: string; reasons: readonly string[] }[];
  conditions: readonly { faceId: string; condition: string }[];
}

export function eligibleFaces(faces: readonly InventoryFace[], allowedZoneIds: ReadonlySet<string>): EligibilityResult {
  const eligible: InventoryFace[] = [];
  const excluded: { faceId: string; reasons: string[] }[] = [];
  const conditions: { faceId: string; condition: string }[] = [];
  for (const face of faces) {
    const reasons = [
      !face.available && "unavailable",
      !allowedZoneIds.has(face.zoneId) && "outside_geography",
      (!Number.isFinite(face.rateNgn) || face.rateNgn <= 0) && "invalid_rate",
      (!face.id || !face.ownerId || !face.format || !face.rateBasis) && "missing_identity_or_format",
      (!Number.isFinite(face.longitude) || !Number.isFinite(face.latitude)) && "invalid_coordinates",
      face.permitState === "rejected" && "permit_rejected",
      face.brandSafetyState === "fail" && "brand_safety_failed",
      face.evidenceConfidence < 40 && "evidence_below_d"
    ].filter((reason): reason is string => Boolean(reason));
    if (reasons.length) excluded.push({ faceId: face.id, reasons });
    else {
      eligible.push(face);
      if (["unknown", "pending", "conditional_demo"].includes(face.permitState)) {
        conditions.push({ faceId: face.id, condition: "Site permit confirmation requested" });
      }
    }
  }
  return { eligible, excluded, conditions };
}

export function freezeComparableCohort(faces: readonly InventoryFace[]) {
  const dModes = new Set(faces.map(face => face.dMode));
  const eModes = new Set(faces.map(face => face.eMode));
  if (dModes.size !== 1 || eModes.size !== 1) return { status: "insufficient_evidence" as const };
  const faceIds = faces.map(face => face.id).sort();
  return { status: "frozen" as const, faceIds,
    dMode: faces[0].dMode, eMode: faces[0].eMode, methodVersion: METHOD_VERSION,
    normalizationCohortId: `cohort.${METHOD_VERSION}.${faceIds.join(".")}` };
}
```

```ts
// src/domain/scoring.ts
const PILLARS = ["A", "D", "C", "P", "E"] as const;
type Pillar = typeof PILLARS[number];

export function computePlanningFit(
  scores: Record<Pillar, number | null>,
  weights: Record<Pillar, number>
) {
  const missing = PILLARS.filter(pillar => scores[pillar] === null);
  if (missing.length) return { status: "insufficient_evidence" as const, missing };
  const weightTotal = PILLARS.reduce((sum, pillar) => sum + weights[pillar], 0);
  if (Math.abs(weightTotal - 1) > 1e-9) throw new Error("Planning Fit weights must sum to 1");
  const score = PILLARS.reduce((sum, pillar) => sum + scores[pillar]! * weights[pillar], 0);
  return { status: "scored" as const, score: Math.round(score * 10) / 10 };
}
```

- [ ] **Step 3: Enumerate deterministic packages**

For each zone retain the top four eligible faces ordered by `FaceFit desc → face evidence Q desc → rate asc → binary face ID asc`. Enumerate every non-empty subset across exactly `min(3, eligibleZoneCount)` zones, retain packages with 3–8 faces, at least one face per chosen zone and total rate within budget, then recompute package A/D/C/P/E. Sort valid packages by `Planning Fit desc → Evidence Confidence desc → total cost asc → canonical sorted face tuple asc`.

```ts
// src/domain/packageBuilder.ts
import type { CampaignBrief, DMode, EMode, FacePillars, InventoryFace, Zone } from "@/domain/model";
import { eligibleFaces, freezeComparableCohort, type EligibilityResult } from "@/domain/eligibility";
import { SECTOR_PRESETS, type PillarWeights } from "@/domain/ruleset";
import { computePlanningFit } from "@/domain/scoring";

export interface CandidatePackage {
  faceIds: readonly string[];
  zoneIds: readonly string[];
  totalCostNgn: number;
  pillars: FacePillars;
  planningFit: number;
  evidenceConfidence: number;
  canonicalFaceTuple: string;
}

export function nonEmptySubsets<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask += 1) {
    result.push(items.filter((_, index) => (mask & (1 << index)) !== 0));
  }
  return result;
}

export function canonicalFaceTuple(faceIds: readonly string[]): string {
  return [...faceIds].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).join("|");
}

export function comparePackages(a: CandidatePackage, b: CandidatePackage): number {
  return b.planningFit - a.planningFit
    || b.evidenceConfidence - a.evidenceConfidence
    || a.totalCostNgn - b.totalCostNgn
    || (a.canonicalFaceTuple < b.canonicalFaceTuple ? -1 : a.canonicalFaceTuple > b.canonicalFaceTuple ? 1 : 0);
}

function combinations<T>(items: readonly T[], size: number, start = 0, prefix: T[] = []): T[][] {
  if (prefix.length === size) return [prefix];
  const result: T[][] = [];
  for (let index = start; index <= items.length - (size - prefix.length); index += 1) {
    result.push(...combinations(items, size, index + 1, [...prefix, items[index]]));
  }
  return result;
}

function product<T>(sets: readonly (readonly T[])[]): T[][] {
  return sets.reduce<T[][]>((rows, set) => rows.flatMap(row => set.map(item => [...row, item])), [[]]);
}

function aggregatePackagePillars(faces: readonly InventoryFace[]): FacePillars {
  const zoneIds = [...new Set(faces.map(face => face.zoneId))].sort();
  const zoneMean = (pillar: "A" | "C" | "P") => zoneIds.reduce((sum, zoneId) => {
    const members = faces.filter(face => face.zoneId === zoneId);
    return sum + members.reduce((inner, face) => inner + face.pillars[pillar], 0) / members.length;
  }, 0) / zoneIds.length;
  const basis = faces.reduce((sum, face) => sum + face.basisImpressions, 0);
  const cost = faces.reduce((sum, face) => sum + face.rateNgn, 0);
  const basisWeighted = (pillar: "A" | "D" | "C") => faces.reduce(
    (sum, face) => sum + face.pillars[pillar] * face.basisImpressions / basis, 0);
  return {
    A: basisWeighted("A"),
    C: basisWeighted("C"),
    P: Math.min(100, zoneMean("P") + 5 * (zoneIds.length - 1)),
    D: basisWeighted("D"),
    E: faces.reduce((sum, face) => sum + face.pillars.E * face.rateNgn / cost, 0)
  };
}

export function enumeratePackages(input: {
  faces: readonly InventoryFace[];
  budgetNgn: number;
  weights: PillarWeights;
}): CandidatePackage[] {
  const byZone = new Map<string, InventoryFace[]>();
  for (const face of input.faces) byZone.set(face.zoneId, [...(byZone.get(face.zoneId) ?? []), face]);
  const faceFit = (face: InventoryFace) => {
    const result = computePlanningFit(face.pillars, input.weights);
    return result.status === "scored" ? result.score : -Infinity;
  };
  for (const [zoneId, members] of byZone) byZone.set(zoneId, members
    .sort((a, b) => faceFit(b) - faceFit(a) || b.evidenceConfidence - a.evidenceConfidence
      || a.rateNgn - b.rateNgn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 4));
  const zoneIds = [...byZone.keys()].sort();
  const candidates: CandidatePackage[] = [];
  const requiredZoneCount = Math.min(3, zoneIds.length);
  for (const chosenZones of combinations(zoneIds, requiredZoneCount)) {
      const choices = chosenZones.map(zoneId => nonEmptySubsets(byZone.get(zoneId)!));
      for (const grouped of product(choices)) {
        const faces = grouped.flat();
        const totalCostNgn = faces.reduce((sum, face) => sum + face.rateNgn, 0);
        if (faces.length < 3 || faces.length > 8 || totalCostNgn > input.budgetNgn) continue;
        const pillars = aggregatePackagePillars(faces);
        const scored = computePlanningFit(pillars, input.weights);
        if (scored.status !== "scored") continue;
        const faceIds = faces.map(face => face.id).sort();
        candidates.push({ faceIds, zoneIds: chosenZones, totalCostNgn, pillars,
          planningFit: scored.score, evidenceConfidence: Math.min(...faces.map(face => face.evidenceConfidence)),
          canonicalFaceTuple: canonicalFaceTuple(faceIds) });
      }
  }
  return candidates.sort(comparePackages);
}

export type RecommendationBuildResult =
  | { status: "ready"; package: CandidatePackage; alternatives: readonly CandidatePackage[];
      alternativeFaceIds: readonly string[]; alternativeZoneIds: readonly string[];
      cohort: ReturnType<typeof freezeComparableCohort>; eligibility: EligibilityResult;
      trace: PlanningTrace }
  | { status: "insufficient_evidence"; eligibility: EligibilityResult }
  | { status: "no_valid_package"; eligibility: EligibilityResult };

export interface PlanningTrace {
  methodVersion: string;
  preliminaryExcluded: EligibilityResult["excluded"];
  frozenFaceIds: readonly string[];
  dMode: DMode;
  eMode: EMode;
  packageSort: "Planning Fit desc → Evidence Confidence desc → cost asc → canonical face tuple asc";
}

export function buildRecommendation(
  brief: CampaignBrief,
  faces: readonly InventoryFace[],
  zones: readonly Zone[]
): RecommendationBuildResult {
  const eligibility = eligibleFaces(faces, new Set(zones.map(zone => zone.id)));
  const cohort = freezeComparableCohort(eligibility.eligible);
  if (cohort.status !== "frozen") return { status: "insufficient_evidence", eligibility };
  const candidates = enumeratePackages({
    faces: eligibility.eligible,
    budgetNgn: brief.budgetNgn,
    weights: SECTOR_PRESETS[brief.sector]
  });
  if (!candidates.length) return { status: "no_valid_package", eligibility };
  const winner = candidates[0];
  const selected = new Set(winner.faceIds);
  const weights = SECTOR_PRESETS[brief.sector];
  const rankAlternativeFace = (a: InventoryFace, b: InventoryFace) => {
    const aFit = computePlanningFit(a.pillars, weights);
    const bFit = computePlanningFit(b.pillars, weights);
    return (bFit.status === "scored" ? bFit.score : -Infinity) - (aFit.status === "scored" ? aFit.score : -Infinity)
      || b.evidenceConfidence - a.evidenceConfidence || a.rateNgn - b.rateNgn
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  };
  const alternativeFaces = eligibility.eligible.filter(face => !selected.has(face.id)).sort(rankAlternativeFace);
  const winnerZones = new Set(winner.zoneIds);
  const alternativeZoneIds = [...new Set(alternativeFaces.filter(face => !winnerZones.has(face.zoneId))
    .map(face => face.zoneId))].sort((a, b) => {
      const bestA = alternativeFaces.find(face => face.zoneId === a)!;
      const bestB = alternativeFaces.find(face => face.zoneId === b)!;
      return rankAlternativeFace(bestA, bestB) || (a < b ? -1 : a > b ? 1 : 0);
    });
  return { status: "ready", package: winner, alternatives: candidates.slice(1, 3),
    alternativeFaceIds: alternativeFaces.map(face => face.id), alternativeZoneIds, cohort, eligibility,
    trace: { methodVersion: cohort.methodVersion, preliminaryExcluded: eligibility.excluded,
      frozenFaceIds: cohort.faceIds, dMode: cohort.dMode, eMode: cohort.eMode,
      packageSort: "Planning Fit desc → Evidence Confidence desc → cost asc → canonical face tuple asc" } };
}
```

The returned `trace` persists preliminary filters, frozen member IDs, D/E modes and stable sorting. Use no locale-dependent comparison and no randomness.

- [ ] **Step 4: Add explanation facts without AI claims**

Return one recommendation sentence, three source-backed reasons, main trade-off, preset/version, affected pillar facts, selected/alternative zone ranks and evidence IDs. Use this template-only writer; no generated language enters the claim surface:

```ts
export function buildExplanation(input: {
  selectedZoneNames: readonly string[];
  topPillars: readonly { label: string; value: number; evidenceIds: readonly string[] }[];
  tradeOff: string;
  methodVersion: string;
}) {
  const names = input.selectedZoneNames;
  const joined = names.length < 2 ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const sentence = names.length
    ? `Focus on ${joined}`
    : "No valid package yet";
  return {
    sentence,
    reasons: input.topPillars.slice(0, 3).map(item => ({
      text: `${item.label}: ${Math.round(item.value)}/100 on the fixed demo cohort`,
      evidenceIds: item.evidenceIds
    })),
    tradeOff: input.tradeOff,
    methodVersion: input.methodVersion,
    forbiddenClaims: ["best-performing", "guaranteed", "will increase", "market share"]
  };
}
```

Do not convert historical activity into reach. Tests assert the full Bank sentence so punctuation cannot drift.
Before calling `buildExplanation`, sort selected zones by numeric `Zone.rankLabel`; this produces the approved Bank order while package tie-breaking remains binary and input-order independent.

- [ ] **Step 5: Verify planning behavior**

Run: `npm test -- tests/unit/scoring.test.ts tests/unit/packageBuilder.test.ts && npm run build`

Expected: all planning tests pass; the Bank fixture selects three zones and 3–8 faces within budget in under 100 ms on the test machine.

- [ ] **Step 6: Commit**

```bash
git add src/domain/eligibility.ts src/domain/scoring.ts src/domain/packageBuilder.ts tests/unit/scoring.test.ts tests/unit/packageBuilder.test.ts
git commit -m "feat: add deterministic planning engine"
```

## Task 4: Implement the audience estimator, evidence grades and exact-plan marginals

**Files:**
- Create: `src/domain/audience/types.ts`
- Create: `src/domain/audience/fingerprint.ts`
- Create: `src/domain/audience/evidence.ts`
- Create: `src/domain/audience/estimate.ts`
- Create: `src/domain/audience/marginals.ts`
- Create: `src/domain/audience/presenter.ts`
- Create: `src/demo/fixtures/audienceModels.ts`
- Create: `src/demo/fixtures/expectedSnapshots.ts`
- Test: `tests/unit/audienceFingerprint.test.ts`
- Test: `tests/unit/audienceEstimator.test.ts`
- Test: `tests/unit/audienceMarginals.test.ts`
- Test: `tests/unit/audienceSnapshots.test.ts`

- [ ] **Step 1: Write the failing formula and overlap tests**

```ts
// tests/unit/audienceEstimator.test.ts
it("computes 40% target reach and 45% influence capture", () => {
  const result = estimateMember({
    cells: [
      { id: "a", projectedN: 100, q: 1, r: 0.6, rInfluence: 0.6 },
      { id: "b", projectedN: 200, q: 0.5, r: 0.3, rInfluence: 0.3 }
    ]
  });
  expect(result.reachPct).toBe(40);
  expect(result.influenceCapturePct).toBe(45);
});

it("uses influential-member reach rather than general reach", () => {
  const result = estimateMember({ cells: [
    { id: "a", projectedN: 1000, q: 0.2, r: 0.5, rInfluence: 0.8 }
  ] });
  expect(result.reachPct).toBe(50);
  expect(result.influenceCapturePct).toBe(80);
});

it("deduplicates package overlap", () => {
  expect(reachFromKnownOverlap({
    universe: 1_000,
    leftCount: 400,
    rightCount: 300,
    overlapCount: 150
  })).toEqual({ uniqueCount: 550, reachPct: 55 });
});
```

Run: `npm test -- tests/unit/audienceEstimator.test.ts`

Expected: FAIL because estimator functions do not exist.

- [ ] **Step 2: Define strict audience contracts and discriminated result states**

Define `ExposurePlanV1`, `TargetDefinition`, `InfluenceProfile`, `ReachModelRun`, paired scenario/replicate members, sample context and claim evidence exactly as §7.8/§8.1. Return separate `ReachResult` and `InfluenceResult` unions with `available | native_only | unavailable | withheld | invalidated` states; never use nullable numeric fields.

```ts
import type { Sector } from "@/domain/model";

export type DecisionUse = "D_input" | "display_only";
export type ClaimGrade = "A" | "B" | "C" | "D" | "unranked";
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DaypartWindow {
  days: readonly Weekday[];
  startMinute: number;
  endMinute: number;
}

export type DeliverySchedule =
  | { kind: "static"; postingStartDate: string; postingEndDate: string }
  | { kind: "dooh"; plays: readonly (DaypartWindow & {
      playsPerHour: number;
      spotDurationSeconds: number;
    })[] };

export interface ExposurePlanFace {
  faceId: string;
  zoneId: string;
  dayparts: readonly DaypartWindow[];
  delivery: DeliverySchedule;
  requestedShareOfTimePpm: number;
  availabilityAssumptionPpm: number;
  uptimeAssumptionPpm: number;
}

export interface ExposurePlanV1 {
  fingerprintVersion: 1;
  campaign: { startDate: string; endDate: string; timeZone: string };
  basis: "audience" | "lts" | "ots";
  qualifiedExposureCount: 1;
  qualificationVersion: string;
  modelRevision: string;
  faces: readonly ExposurePlanFace[];
}

export interface TargetCell {
  id: string;
  projectedN: number;
  influenceAgeEligibility: "adult" | "minor" | "unknown";
}

export interface TargetDefinition {
  id: string;
  version: string;
  universeId: string;
  geographyId: string;
  periodKey: string;
  daypartKey: string;
  cells: readonly TargetCell[];
}

export interface InfluenceProfileCell {
  cellId: string;
  projectedN: number;
  q: number;
  archetypeId: string;
}

export interface InfluenceProfile {
  id: string;
  version: string;
  targetDefinitionId: string;
  targetDefinitionVersion: string;
  sector: Sector;
  constructId: string;
  constructVersion: string;
  constructKind: "calibrated_category_classification";
  modelCardId: string;
  confirmation: "confirmed" | "unconfirmed";
  adultOnly: true;
  cells: readonly InfluenceProfileCell[];
  demo: boolean;
}

export interface ReachMember {
  id: string;
  cells: Readonly<Record<string, { r: number; rInfluence?: number }>>;
}

export type ReachUncertainty =
  | { kind: "joint_scenarios"; baseMemberId: string; members: readonly ReachMember[] }
  | { kind: "paired_replicates"; lowerQuantile: number; upperQuantile: number;
      quantileMethod: "nearest_rank_v1"; members: readonly ReachMember[] };

export type SampleContext =
  | { kind: "synthetic"; effectiveSampleN: "not_applicable";
      headlinePrivacyContributorCount: "not_applicable" }
  | { kind: "census"; effectiveSampleN: "not_applicable";
      headlinePrivacyContributorCount: number }
  | { kind: "empirical"; unweightedSampleN: number; effectiveSampleN: number;
      headlinePrivacyContributorCount: number };

export interface ReachModelRun {
  id: string;
  exposurePlanFingerprint: string;
  targetDefinitionId: string;
  targetDefinitionVersion: string;
  universeId: string;
  geographyId: string;
  periodKey: string;
  daypartKey: string;
  modelRevision: string;
  populationUnit: "person" | "device" | "vehicle" | "passenger" | "opportunity";
  grossOrUnique: "gross" | "unique";
  qualifiedExposureCount: number | null;
  deduplication: { crossFace: boolean; crossZone: boolean; crossDay: boolean; methodVersion: string };
  uncertainty: ReachUncertainty;
  sample: SampleContext;
  evidenceIds: readonly string[];
}

export interface ClaimEvidence {
  q: number;
  grade: ClaimGrade;
  components: Readonly<Record<string, number>>;
  caps: readonly { code: string; maxQ: number }[];
  evidenceIds: readonly string[];
}

export interface ReachPoint { memberId: string; universe: number; rawCount: number; rawPct: number }
export interface InfluencePoint {
  memberId: string;
  adultTargetUniverse: number;
  influenceWeightedUniverse: number;
  reachedInfluenceMass: number;
  capturePct: number;
  archetypes: Readonly<Record<string, { label: string; influenceWeightedUniverse: number;
    reachedInfluenceMass: number; capturePct: number }>>;
}
export interface ReachSeries {
  intervalType: "scenario_range" | "confidence_interval";
  members: readonly ReachPoint[];
  point: ReachPoint;
  lower: ReachPoint;
  upper: ReachPoint;
}
export interface InfluenceSeries {
  intervalType: "scenario_range" | "confidence_interval";
  members: readonly InfluencePoint[];
  point: InfluencePoint;
  lower: InfluencePoint;
  upper: InfluencePoint;
}

export type ReachUnavailableReason =
  | "not_modelled" | "incompatible_basis" | "incomplete_target_cells" | "evidence_below_d";
export type InfluenceUnavailableReason =
  | "profile_not_configured" | "profile_unconfirmed" | "incompatible_profile"
  | "unknown_age_cells" | "incomplete_profile_coverage" | "joint_reach_not_supplied"
  | "zero_influence_universe" | "evidence_below_d";

export type ReachResult =
  | { status: "available"; decisionUse: DecisionUse; series: ReachSeries; evidence: ClaimEvidence }
  | { status: "native_only"; label: string; value: number; unit: string }
  | { status: "unavailable"; reason: ReachUnavailableReason; representedUniverseCoveragePct?: number }
  | { status: "withheld"; reason: "sample_threshold" | "privacy_threshold" }
  | { status: "invalidated"; reason: "exposure_plan_mismatch" | "unsupported_exposure_plan" };

export type InfluenceResult =
  | { status: "available"; decisionUse: "display_only"; series: InfluenceSeries; evidence: ClaimEvidence }
  | { status: "unavailable"; reason: InfluenceUnavailableReason; representedUniverseCoveragePct?: number }
  | { status: "withheld"; reason: "sample_threshold" | "privacy_threshold" }
  | { status: "invalidated"; reason: "exposure_plan_mismatch" | "unsupported_exposure_plan" };

export interface AudienceSummary {
  uiRole: "summary";
  reach: ReachResult;
  influence: InfluenceResult;
  audienceEvidenceGrade: ClaimGrade | null;
  basisLabel: "Synthetic scenario" | "Audience basis" | "LTS-based" | "OTS-based";
  exposurePlanFingerprint: `epf.v1.${string}`;
  targetDefinitionVersion: string;
  influenceProfileVersion: string | null;
  modelRevision: string;
  comparabilityKey: string;
  assumptions: readonly string[];
  limitations: readonly string[];
  evidenceIds: readonly string[];
}

export class AudienceInputError extends Error {}
```

Malformed values throw `AudienceInputError`; valid missing/unsupported evidence returns a degraded union. Under-18 cells are excluded with an adult-only denominator; unknown-age cells make influence unavailable.

- [ ] **Step 3: Create the exposure-plan fingerprint**

Canonicalize and sort faces, weekdays, dayparts and DOOH play windows with binary string comparison. Include face IDs, dates, dayparts, static/DOOH schedules, share-of-time PPM, uptime/availability PPM, basis/threshold, qualification version and model revision; exclude cost, rank, evidence IDs and zone ID. Reject duplicate faces/windows. The browser implementation is explicitly asynchronous:

```ts
import type { CampaignBrief, InventoryFace } from "@/domain/model";
import type { ExposurePlanV1 } from "@/domain/audience/types";

export function buildDemoExposurePlan(brief: CampaignBrief,
  faces: readonly InventoryFace[]): ExposurePlanV1 {
  const allDays = [1, 2, 3, 4, 5, 6, 7] as const;
  const fullDay = { days: allDays, startMinute: 0, endMinute: 1440 };
  return { fingerprintVersion: 1, campaign: { startDate: brief.startDate, endDate: brief.endDate,
      timeZone: "Africa/Lagos" }, basis: "audience", qualifiedExposureCount: 1,
    qualificationVersion: "qualified-exposure-demo-v1", modelRevision: "synthetic-overlap-v1",
    faces: faces.map(face => ({ faceId: face.id, zoneId: face.zoneId, dayparts: [fullDay],
      delivery: face.format === "dooh_screen"
        ? { kind: "dooh" as const, plays: [{ days: allDays, startMinute: 480, endMinute: 1200,
            playsPerHour: 60, spotDurationSeconds: 10 }] }
        : { kind: "static" as const, postingStartDate: brief.startDate, postingEndDate: brief.endDate },
      requestedShareOfTimePpm: face.format === "dooh_screen" ? 100_000 : 1_000_000,
      availabilityAssumptionPpm: 1_000_000,
      uptimeAssumptionPpm: face.format === "dooh_screen" ? 900_000 : 1_000_000 })) };
}
```

```ts
// src/domain/audience/fingerprint.ts
import { AudienceInputError, type DaypartWindow, type ExposurePlanV1 } from "@/domain/audience/types";

const binaryCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sortWindow = (window: DaypartWindow) => {
  if (new Set(window.days).size !== window.days.length) throw new AudienceInputError("Duplicate weekday");
  return { ...window, days: [...window.days].sort((a, b) => a - b) };
};
const assertUniqueWindows = (windows: readonly DaypartWindow[], faceId: string) => {
  const keys = windows.map(window => `${window.days.join(",")}:${window.startMinute}-${window.endMinute}`);
  if (new Set(keys).size !== keys.length) throw new AudienceInputError(`Duplicate window on ${faceId}`);
};
const assertWindow = (window: DaypartWindow) => {
  if (!window.days.length || window.days.some(day => day < 1 || day > 7)
    || !Number.isInteger(window.startMinute) || !Number.isInteger(window.endMinute)
    || window.startMinute < 0 || window.endMinute > 1440 || window.endMinute <= window.startMinute) {
    throw new AudienceInputError("Invalid daypart window");
  }
};

export function canonicalizeExposurePlanV1(plan: ExposurePlanV1) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.campaign.startDate)
    || !/^\d{4}-\d{2}-\d{2}$/.test(plan.campaign.endDate)
    || plan.campaign.startDate > plan.campaign.endDate) throw new AudienceInputError("Invalid campaign dates");
  const seen = new Set<string>();
  const faces = [...plan.faces].sort((a, b) => binaryCompare(a.faceId, b.faceId)).map(face => {
    if (seen.has(face.faceId)) throw new AudienceInputError(`Duplicate face ${face.faceId}`);
    seen.add(face.faceId);
    for (const ppm of [face.requestedShareOfTimePpm, face.availabilityAssumptionPpm, face.uptimeAssumptionPpm]) {
      if (!Number.isInteger(ppm) || ppm < 0 || ppm > 1_000_000) throw new AudienceInputError("Invalid PPM delivery value");
    }
    face.dayparts.forEach(assertWindow);
    if (face.delivery.kind === "dooh") face.delivery.plays.forEach(play => {
      assertWindow(play);
      if (play.playsPerHour <= 0 || play.spotDurationSeconds <= 0) throw new AudienceInputError("Invalid DOOH schedule");
    });
    const dayparts = face.dayparts.map(sortWindow)
      .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
    assertUniqueWindows(dayparts, face.faceId);
    const delivery = face.delivery.kind === "static" ? {
      kind: "static" as const,
      postingStartDate: face.delivery.postingStartDate,
      postingEndDate: face.delivery.postingEndDate
    } : {
      kind: "dooh" as const,
      plays: face.delivery.plays.map(play => ({ ...sortWindow(play),
        playsPerHour: play.playsPerHour, spotDurationSeconds: play.spotDurationSeconds }))
        .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
    };
    if (delivery.kind === "dooh") assertUniqueWindows(delivery.plays, face.faceId);
    return {
      faceId: face.faceId,
      dayparts,
      delivery,
      requestedShareOfTimePpm: face.requestedShareOfTimePpm,
      availabilityAssumptionPpm: face.availabilityAssumptionPpm,
      uptimeAssumptionPpm: face.uptimeAssumptionPpm
    };
  });
  return {
    fingerprintVersion: 1 as const,
    campaign: { startDate: plan.campaign.startDate, endDate: plan.campaign.endDate,
      timeZone: plan.campaign.timeZone },
    basis: plan.basis,
    qualifiedExposureCount: plan.qualifiedExposureCount,
    qualificationVersion: plan.qualificationVersion,
    modelRevision: plan.modelRevision,
    faces
  };
}

export async function fingerprintExposurePlan(plan: ExposurePlanV1): Promise<`epf.v1.${string}`> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalizeExposurePlanV1(plan)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `epf.v1.${hex}`;
}
```

Export `AudienceInputError` from `types.ts`. All callers and tests `await fingerprintExposurePlan(...)`.

Test that reorderings preserve the fingerprint and changing each included field changes it, including the same face tuple with a new share-of-time or play schedule.

- [ ] **Step 4: Implement evidence and estimator ordering**

Use the fixed order `validate → fingerprint match → compatibility → sample/privacy → universe coverage → evidence → calculate`. Required evidence components use the minimum, missing components equal zero, and caps apply after the minimum. Grade boundaries are A 85, B 70, C 55, D 40; below 40 is unavailable. Synthetic inputs cap at 54.

For each paired member:

```ts
export interface EstimatorCell {
  id: string;
  projectedN: number;
  q: number;
  r: number;
  rInfluence?: number;
  ageEligibility?: "adult" | "minor" | "unknown";
  archetypeId?: string;
}

export function estimateMember(input: { cells: readonly EstimatorCell[] }) {
  if (!input.cells.length) throw new AudienceInputError("At least one target cell is required");
  for (const cell of input.cells) {
    if (!Number.isFinite(cell.projectedN) || cell.projectedN <= 0) {
      throw new AudienceInputError(`Invalid projectedN for ${cell.id}`);
    }
    for (const [name, value] of [["q", cell.q], ["r", cell.r], ["rInfluence", cell.rInfluence]] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
        throw new AudienceInputError(`Invalid ${name} for ${cell.id}`);
      }
    }
  }
  const targetUniverse = input.cells.reduce((sum, cell) => sum + cell.projectedN, 0);
  const reachCount = input.cells.reduce((sum, cell) => sum + cell.projectedN * cell.r, 0);
  const reachPct = 100 * reachCount / targetUniverse;
  const adultCells = input.cells.filter(cell => (cell.ageEligibility ?? "adult") === "adult");
  if (input.cells.some(cell => cell.ageEligibility === "unknown")) {
    return { reachPct,
      influenceStatus: "unavailable" as const, influenceReason: "unknown_age_cells" as const };
  }
  if (adultCells.some(cell => cell.rInfluence === undefined)) {
    return { reachPct,
      influenceStatus: "unavailable" as const, influenceReason: "joint_reach_not_supplied" as const };
  }
  const influenceUniverse = adultCells.reduce((sum, cell) => sum + cell.projectedN * cell.q, 0);
  if (influenceUniverse <= 0) {
    return { reachPct, influenceStatus: "unavailable" as const,
      influenceReason: "zero_influence_universe" as const };
  }
  const reachedInfluenceMass = adultCells.reduce(
    (sum, cell) => sum + cell.projectedN * cell.q * (cell.rInfluence ?? 0), 0
  );
  const archetypeIds = [...new Set(adultCells.map(cell => cell.archetypeId ?? "unclassified"))].sort();
  const archetypes = Object.fromEntries(archetypeIds.map(archetypeId => {
    const members = adultCells.filter(cell => (cell.archetypeId ?? "unclassified") === archetypeId);
    const universe = members.reduce((sum, cell) => sum + cell.projectedN * cell.q, 0);
    const reached = members.reduce((sum, cell) => sum + cell.projectedN * cell.q * (cell.rInfluence ?? 0), 0);
    return [archetypeId, { influenceWeightedUniverse: universe, reachedInfluenceMass: reached,
      capturePct: 100 * reached / universe }];
  }));
  return { reachPct, influenceCapturePct: 100 * reachedInfluenceMass / influenceUniverse, archetypes };
}

export function reachFromKnownOverlap(input: {
  universe: number; leftCount: number; rightCount: number; overlapCount: number;
}) {
  const uniqueCount = input.leftCount + input.rightCount - input.overlapCount;
  if (input.universe <= 0 || uniqueCount < 0 || uniqueCount > input.universe) {
    throw new AudienceInputError("Invalid known-overlap counts");
  }
  return { uniqueCount, reachPct: 100 * uniqueCount / input.universe };
}
```

```ts
// src/domain/audience/evidence.ts
export function scoreToEvidenceGrade(q: number): ClaimGrade {
  return q >= 85 ? "A" : q >= 70 ? "B" : q >= 55 ? "C" : q >= 40 ? "D" : "unranked";
}

export function gradeEvidence(input: {
  required: readonly string[];
  components: Readonly<Record<string, number | undefined>>;
  caps: readonly { code: string; maxQ: number }[];
  evidenceIds: readonly string[];
}): ClaimEvidence {
  const components = Object.fromEntries(input.required.map(key => [key, input.components[key] ?? 0]));
  const q = Math.min(...Object.values(components), ...input.caps.map(cap => cap.maxQ), 100);
  return { q, grade: scoreToEvidenceGrade(q), components, caps: input.caps, evidenceIds: input.evidenceIds };
}

export function compactAudienceEvidence(reach: ReachResult, influence: InfluenceResult): ClaimGrade | null {
  const evidence = [reach.status === "available" ? reach.evidence : null,
    influence.status === "available" ? influence.evidence : null].filter(
      (item): item is ClaimEvidence => item !== null);
  return evidence.length ? scoreToEvidenceGrade(Math.min(...evidence.map(item => item.q))) : null;
}
```

```ts
// src/domain/audience/estimate.ts
export type RunCompatibilityGate =
  | { status: "compatible" }
  | { status: "fingerprint_mismatch" }
  | { status: "native_unit"; unit: ReachModelRun["populationUnit"] }
  | { status: "incompatible_basis" };

export function validateRunCompatibility(run: ReachModelRun, target: TargetDefinition,
  fingerprint: string): RunCompatibilityGate {
  if (run.exposurePlanFingerprint !== fingerprint) {
    return { status: "fingerprint_mismatch" };
  }
  if (run.populationUnit !== "person") {
    return { status: "native_unit", unit: run.populationUnit };
  }
  const compatible = run.grossOrUnique === "unique" && run.qualifiedExposureCount === 1
    && run.targetDefinitionId === target.id && run.targetDefinitionVersion === target.version
    && run.universeId === target.universeId && run.geographyId === target.geographyId
    && run.periodKey === target.periodKey && run.daypartKey === target.daypartKey;
  return compatible ? { status: "compatible" }
    : { status: "incompatible_basis" };
}

export function samplePrivacyGate(sample: SampleContext):
  { status: "pass" } | { status: "withheld"; reason: "sample_threshold" | "privacy_threshold" } {
  if (sample.kind === "synthetic") return { status: "pass" };
  if (sample.kind === "empirical" && sample.effectiveSampleN < 100) {
    return { status: "withheld", reason: "sample_threshold" };
  }
  if (sample.headlinePrivacyContributorCount < 50) {
    return { status: "withheld", reason: "privacy_threshold" };
  }
  return { status: "pass" };
}
```

`estimateAudience` maps `fingerprint_mismatch` to invalidated, `incompatible_basis` to unavailable and `native_unit` to `native_only` only when the provider supplies an actual native value/label/unit; otherwise it returns unavailable. It never inserts zero or converts devices, vehicles, passengers, footfall or opportunities into people.

Do not substitute general `r` when `rInfluence` is missing; return `joint_reach_not_supplied`. Reach remains available when influence does not. `InfluenceResult.decisionUse` is always `display_only`; a caller may mark Reach `D_input` only when the same model scored every candidate package before selection.

- [ ] **Step 5: Build the deterministic synthetic overlap model and golden outputs**

Use the exact representative constants below, then deterministically expand coverage to all six seeded faces per zone. This keeps every seeded swap inside model coverage while leaving the baseline/swap/upload goldens unchanged; uploaded inventory still returns `unsupported_exposure_plan`.

```ts
// src/demo/fixtures/audienceModels.ts
export const DEMO_SCENARIOS = [
  { id: "low", multiplier: .88 },
  { id: "base", multiplier: 1 },
  { id: "high", multiplier: 1.098 }
] as const;

export const DEMO_AUDIENCE_FIXTURES = {
  bank_fintech: {
    cells: {
      professional: { N: 280_000, q: .22, archetype: "professional_peer_advisers" },
      student: { N: 220_000, q: .18, archetype: "campus_connectors" },
      merchant: { N: 140_000, q: .35, archetype: "merchant_peer_advisers" }
    },
    faces: {
      "demo-yaba_akoka-1": { rBase: { professional: .08, student: .28, merchant: .10 }, rInfluenceBase: { professional: .12, student: .47, merchant: .22 } },
      "demo-ikeja-1": { rBase: { professional: .22, student: .08, merchant: .20 }, rInfluenceBase: { professional: .35, student: .12, merchant: .35 } },
      "demo-vi_ikoyi-1": { rBase: { professional: .25, student: .05, merchant: .18 }, rInfluenceBase: { professional: .40, student: .08, merchant: .32 } },
      "demo-lekki-1": { rBase: { professional: .20, student: .29, merchant: .23 }, rInfluenceBase: { professional: .08, student: .22, merchant: .10 } },
      "demo-surulere-1": { rBase: { professional: .28, student: .03, merchant: .11 }, rInfluenceBase: { professional: .46, student: .04, merchant: .18 } }
    },
    plans: {
      baseline: ["demo-yaba_akoka-1", "demo-ikeja-1", "demo-vi_ikoyi-1"],
      swap: ["demo-lekki-1", "demo-ikeja-1", "demo-vi_ikoyi-1"],
      upload: ["demo-lekki-1", "demo-ikeja-1", "demo-surulere-1"]
    }
  },
  fmcg: {
    cells: {
      student: { N: 250_000, q: .20, archetype: "campus_connectors" },
      household: { N: 240_000, q: .30, archetype: "household_purchase_advisers" },
      convenience: { N: 310_000, q: .15, archetype: "convenience_recommenders" }
    },
    faces: {
      "demo-yaba_akoka-1": { rBase: { student: .30, household: .08, convenience: .16 }, rInfluenceBase: { student: .48, household: .12, convenience: .24 } },
      "demo-ikeja-1": { rBase: { student: .12, household: .22, convenience: .20 }, rInfluenceBase: { student: .20, household: .35, convenience: .30 } },
      "demo-surulere-1": { rBase: { student: .24, household: .18, convenience: .30 }, rInfluenceBase: { student: .34, household: .25, convenience: .38 } },
      "demo-vi_ikoyi-1": { rBase: { student: .28, household: .27, convenience: .32 }, rInfluenceBase: { student: .18, household: .18, convenience: .20 } },
      "demo-lekki-1": { rBase: { student: .08, household: .30, convenience: .18 }, rInfluenceBase: { student: .10, household: .44, convenience: .22 } }
    },
    plans: {
      baseline: ["demo-yaba_akoka-1", "demo-ikeja-1", "demo-surulere-1"],
      swap: ["demo-yaba_akoka-1", "demo-ikeja-1", "demo-vi_ikoyi-1"],
      upload: ["demo-lekki-1", "demo-surulere-1", "demo-vi_ikoyi-1"]
    }
  },
  real_estate: {
    cells: {
      professional: { N: 180_000, q: .28, archetype: "property_professional_advisers" },
      investor: { N: 90_000, q: .40, archetype: "property_investor_advisers" },
      diaspora: { N: 60_000, q: .45, archetype: "diaspora_purchase_advisers" }
    },
    faces: {
      "demo-vi_ikoyi-1": { rBase: { professional: .30, investor: .28, diaspora: .22 }, rInfluenceBase: { professional: .48, investor: .46, diaspora: .38 } },
      "demo-ikeja-1": { rBase: { professional: .20, investor: .10, diaspora: .05 }, rInfluenceBase: { professional: .32, investor: .18, diaspora: .08 } },
      "demo-lekki-1": { rBase: { professional: .24, investor: .30, diaspora: .28 }, rInfluenceBase: { professional: .40, investor: .52, diaspora: .48 } },
      "demo-yaba_akoka-1": { rBase: { professional: .25, investor: .32, diaspora: .40 }, rInfluenceBase: { professional: .08, investor: .10, diaspora: .12 } },
      "demo-surulere-1": { rBase: { professional: .16, investor: .22, diaspora: .18 }, rInfluenceBase: { professional: .24, investor: .35, diaspora: .30 } }
    },
    plans: {
      baseline: ["demo-vi_ikoyi-1", "demo-ikeja-1", "demo-lekki-1"],
      swap: ["demo-vi_ikoyi-1", "demo-yaba_akoka-1", "demo-lekki-1"],
      upload: ["demo-surulere-1", "demo-yaba_akoka-1", "demo-lekki-1"]
    }
  }
} as const;

export const DEMO_INFLUENCE_MODEL_CARDS = {
  bank_fintech: { constructId: "category-financial-advice-v1",
    construct: "Adult target members modelled as likely sources of category-specific financial recommendations",
    instrument: "Synthetic calibrated classification for demonstration only",
    permittedUse: "Aggregate display-only Influence Capture",
    limitations: ["Not individual identification", "Not persuasion, perception change or sales", "Demographics alone do not establish influence"],
    evidenceGrade: "D" },
  fmcg: { constructId: "category-household-purchase-advice-v1",
    construct: "Adult target members modelled as likely sources of category-specific household purchase recommendations",
    instrument: "Synthetic calibrated classification for demonstration only",
    permittedUse: "Aggregate display-only Influence Capture",
    limitations: ["Not individual identification", "Not persuasion, perception change or sales", "Demographics alone do not establish influence"],
    evidenceGrade: "D" },
  real_estate: { constructId: "category-property-advice-v1",
    construct: "Adult target members modelled as likely sources of category-specific property recommendations",
    instrument: "Synthetic calibrated classification for demonstration only",
    permittedUse: "Aggregate display-only Influence Capture",
    limitations: ["Not individual identification", "Not persuasion, perception change or sales", "Demographics alone do not establish influence"],
    evidenceGrade: "D" }
} as const;

const capped = (probability: number, multiplier: number) => Math.min(.999_999, probability * multiplier);
const union = (values: readonly number[]) => 1 - values.reduce((miss, value) => miss * (1 - value), 1);

interface DemoFixture {
  cells: Readonly<Record<string, { N: number; q: number; archetype: string }>>;
  faces: Readonly<Record<string, {
    rBase: Readonly<Record<string, number>>;
    rInfluenceBase: Readonly<Record<string, number>>;
  }>>;
  plans: Readonly<Record<string, readonly string[]>>;
}

function expandFaceCoverage(faces: DemoFixture["faces"]): DemoFixture["faces"] {
  return Object.fromEntries(Object.entries(faces).flatMap(([representativeId, values]) => {
    const prefix = representativeId.replace(/-1$/, "");
    return Array.from({ length: 6 }, (_, index) => {
      const factor = 1 - index * .06;
      const scale = (record: Readonly<Record<string, number>>) => Object.fromEntries(
        Object.entries(record).map(([cellId, probability]) => [cellId, probability * factor])
      );
      return [`${prefix}-${index + 1}`, {
        rBase: scale(values.rBase), rInfluenceBase: scale(values.rInfluenceBase)
      }];
    });
  }));
}

export const DEMO_AUDIENCE_MODELS: Readonly<Record<string, DemoFixture>> = Object.fromEntries(
  Object.entries(DEMO_AUDIENCE_FIXTURES).map(([sector, fixture]) => [sector,
    { ...fixture, faces: expandFaceCoverage(fixture.faces) }])
);

export function evaluateSyntheticFaceSet(fixture: DemoFixture, faceIds: readonly string[], multiplier: number) {
  if (!faceIds.length || faceIds.some(faceId => !fixture.faces[faceId])) return { status: "unsupported" as const };
  const cells = Object.entries(fixture.cells).map(([cellId, cell]) => ({ ...cell,
    r: union(faceIds.map(faceId => capped(fixture.faces[faceId].rBase[cellId], multiplier))),
    rInfluence: union(faceIds.map(faceId => capped(fixture.faces[faceId].rInfluenceBase[cellId], multiplier)))
  }));
  const targetUniverse = cells.reduce((sum, cell) => sum + cell.N, 0);
  const reachCount = cells.reduce((sum, cell) => sum + cell.N * cell.r, 0);
  const influenceWeightedUniverse = cells.reduce((sum, cell) => sum + cell.N * cell.q, 0);
  const reachedInfluenceMass = cells.reduce((sum, cell) => sum + cell.N * cell.q * cell.rInfluence, 0);
  return { status: "supported" as const, reachCount, reachPct: 100 * reachCount / targetUniverse,
    reachedInfluenceMass, influenceCapturePct: 100 * reachedInfluenceMass / influenceWeightedUniverse };
}

export function evaluateFixture(fixture: DemoFixture, planName: string, multiplier: number) {
  const faceIds = fixture.plans[planName];
  return faceIds ? evaluateSyntheticFaceSet(fixture, faceIds, multiplier) : { status: "unsupported" as const };
}
```

For scenarios `{low: 0.88, base: 1, high: 1.098}`, calculate each cell's general and influential-member probability with `union(selectedFaceProbabilities.map(value => capped(value, multiplier)))`. Label the method `Synthetic independent-union overlap assumption; demo-only`, use synthetic sample `not_applicable`, and cap evidence at D.

Store these exact six-decimal expected values, not updateable framework snapshots:

```ts
// src/demo/fixtures/expectedSnapshots.ts
export const EXPECTED_AUDIENCE = {
  bank_fintech: {
    baseline: { reach: [240398.655693, 268206.4, 290077.042024], influence: [57.619105, 63.364684, 67.718785] },
    swap: { reach: [271823.959757, 301724.4, 324972.651666], influence: [50.436596, 55.658319, 59.648556] },
    upload: { reach: [268387.021169, 298055.12, 321151.401837], influence: [48.623720, 53.734118, 57.654845] }
  },
  fmcg: {
    baseline: { reach: [357241.447383, 395912.32, 425843.702885], influence: [58.810502, 64.419252, 68.621473] },
    swap: { reach: [381145.996943, 421738.88, 453023.765833], influence: [52.655108, 58.090635, 62.247959] },
    upload: { reach: [410566.8864, 452580, 484642.268078], influence: [54.644609, 60.153875, 64.342250] }
  },
  real_estate: {
    baseline: { reach: [163508.329882, 180556.8, 193628.248173], influence: [70.914959, 76.761143, 80.958988] },
    swap: { reach: [189000.906547, 207117.6, 220717.279903], influence: [67.002365, 73.081905, 77.548640] },
    upload: { reach: [171812.869325, 189146.4, 202330.412676], influence: [58.961963, 64.813714, 69.234227] }
  }
} as const;
```

The Bank baseline must present:

```text
240k–290k est. target reach • ~63% influence capture
Synthetic scenario • Audience evidence D
```

Use exact expected objects, not updateable framework snapshots.

- [ ] **Step 6: Implement exact leave-one-out marginals**

For every zone/face, remove the subject while holding remaining delivery constant, recompute the fingerprint, evaluate the exact reduced plan, pair members by ID and compute baseline-minus-reduced reach count/influence mass:

```ts
// src/domain/audience/marginals.ts
export interface AudienceMarginal {
  subjectId: string;
  status: "available" | "unsupported_exposure_plan" | "withheld" | "model_non_monotonic";
  reachLossByMember?: Readonly<Record<string, number>>;
  influenceMassLossByMember?: Readonly<Record<string, number>>;
  additive: false;
  legend: "Modelled marginal contribution, not geographic coverage";
}

export async function computeLeaveOneOutMarginals(input: {
  plan: ExposurePlanV1;
  groupBy: "face" | "zone";
  evaluateExactPlan: (plan: ExposurePlanV1) => Promise<{
    status: "supported";
    reach: Readonly<Record<string, number>>;
    influenceMass: Readonly<Record<string, number>>;
  } | { status: "unsupported" }>;
  disclosure: (subjectId: string) => "allow" | "withhold";
}): Promise<AudienceMarginal[]> {
  const baseline = await input.evaluateExactPlan(input.plan);
  if (baseline.status === "unsupported") throw new AudienceInputError("Baseline plan is unsupported");
  const subjects = input.groupBy === "face"
    ? input.plan.faces.map(face => face.faceId)
    : [...new Set(input.plan.faces.map(face => face.zoneId))].sort();
  return Promise.all(subjects.map(async subjectId => {
    const common = { subjectId, additive: false as const,
      legend: "Modelled marginal contribution, not geographic coverage" as const };
    if (input.disclosure(subjectId) !== "allow") return { ...common, status: "withheld" as const };
    const faces = input.plan.faces.filter(face => input.groupBy === "face"
      ? face.faceId !== subjectId : face.zoneId !== subjectId);
    const reduced = await input.evaluateExactPlan({ ...input.plan, faces });
    if (reduced.status === "unsupported") return { ...common, status: "unsupported_exposure_plan" as const };
    const memberIds = Object.keys(baseline.reach).sort();
    if (memberIds.some(id => reduced.reach[id] === undefined || reduced.influenceMass[id] === undefined)) {
      return { ...common, status: "unsupported_exposure_plan" as const };
    }
    const reachLossByMember = Object.fromEntries(memberIds.map(id => [id, baseline.reach[id] - reduced.reach[id]]));
    const influenceMassLossByMember = Object.fromEntries(memberIds.map(id => [id, baseline.influenceMass[id] - reduced.influenceMass[id]]));
    if ([...Object.values(reachLossByMember), ...Object.values(influenceMassLossByMember)]
      .some(value => value < -1e-8)) return { ...common, status: "model_non_monotonic" as const };
    return { ...common, status: "available" as const, reachLossByMember, influenceMassLossByMember };
  }));
}
```

The evaluator recomputes and verifies the reduced exposure-plan fingerprint internally before returning. Unsupported reduced plans produce no symbol; empirical privacy verdicts fail closed to `withheld`.

- [ ] **Step 7: Verify the complete audience contract**

Run: `npm test -- tests/unit/audienceFingerprint.test.ts tests/unit/audienceEstimator.test.ts tests/unit/audienceMarginals.test.ts tests/unit/audienceSnapshots.test.ts`

Expected: tests cover formula fixtures, all evidence boundaries, missing profile/joint reach, sample 99/100, privacy 49/50, synthetic exemption, plan mismatch, all nine goldens and face-order repeatability; all pass.

- [ ] **Step 8: Commit**

```bash
git add src/domain/audience src/demo/fixtures/audienceModels.ts src/demo/fixtures/expectedSnapshots.ts tests/unit/audience*.test.ts
git commit -m "feat: add audience reach and influence estimator"
```

## Task 5: Build the in-process planner service and reversible plan session

**Files:**
- Create: `src/application/contracts.ts`
- Create: `src/application/plannerService.ts`
- Create: `src/domain/adjustments.ts`
- Create: `src/domain/evidence.ts`
- Test: `tests/unit/adjustments.test.ts`
- Test: `tests/unit/plannerService.test.ts`

- [ ] **Step 1: Write failing baseline/draft/apply/reset tests**

```ts
it("keeps baseline immutable across a site swap", async () => {
  const session = await service.createPlan({ briefId: "brief-bank" });
  const baselineFaces = session.baseline.package.faceIds;
  const changed = await service.recalculateDraft(session, {
    type: "swap_face",
    removeFaceId: baselineFaces[0],
    addFaceId: session.baseline.alternativeFaceIds[0]
  });
  expect(changed.baseline.package.faceIds).toEqual(baselineFaces);
  expect(changed.draft?.package.faceIds).not.toEqual(baselineFaces);
});

it("applies before opening RFQ review", async () => {
  const session = await sessionWithValidDraft();
  const applied = await service.applyDraft(session, { openRfq: true });
  expect(applied.draft).toBeNull();
  expect(applied.active.kind).toBe("customised");
  expect(applied.nextView).toBe("rfq_review");
});
```

Run: `npm test -- tests/unit/adjustments.test.ts tests/unit/plannerService.test.ts`

Expected: FAIL because plan-session operations do not exist.

- [ ] **Step 2: Define typed application contracts**

```ts
// src/application/contracts.ts
import type { AudienceSummary } from "@/domain/audience/types";
import type { CandidatePackage } from "@/domain/packageBuilder";
import type { CampaignBrief, Sector } from "@/domain/model";

export type ImportType = "service_locations" | "inventory";
export type DraftAction =
  | { type: "set_budget"; budgetNgn: number }
  | { type: "exclude_zone"; zoneId: string }
  | { type: "replace_zone"; removeZoneId: string; addZoneId: string }
  | { type: "swap_face"; removeFaceId: string; addFaceId: string }
  | { type: "remove_face"; faceId: string }
  | { type: "import_revision"; revision: string; importType: ImportType;
      acceptedRows: number; quarantinedRows: number; decisionUse: "context_only" | "eligibility_constraint" };

export interface Recommendation {
  id: string;
  brief: CampaignBrief;
  package: CandidatePackage;
  alternativeFaceIds: readonly string[];
  alternativeZoneIds: readonly string[];
  sentence: string;
  reasons: readonly { text: string; evidenceIds: readonly string[] }[];
  tradeOff: string;
  audience: AudienceSummary;
  conditions: readonly string[];
  methodVersion: string;
  dataRevision: string;
  normalizationCohortId: string;
}

export type RecommendationDraft = Recommendation & {
  validity: { status: "valid" } | { status: "invalid"; reason: string; recovery: "swap" | "exclude" | "repair" };
  comparison: WhatChanged;
};

export type AudienceDelta =
  | { status: "comparable"; basePointDelta: number }
  | { status: "not_comparable" | "invalidated" | "withheld" };
export interface RecommendationDelta {
  costNgn: number;
  planningFit: number;
  evidenceConfidence: number;
  addedFaceIds: readonly string[];
  removedFaceIds: readonly string[];
  reach: AudienceDelta;
  influence: AudienceDelta;
}
export interface WhatChanged {
  cause: string;
  tradeOff: string;
  activeToDraft: RecommendationDelta;
  originalToDraft: RecommendationDelta;
}

export interface PlanSession {
  baseline: Recommendation;
  active: { kind: "original" | "customised"; recommendation: Recommendation };
  draft: RecommendationDraft | null;
  actionHistory: readonly DraftAction[];
  dataRevision: string;
  normalizationCohortId: string;
  nextView: "recommendation" | "rfq_review";
}

export interface ParseBriefRequest { text: string; sector?: CampaignBrief["sector"] }
export interface ParseBriefResponse { brief: CampaignBrief; assumptions: readonly string[]; parser: "deterministic_local_v1" }
export interface CreatePlanRequest { briefId: string }
interface ImportPreviewBase {
  type: ImportType;
  checksum: string;
  accepted: readonly Record<string, unknown>[];
  quarantined: readonly { sourceRow: number; errors: readonly string[]; values: readonly unknown[] }[];
  required: readonly string[];
  invalid: readonly string[];
  previewRows: readonly (readonly unknown[])[];
  mappingCandidates: readonly { canonical: string; header: string; confidence: number }[];
  mapped: Readonly<Record<string, string>>;
  ignored: readonly string[];
  selectedSheet?: string;
}
export type ImportPreview = ImportPreviewBase & (
  | { status: "ready" | "mapping_confirmation_required" }
  | { status: "sheet_selection_required";
      sheetCandidates: readonly { name: string; rows: readonly (readonly unknown[])[] }[] }
);
export interface ImportConfirmation {
  purpose: string;
  rightsConfirmed: boolean;
  privacyClass: "non_personal_business" | "aggregate_location";
  decisionUse: "context_only" | "eligibility_constraint";
}
export interface RfqReviewInput {
  buyerName: string;
  buyerEmail: string;
  responseDeadline: string;
  startDate: string;
  endDate: string;
  datesConfirmed: boolean;
  supplierNotes: string;
}
export interface GeneratedRfq {
  supplierMessages: readonly { ownerId: string; faceIds: readonly string[]; body: string }[];
  internalRequest: { planId: string; workingBudgetNgn: number;
    audiencePlanningBasis: AudienceSummary | "unavailable";
    lines: readonly { ownerId: string; faceId: string; rateNgn: number }[] };
}

export interface PlannerOperations {
  parseBrief(request: ParseBriefRequest): Promise<ParseBriefResponse>;
  createPlan(request: CreatePlanRequest): Promise<PlanSession>;
  recalculateDraft(session: PlanSession, action: DraftAction): Promise<PlanSession>;
  undoDraft(session: PlanSession): Promise<PlanSession>;
  applyDraft(session: PlanSession, options: { openRfq: boolean; acknowledgeAudienceLoss?: boolean }): Promise<PlanSession>;
  resetPlan(session: PlanSession): Promise<PlanSession>;
  previewImport(file: File, type: ImportType, options?: {
    selectedSheet?: string; confirmedHeaders?: Readonly<Record<string, string>>;
  }): Promise<ImportPreview>;
  confirmImport(session: PlanSession, preview: ImportPreview,
    confirmation: ImportConfirmation): Promise<PlanSession>;
  generateRfq(session: PlanSession, request: RfqReviewInput): Promise<GeneratedRfq>;
}
```

`parseBrief` is a deterministic local parser for the three seeded phrases/sector terms and always returns an editable structured form plus explicit assumptions. Use an exact keyword table (`drink|snack|soap → fmcg`, `apartment|estate|property → real_estate`, `bank|wallet|payment|fintech → bank_fintech`), select the explicit sector when present, and otherwise preserve the user's text in `product` for manual editing. Always return `parser: "deterministic_local_v1"`; no output pretends an LLM ran.

```ts
export function createLocalBriefParser(briefs: readonly CampaignBrief[]) {
  const keywords: readonly [RegExp, Sector][] = [
    [/\b(drink|snack|soap)\b/i, "fmcg"],
    [/\b(apartment|estate|property)\b/i, "real_estate"],
    [/\b(bank|wallet|payment|fintech)\b/i, "bank_fintech"]
  ];
  return (request: ParseBriefRequest): ParseBriefResponse => {
    const sector = request.sector ?? keywords.find(([pattern]) => pattern.test(request.text))?.[1] ?? "bank_fintech";
    const template = briefs.find(brief => brief.sector === sector);
    if (!template) throw new Error(`Missing seeded ${sector} brief`);
    return { brief: { ...template, product: request.text.trim() || template.product },
      assumptions: ["Lagos demo geography", "Four-week seeded flight", "Illustrative demo inventory and rates"],
      parser: "deterministic_local_v1" };
  };
}
```

- [ ] **Step 3: Implement immutable session transitions**

```ts
// src/domain/adjustments.ts
import type { DraftAction, PlanSession, RecommendationDraft } from "@/application/contracts";

type RebuildDraft = (base: PlanSession["active"]["recommendation"], actions: readonly DraftAction[])
  => Promise<RecommendationDraft>;

export async function recalculateSession(
  session: PlanSession,
  action: DraftAction,
  rebuild: RebuildDraft
): Promise<PlanSession> {
  const actionHistory = [...session.actionHistory, action];
  return { ...session, draft: await rebuild(session.active.recommendation, actionHistory),
    actionHistory, nextView: "recommendation" };
}

export async function undoSession(session: PlanSession, rebuild: RebuildDraft): Promise<PlanSession> {
  const actionHistory = session.actionHistory.slice(0, -1);
  return { ...session, actionHistory,
    draft: actionHistory.length ? await rebuild(session.active.recommendation, actionHistory) : null };
}

export function applySession(session: PlanSession, options: {
  openRfq: boolean; acknowledgeAudienceLoss?: boolean;
}): PlanSession {
  if (!session.draft || session.draft.validity.status !== "valid") throw new Error("A valid draft is required");
  const audienceUnavailable = session.draft.audience.reach.status !== "available"
    || session.draft.audience.influence.status !== "available";
  if (audienceUnavailable && !options.acknowledgeAudienceLoss) throw new Error("Audience-loss acknowledgment required");
  return { ...session, active: { kind: "customised", recommendation: session.draft }, draft: null,
    actionHistory: [], dataRevision: session.draft.dataRevision,
    normalizationCohortId: session.draft.normalizationCohortId,
    nextView: options.openRfq ? "rfq_review" : "recommendation" };
}

export function resetSession(session: PlanSession): PlanSession {
  return { ...session, active: { kind: "original", recommendation: session.baseline }, draft: null,
    actionHistory: [], dataRevision: session.baseline.dataRevision,
    normalizationCohortId: session.baseline.normalizationCohortId, nextView: "recommendation" };
}
```

```ts
// append to src/domain/adjustments.ts
import type { InventoryFace } from "@/domain/model";

export interface ExactDraftRequest {
  base: PlanSession["active"]["recommendation"];
  selectedFaceIds: readonly string[];
  budgetNgn: number;
  excludedZoneIds: readonly string[];
  dataRevision: string;
  actions: readonly DraftAction[];
}

const zeroDelta = { costNgn: 0, planningFit: 0, evidenceConfidence: 0,
  addedFaceIds: [], removedFaceIds: [], reach: { status: "not_comparable" as const },
  influence: { status: "not_comparable" as const } };
function invalidFrom(base: ExactDraftRequest["base"], reason: string,
  recovery: "swap" | "exclude" | "repair"): RecommendationDraft {
  return { ...base, validity: { status: "invalid", reason, recovery }, comparison: {
    cause: reason, tradeOff: "No valid draft was applied", activeToDraft: zeroDelta,
    originalToDraft: zeroDelta } };
}

export function createDemoDraftRebuilder(input: {
  faceLookup: Readonly<Record<string, InventoryFace>>;
  recomputeExact: (request: ExactDraftRequest) => Promise<RecommendationDraft>;
}): RebuildDraft {
  return async (base, actions) => {
    const selected = new Set(base.package.faceIds);
    const excludedZones = new Set<string>();
    let budgetNgn = base.brief.budgetNgn;
    let dataRevision = base.dataRevision;
    for (const action of actions) {
      if (action.type === "set_budget") budgetNgn = action.budgetNgn;
      if (action.type === "exclude_zone") {
        excludedZones.add(action.zoneId);
        [...selected].filter(id => input.faceLookup[id].zoneId === action.zoneId).forEach(id => selected.delete(id));
      }
      if (action.type === "replace_zone") {
        [...selected].filter(id => input.faceLookup[id].zoneId === action.removeZoneId).forEach(id => selected.delete(id));
        const replacement = base.alternativeFaceIds.find(id => input.faceLookup[id].zoneId === action.addZoneId);
        if (!replacement) return invalidFrom(base, "No eligible replacement in that zone", "repair");
        selected.add(replacement);
      }
      if (action.type === "swap_face") { selected.delete(action.removeFaceId); selected.add(action.addFaceId); }
      if (action.type === "remove_face") {
        const zoneId = input.faceLookup[action.faceId].zoneId;
        const zoneCount = [...selected].filter(id => input.faceLookup[id].zoneId === zoneId).length;
        if (zoneCount === 1) return invalidFrom(base, "Swap or exclude the zone before removing its only face", "swap");
        selected.delete(action.faceId);
      }
      if (action.type === "import_revision") dataRevision = action.revision;
    }
    return input.recomputeExact({ base, selectedFaceIds: [...selected].sort(), budgetNgn,
      excludedZoneIds: [...excludedZones].sort(), dataRevision, actions });
  };
}
```

Implement `rebuild` in `plannerService.ts` by replaying the full ordered action list over the active face set/budget, then calling package scoring and the audience estimator once for the resulting exact plan. It never patches displayed totals. The returned comparison model has `activeToDraft` and `originalToDraft`; numeric audience deltas are `{status:"comparable", basePointDelta}` only when `comparabilityKey` matches, otherwise `{status:"not_comparable"|"invalidated"|"withheld"}`. Do not subtract interval endpoints.

```ts
// src/application/plannerService.ts
import type {
  DraftAction, GeneratedRfq, ImportConfirmation, ImportPreview, ImportType, ParseBriefRequest, ParseBriefResponse,
  PlanSession, PlannerOperations, Recommendation, RecommendationDraft, RfqReviewInput
} from "@/application/contracts";
import { applySession, recalculateSession, resetSession, undoSession } from "@/domain/adjustments";

export interface PlannerDependencies {
  parseBrief: (request: ParseBriefRequest) => ParseBriefResponse;
  createRecommendation: (briefId: string) => Promise<Recommendation>;
  rebuildDraft: (base: Recommendation, actions: readonly DraftAction[]) => Promise<RecommendationDraft>;
  previewImport: (file: File, type: ImportType, options?: {
    selectedSheet?: string; confirmedHeaders?: Readonly<Record<string, string>>;
  }) => Promise<ImportPreview>;
  confirmImport: (session: PlanSession, preview: ImportPreview,
    confirmation: ImportConfirmation) => Promise<PlanSession>;
  generateRfq: (session: PlanSession, request: RfqReviewInput) => Promise<GeneratedRfq>;
}

export function createPlannerService(deps: PlannerDependencies): PlannerOperations {
  return {
    parseBrief: async request => deps.parseBrief(request),
    createPlan: async request => {
      const baseline = await deps.createRecommendation(request.briefId);
      return { baseline, active: { kind: "original", recommendation: baseline }, draft: null,
        actionHistory: [], dataRevision: baseline.dataRevision,
        normalizationCohortId: baseline.normalizationCohortId, nextView: "recommendation" };
    },
    recalculateDraft: (session, action) => recalculateSession(session, action, deps.rebuildDraft),
    undoDraft: session => undoSession(session, deps.rebuildDraft),
    applyDraft: async (session, options) => applySession(session, options),
    resetPlan: async session => resetSession(session),
    previewImport: deps.previewImport,
    confirmImport: deps.confirmImport,
    generateRfq: deps.generateRfq
  };
}
```

Instantiate this factory once with demo-repository adapters in `PlannerProvider`.

- [ ] **Step 4: Enforce draft validity and audience-loss acknowledgment**

Use this validation before every rebuilt draft:

```ts
export function validateDraftFaceSet(faceIds: readonly string[], faceZone: Readonly<Record<string, string>>) {
  if (faceIds.length < 3 || faceIds.length > 8) return { status: "invalid" as const,
    reason: "A package requires 3–8 faces", recovery: "repair" as const };
  const zoneCounts = faceIds.reduce<Record<string, number>>((counts, id) => {
    const zoneId = faceZone[id];
    counts[zoneId] = (counts[zoneId] ?? 0) + 1;
    return counts;
  }, {});
  if (!Object.keys(zoneCounts).length) return { status: "invalid" as const,
    reason: "At least one zone is required", recovery: "repair" as const };
  return { status: "valid" as const };
}
```

The `remove_face` replay rejects removal of a zone's only face before mutation and returns recovery `swap`; the UI also offers zone exclusion. Invalid drafts retain the last valid package and disable RFQ. A valid package with unsupported audience coverage may be applied only with `acknowledgeAudienceLoss: true`; the internal RFQ stores `Audience estimate unavailable`. `applyDraft({openRfq:true})` atomically applies then changes view.

- [ ] **Step 5: Add evidence navigation records**

Use one typed evidence graph for every score, audience member, face, rate, demo availability and context item:

```ts
// src/domain/evidence.ts
export type EvidenceNode =
  | { kind: "source"; id: string; label: string; sourceDatasetId: string; effectiveDate: string; limitation: string }
  | { kind: "field"; id: string; label: string; value: string | number; sourceId: string }
  | { kind: "transformation"; id: string; label: string; inputIds: readonly string[]; methodVersion: string };

export interface EvidenceGraph { nodes: Readonly<Record<string, EvidenceNode>> }

export function evidencePath(graph: EvidenceGraph, leafId: string): readonly EvidenceNode[] {
  const visit = (id: string, seen: Set<string>): EvidenceNode[] => {
    if (seen.has(id)) throw new Error(`Evidence cycle at ${id}`);
    const node = graph.nodes[id];
    if (!node) throw new Error(`Missing evidence node ${id}`);
    if (node.kind === "source") return [node];
    const parents = node.kind === "field" ? [node.sourceId] : node.inputIds;
    return [node, ...parents.flatMap(parent => visit(parent, new Set([...seen, id])))];
  };
  return visit(leafId, new Set());
}
```

Planner selectors expose breadcrumb IDs for `Planning Fit → pillar → zone → site → source` and `Audience → metric → archetype → zone/site → source` in at most five interactions.

- [ ] **Step 6: Verify session/service behavior**

Run: `npm test -- tests/unit/adjustments.test.ts tests/unit/plannerService.test.ts`

Expected: tests pass for budget/zone/site actions, invalid draft retention, undo/apply/reset, audience invalidation acknowledgment, deterministic repeat runs and display-only influence isolation.

- [ ] **Step 7: Commit**

```bash
git add src/application src/domain/adjustments.ts src/domain/evidence.ts tests/unit/adjustments.test.ts tests/unit/plannerService.test.ts
git commit -m "feat: add reversible planner session"
```

## Task 6: Build the map-first shell and compact recommendation output

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/PlannerProvider.tsx`
- Create: `src/app/plannerReducer.ts`
- Create: `src/app/plannerSelectors.ts`
- Create: `src/features/brief/BriefPanel.tsx`
- Create: `src/features/brief/MoreOptions.tsx`
- Create: `src/features/recommendation/RecommendationHeader.tsx`
- Create: `src/features/recommendation/PackageStrip.tsx`
- Create: `src/features/common/Button.tsx`
- Create: `src/features/common/Badge.tsx`
- Test: `tests/component/promotionWizard.test.tsx`
- Test: `tests/component/packageStrip.test.tsx`

- [ ] **Step 1: Write failing experience-state and audience-strip tests**

```tsx
it("moves from compact brief to the sparse loaded result", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Create recommendation" }));
  expect(await screen.findByText("Focus on Yaba/Akoka, Ikeja and VI/Ikoyi")).toBeTruthy();
  expect(screen.getByRole("button", { name: /240k–290k est. target reach/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /63% influence capture/i })).toBeTruthy();
  expect(screen.queryByText(/KPI dashboard/i)).toBeNull();
});

it("shows named stages instead of a fake percentage", async () => {
  let resolvePlan!: (session: PlanSession) => void;
  const pendingPlan = new Promise<PlanSession>(resolve => { resolvePlan = resolve; });
  const operations = { ...demoPlannerOperations, createPlan: () => pendingPlan };
  render(<App operations={operations} />);
  await userEvent.click(screen.getByRole("button", { name: "Create recommendation" }));
  expect(screen.queryByText(/\d+% complete/i)).toBeNull();
  expect(screen.getByText(/Checking inventory|Scoring zones/)).toBeTruthy();
  resolvePlan(bankBaselineSession);
  expect(await screen.findByText("Focus on Yaba/Akoka, Ikeja and VI/Ikoyi")).toBeTruthy();
});
```

Run: `npm test -- tests/component/promotionWizard.test.tsx tests/component/packageStrip.test.tsx`

Expected: FAIL because provider/components do not exist.

- [ ] **Step 2: Implement the six-state reducer and selectors**

```ts
export type ExperienceState =
  | { kind: "brief_ready" }
  | { kind: "generating"; stage: "checking_inventory" | "scoring_zones" | "building_package" }
  | { kind: "recommendation_loaded" }
  | { kind: "draft_changed" }
  | { kind: "active_customised" }
  | { kind: "generation_failed"; message: string };

export interface PlannerUiState {
  experience: ExperienceState;
  session: PlanSession | null;
  drawer: DrawerState | null;
  mapLens: "rank" | "reach" | "influence";
  focusedZoneId: string | null;
  focusedFaceId: string | null;
}

export type PlannerAction =
  | { type: "generation_started" }
  | { type: "generation_stage"; stage: Extract<ExperienceState, { kind: "generating" }>["stage"] }
  | { type: "generation_succeeded"; session: PlanSession }
  | { type: "generation_failed"; message: string }
  | { type: "session_changed"; session: PlanSession }
  | { type: "drawer_opened"; drawer: DrawerState; lens?: PlannerUiState["mapLens"] }
  | { type: "drawer_closed" }
  | { type: "focus_changed"; zoneId: string | null; faceId: string | null };

export const initialPlannerUiState: PlannerUiState = {
  experience: { kind: "brief_ready" }, session: null, drawer: null, mapLens: "rank",
  focusedZoneId: null, focusedFaceId: null
};

export function plannerReducer(state: PlannerUiState, action: PlannerAction): PlannerUiState {
  switch (action.type) {
    case "generation_started": return { ...state, experience: { kind: "generating", stage: "checking_inventory" } };
    case "generation_stage": return { ...state, experience: { kind: "generating", stage: action.stage } };
    case "generation_succeeded": return { ...state, session: action.session,
      experience: { kind: "recommendation_loaded" } };
    case "generation_failed": return { ...state, experience: { kind: "generation_failed", message: action.message } };
    case "session_changed": return { ...state, session: action.session,
      experience: action.session.draft ? { kind: "draft_changed" }
        : action.session.active.kind === "customised" ? { kind: "active_customised" }
        : { kind: "recommendation_loaded" } };
    case "drawer_opened": return { ...state, drawer: action.drawer, mapLens: action.lens ?? state.mapLens };
    case "drawer_closed": return { ...state, drawer: null, mapLens: "rank" };
    case "focus_changed": return { ...state, focusedZoneId: action.zoneId, focusedFaceId: action.faceId };
  }
}
```

Reducer actions must be serializable and side-effect free. `PlannerProvider` owns async service calls, announces named generation stages and dispatches success/failure without losing the populated brief.

```tsx
// src/app/PlannerProvider.tsx
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { PlannerOperations } from "@/application/contracts";
import { initialPlannerUiState, plannerReducer, type PlannerAction, type PlannerUiState } from "@/app/plannerReducer";

interface PlannerContextValue {
  state: PlannerUiState;
  dispatch: Dispatch<PlannerAction>;
  operations: PlannerOperations;
  createRecommendation: (briefId: string) => Promise<void>;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ operations, children, stagePause = () => new Promise(resolve => setTimeout(resolve, 120)) }: {
  operations: PlannerOperations; children: ReactNode; stagePause?: () => Promise<void>;
}) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerUiState);
  const createRecommendation = async (briefId: string) => {
    dispatch({ type: "generation_started" });
    try {
      const planPromise = operations.createPlan({ briefId });
      await stagePause();
      dispatch({ type: "generation_stage", stage: "scoring_zones" });
      const session = await planPromise;
      dispatch({ type: "generation_stage", stage: "building_package" });
      await stagePause();
      dispatch({ type: "generation_succeeded", session });
    } catch (error) {
      dispatch({ type: "generation_failed", message: error instanceof Error ? error.message : "Generation failed" });
    }
  };
  return <PlannerContext.Provider value={{ state, dispatch, operations, createRecommendation }}>
    {children}
  </PlannerContext.Provider>;
}

export function usePlanner() {
  const value = useContext(PlannerContext);
  if (!value) throw new Error("usePlanner must be used inside PlannerProvider");
  return value;
}
```

`App` accepts `operations: PlannerOperations = demoPlannerOperations`, making async stages controllable in component tests and keeping production/demo wiring explicit.

- [ ] **Step 3: Implement the compact brief and visible assumptions**

Default fields are Sector, Product, Priority audience and one action. Implement them as controlled fields so generation failure preserves the brief:

```tsx
// src/features/brief/BriefPanel.tsx
import type { CampaignBrief, Sector } from "@/domain/model";
import { MoreOptions } from "@/features/brief/MoreOptions";

interface BriefPanelProps {
  brief: CampaignBrief;
  onChange: (brief: CampaignBrief) => void;
  onSubmit: (briefId: string) => Promise<void>;
  generating: boolean;
}

export function BriefPanel({ brief, onChange, onSubmit, generating }: BriefPanelProps) {
  return <form aria-label="Campaign brief" className="brief-strip" onSubmit={event => {
    event.preventDefault();
    void onSubmit(brief.id);
  }}>
    <label>Sector<select value={brief.sector} onChange={event => onChange({ ...brief,
      sector: event.target.value as Sector })}>
      <option value="fmcg">FMCG</option><option value="real_estate">Real Estate</option>
      <option value="bank_fintech">Bank/Fintech</option>
    </select></label>
    <label>Product<input value={brief.product} onChange={event => onChange({ ...brief, product: event.target.value })} /></label>
    <label>Priority audience<input value={brief.audience} onChange={event => onChange({ ...brief, audience: event.target.value })} /></label>
    <button disabled={generating} type="submit">Create recommendation</button>
    <MoreOptions brief={brief} onChange={onChange} />
  </form>;
}
```

```tsx
// src/features/brief/MoreOptions.tsx
import type { CampaignBrief, Objective } from "@/domain/model";

export function MoreOptions({ brief, onChange }: {
  brief: CampaignBrief; onChange: (brief: CampaignBrief) => void;
}) {
  const lens = brief.influenceProfileConfirmed
    ? "Influence lens: merchant, campus and professional advisers · Confirmed"
    : "Influence profile awaiting confirmation";
  return <details className="more-options"><summary>More options</summary>
    <label>Objective<select value={brief.objective} onChange={event => onChange({ ...brief,
      objective: event.target.value as Objective })}>
      <option value="awareness_launch">Awareness / launch</option>
      <option value="consideration_trust">Consideration / trust</option>
      <option value="action_leads">Action / leads</option>
    </select></label>
    <p>Geography: Lagos demo</p>
    <label>Budget (NGN)<input type="number" min="1" value={brief.budgetNgn}
      onChange={event => onChange({ ...brief, budgetNgn: event.currentTarget.valueAsNumber })} /></label>
    <label>Start date<input type="date" value={brief.startDate}
      onChange={event => onChange({ ...brief, startDate: event.target.value })} /></label>
    <label>End date<input type="date" value={brief.endDate}
      onChange={event => onChange({ ...brief, endDate: event.target.value })} /></label>
    <p>{lens}</p>
  </details>;
}
```

Seeded briefs are preconfirmed. A non-demo unconfirmed profile renders no Influence Capture percentage.

- [ ] **Step 4: Implement the package strip with separate metric hit targets**

```tsx
<section className="package-strip" aria-label="Recommended media package">
  <div className="package-facts">{assetCount} faces • {ownerCount} owners • {formatNgn(cost)} indicative
    <button onClick={openMethod}>Planning Fit {fit} · Confidence {confidence}</button></div>
  <div className="audience-signal" aria-label="Audience estimate">
    <button onClick={openReach}>{reachHeadline}</button>
    <span aria-hidden="true">•</span>
    <button onClick={openInfluence}>{influenceHeadline}</button>
    <small>{basisLabel} • {audienceEvidenceLabel}</small>
  </div>
  <div className="package-actions">
    <button onClick={openMethod}>How was this chosen?</button>
    <button onClick={openAdjustments}>Adjust sites</button>
    <button onClick={openRfq}>Review RFQ</button>
  </div>
</section>
```

The Bank fixture renders exactly `240k–290k est. target reach • ~63% influence capture` and `Synthetic scenario • Audience evidence D`. On narrow screens the two values collapse into one `Audience estimate` button; the drawer immediately shows Reach/Influence tabs.

- [ ] **Step 5: Verify shell states and responsive DOM contract**

Run: `npm test -- tests/component/promotionWizard.test.tsx tests/component/packageStrip.test.tsx && npm run build`

Expected: six-state tests, compact strip tests and build pass.

- [ ] **Step 6: Commit**

```bash
git add src/app src/features/brief src/features/recommendation src/features/common src/styles tests/component/promotionWizard.test.tsx tests/component/packageStrip.test.tsx
git commit -m "feat: add map-first promotion wizard shell"
```

## Task 7: Add the local MapLibre map, shared drawer and audience lenses

**Files:**
- Create: `src/features/map/PlannerMap.tsx`
- Create: `src/features/map/MapErrorFallback.tsx`
- Create: `src/features/map/MapLegend.tsx`
- Create: `src/features/map/mapStyle.ts`
- Create: `src/features/map/mapLayers.ts`
- Create: `src/demo/fixtures/mapContext.ts`
- Create: `src/features/drawer/drawerModel.ts`
- Create: `src/features/drawer/PlannerDrawer.tsx`
- Create: `src/features/drawer/ZonePanel.tsx`
- Create: `src/features/drawer/SitePanel.tsx`
- Create: `src/features/drawer/MethodPanel.tsx`
- Create: `src/features/drawer/AudiencePanel.tsx`
- Create: `src/features/drawer/EvidencePanel.tsx`
- Test: `tests/component/plannerMap.test.tsx`
- Test: `tests/component/audienceDrawer.test.tsx`
- Test: `tests/component/evidencePath.test.tsx`

- [ ] **Step 1: Write failing lens, drilldown and focus tests**

```tsx
it("opens Influence directly and restores rank styling on close", async () => {
  renderLoadedWizard();
  await userEvent.click(screen.getByRole("button", { name: /63% influence capture/i }));
  expect(screen.getByRole("tab", { name: "Influence", selected: true })).toBeTruthy();
  expect(screen.getByText("Modelled marginal contribution, not geographic coverage")).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("complementary", { name: "Recommendation details" })).toBeNull();
  expect(screen.getByTestId("planner-map")).toHaveAttribute("data-lens", "rank");
  expect(screen.getByRole("button", { name: /63% influence capture/i })).toHaveFocus();
});

it("reaches an audience source in five interactions", async () => {
  renderLoadedWizard({ viewport: "mobile" });
  await userEvent.click(screen.getByRole("button", { name: "Audience estimate" })); // 1
  await userEvent.click(screen.getByRole("tab", { name: "Influence" })); // 2
  await userEvent.click(screen.getByRole("button", { name: "Merchant peer advisers" })); // 3
  await userEvent.click(screen.getByRole("button", { name: /Ikeja/ })); // 4
  await userEvent.click(screen.getByRole("button", { name: "View source" })); // 5
  expect(screen.getByText("Synthetic influence model v1")).toBeTruthy();
});
```

Run: `npm test -- tests/component/plannerMap.test.tsx tests/component/audienceDrawer.test.tsx tests/component/evidencePath.test.tsx`

Expected: FAIL because map/drawer components do not exist.

- [ ] **Step 2: Create a fully local MapLibre style**

```ts
// src/features/map/mapStyle.ts
import type { StyleSpecification } from "maplibre-gl";

export const localMapStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#f3f1eb" } }]
};
```

Initialize MapLibre once, import its bundled CSS, and add local GeoJSON sources for Lagos context, zones, faces and service locations after `load`. Do not include remote tile, glyph, sprite or font URLs. If WebGL/style loading fails, render the ranked zone/site list with all actions intact.

```tsx
// src/features/map/PlannerMap.tsx
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { MapErrorFallback } from "@/features/map/MapErrorFallback";
import { MapLegend } from "@/features/map/MapLegend";
import { layerDefinitions } from "@/features/map/mapLayers";
import { localMapStyle } from "@/features/map/mapStyle";

interface PlannerMapProps {
  context: GeoJSON.FeatureCollection;
  zones: GeoJSON.FeatureCollection;
  faces: GeoJSON.FeatureCollection;
  services: GeoJSON.FeatureCollection;
  lens: "rank" | "reach" | "influence";
  onZone: (zoneId: string) => void;
  onFace: (faceId: string) => void;
}

export function PlannerMap({ context, zones, faces, services, lens, onZone, onFace }: PlannerMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRegistry = useRef<maplibregl.Map | null>(null);
  const zoneMarkers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map | undefined;
    try {
      map = new maplibregl.Map({ container: container.current, style: localMapStyle,
        center: [3.40, 6.52], zoom: 10.7, attributionControl: false });
      mapRegistry.current = map;
      map.once("load", () => {
        for (const [id, data] of Object.entries({ context, zones, faces, services })) {
          map!.addSource(id, { type: "geojson", data });
        }
        layerDefinitions.forEach(layer => map!.addLayer(layer));
      });
      map.on("error", () => setFailed(true));
      map.on("click", "zone-selected", event => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onZone(id);
      });
      map.on("click", "face-points", event => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onFace(id);
      });
    } catch { setFailed(true); }
    return () => { mapRegistry.current = null; map?.remove(); };
  }, []);
  useEffect(() => {
    const map = mapRegistry.current;
    if (!map) return;
    if (map.getLayer("reach-marginals")) map.setLayoutProperty("reach-marginals", "visibility", lens === "reach" ? "visible" : "none");
    if (map.getLayer("influence-marginals")) map.setLayoutProperty("influence-marginals", "visibility", lens === "influence" ? "visible" : "none");
  }, [lens]);
  useEffect(() => {
    const map = mapRegistry.current;
    if (!map) return;
    for (const [id, data] of Object.entries({ context, zones, faces, services })) {
      (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
    }
  }, [context, zones, faces, services]);
  useEffect(() => {
    const map = mapRegistry.current;
    if (!map) return;
    zoneMarkers.current.forEach(marker => marker.remove());
    zoneMarkers.current = zones.features.flatMap(feature => {
      if (feature.geometry.type !== "Point" || feature.properties?.state !== "selected") return [];
      const button = document.createElement("button");
      button.className = "zone-rank-marker";
      button.type = "button";
      button.textContent = String(feature.properties.rank);
      button.setAttribute("aria-label", `${feature.properties.name} details`);
      button.addEventListener("click", () => onZone(String(feature.properties?.id)));
      return [new maplibregl.Marker({ element: button }).setLngLat(feature.geometry.coordinates as [number, number]).addTo(map)];
    });
    return () => zoneMarkers.current.forEach(marker => marker.remove());
  }, [zones, onZone]);
  return failed ? <MapErrorFallback zones={zones} faces={faces} onZone={onZone} onFace={onFace} />
    : <><div ref={container} data-lens={lens} data-testid="planner-map" className="planner-map" />
      <MapLegend lens={lens} /></>;
}
```

The component stores the created map in `mapRegistry` and the second effect updates source data. Use this visibly illustrative—not surveyed—context layer:

```ts
// src/demo/fixtures/mapContext.ts
const road = (id: string, name: string, coordinates: [number, number][]): GeoJSON.Feature => ({
  type: "Feature", properties: { id, name, kind: "road", label: "Illustrative local context" },
  geometry: { type: "LineString", coordinates }
});

export const mapContext: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [
  { type: "Feature", properties: { id: "lagoon", name: "Lagoon context", kind: "water",
      label: "Illustrative local context" }, geometry: { type: "Polygon", coordinates: [[
      [3.365, 6.432], [3.575, 6.432], [3.575, 6.462], [3.365, 6.462], [3.365, 6.432]
    ]] } },
  road("road-herbert-macaulay", "Herbert Macaulay context", [[3.382, 6.485], [3.390, 6.540]]),
  road("road-ikorodu", "Ikorodu Road context", [[3.370, 6.500], [3.356, 6.575]]),
  road("road-mobolaji", "Mobolaji Bank Anthony context", [[3.350, 6.570], [3.345, 6.620]]),
  road("road-western", "Western Avenue context", [[3.325, 6.480], [3.355, 6.535]]),
  road("road-lekki-epe", "Lekki–Epe context", [[3.430, 6.455], [3.560, 6.445]]),
  road("road-ozumba", "Ozumba Mbadiwe context", [[3.405, 6.440], [3.455, 6.435]])
] };
```

- [ ] **Step 3: Implement stable map layer semantics**

Default: selected zones are solid numbered marks, alternatives muted outlines, conditional amber, ineligible red, unknown grey. Use these layer expressions:

```ts
// src/features/map/mapLayers.ts
import type { LayerSpecification } from "maplibre-gl";

export const layerDefinitions: LayerSpecification[] = [
  { id: "context-water", type: "fill", source: "context", filter: ["==", ["get", "kind"], "water"],
    paint: { "fill-color": "#dce9e7", "fill-opacity": .8 } },
  { id: "context-roads", type: "line", source: "context", filter: ["==", ["get", "kind"], "road"],
    paint: { "line-color": "#d2d2ca", "line-width": 2 } },
  { id: "zone-alternatives", type: "line", source: "zones", filter: ["!=", ["get", "state"], "selected"],
    paint: { "line-color": ["match", ["get", "state"], "conditional", "#a66a10", "ineligible", "#ad3e3e", "#8a928e"],
      "line-width": 2, "line-dasharray": [2, 2] } },
  { id: "zone-selected", type: "fill", source: "zones", filter: ["==", ["get", "state"], "selected"],
    paint: { "fill-color": "#ed5b2a", "fill-opacity": .2, "fill-outline-color": "#cc4319" } },
  { id: "face-points", type: "circle", source: "faces",
    paint: { "circle-radius": ["case", ["==", ["get", "selected"], true], 6, 4],
      "circle-color": ["match", ["get", "state"], "conditional", "#a66a10", "ineligible", "#ad3e3e", "#24765a"],
      "circle-stroke-color": "#fffefa", "circle-stroke-width": 2 } },
  { id: "reach-marginals", type: "circle", source: "zones", layout: { visibility: "none" },
    filter: ["has", "reachMarginal"], paint: { "circle-color": "#24765a", "circle-opacity": .5,
      "circle-radius": ["interpolate", ["linear"], ["get", "reachMarginal"], 0, 6, 80_000, 28] } },
  { id: "influence-marginals", type: "circle", source: "zones", layout: { visibility: "none" },
    filter: ["has", "influenceMarginal"], paint: { "circle-radius": 18,
      "circle-color": ["interpolate", ["linear"], ["get", "influenceMarginal"], 0, "#efe9d8", 25_000, "#7a2f23"],
      "circle-opacity": .65 } }
];
```

Always show a legend/source period and numerical ranked list. Never render a geographic buffer/halo for marginal contribution.

Clicking the reach metric sets `mapLens = "reach"`; influence sets `"influence"`; strip background opens summary but retains `"rank"`. A selected-zone influence tag appears only with instrument-supported zone-level reach/marginal evidence; otherwise show a neutral context tag or nothing.

- [ ] **Step 4: Implement one drawer state machine**

```ts
export type DrawerState =
  | { kind: "zone"; zoneId: string }
  | { kind: "site"; faceId: string }
  | { kind: "method"; pillar?: "A" | "D" | "C" | "P" | "E" }
  | { kind: "audience"; tab: "summary" | "reach" | "influence"; archetypeId?: string; subjectId?: string }
  | { kind: "evidence"; evidenceId: string; backStack: readonly DrawerState[] }
  | { kind: "rfq" };
```

The drawer has Back, Close, breadcrumb and Escape behavior. Save the opener element and restore focus on close. Zone/site/method/audience states share the same `<aside aria-label="Recommendation details">`; no second drawer or modal competes with the map.

```tsx
// src/features/drawer/PlannerDrawer.tsx
import { useEffect, useRef } from "react";
import type { DrawerState } from "@/features/drawer/drawerModel";
import { AudiencePanel } from "@/features/drawer/AudiencePanel";
import { EvidencePanel } from "@/features/drawer/EvidencePanel";
import { MethodPanel } from "@/features/drawer/MethodPanel";
import { SitePanel } from "@/features/drawer/SitePanel";
import { ZonePanel } from "@/features/drawer/ZonePanel";

export function PlannerDrawer({ state, onBack, onClose }: {
  state: DrawerState | null; onBack: () => void; onClose: () => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const open = state !== null;
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => closeButton.current?.focus());
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onCloseRef.current();
        if (event.key !== "Tab") return;
        const drawer = closeButton.current?.closest("aside");
        const focusable = [...(drawer?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    opener.current?.focus();
  }, [open]);
  if (!state) return null;
  return <aside aria-label="Recommendation details" className="planner-drawer">
    <nav aria-label="Detail breadcrumb"><button type="button" onClick={onBack}>Back</button>
      <button ref={closeButton} type="button" onClick={onClose}>Close</button></nav>
    {state.kind === "zone" && <ZonePanel zoneId={state.zoneId} />}
    {state.kind === "site" && <SitePanel faceId={state.faceId} />}
    {state.kind === "method" && <MethodPanel pillar={state.pillar} />}
    {state.kind === "audience" && <AudiencePanel state={state} />}
    {state.kind === "evidence" && <EvidencePanel evidenceId={state.evidenceId} />}
    {state.kind === "rfq" && <section><h2>RFQ review</h2><p>Apply the active package before generation.</p></section>}
  </aside>;
}
```

`onBack` pops `Evidence.backStack`; at a root state it closes. The key handler traps Tab/Shift+Tab and restores the exact opener after close.

The `How was this chosen?` state is a compact causal path, not a formula ledger or radar chart:

```tsx
// src/features/drawer/MethodPanel.tsx
export function MethodPanel({ pillar }: { pillar?: "A" | "D" | "C" | "P" | "E" }) {
  const { state, dispatch } = usePlanner();
  const model = selectMethodView(state, pillar);
  return <section aria-labelledby="method-title"><h2 id="method-title">How was this chosen?</h2>
    <ol className="decision-path">
      <li><strong>1. Eligibility</strong><span>{model.eligibleCount} of {model.candidateCount} faces passed fixed gates</span></li>
      <li><strong>2. Sector preset</strong><span>{model.presetLabel} · {model.methodVersion}</span></li>
      <li><strong>3. Planning Fit</strong><div className="contribution-bar" aria-label={`Planning Fit ${model.fit}`}>
        {model.contributions.map(item => <button key={item.pillar} style={{ width: `${item.weight * 100}%` }}
          aria-label={`${item.label}: score ${item.score}, weight ${Math.round(item.weight * 100)}%, contribution ${item.contribution.toFixed(1)}`}
          onClick={() => dispatch({ type: "drawer_opened", drawer: { kind: "method", pillar: item.pillar } })}>
          {item.pillar}</button>)}
      </div><span>{model.contributions.map(item => item.contribution).reduce((sum, value) => sum + value, 0).toFixed(1)} / 100</span></li>
      <li><strong>4. Evidence Confidence</strong><button onClick={() => dispatch({ type: "drawer_opened",
        drawer: { kind: "evidence", evidenceId: model.confidenceEvidenceId,
          backStack: [{ kind: "method", pillar }] } })}>
        {model.confidence.toFixed(0)} / 100 · {model.confidenceGrade}</button></li>
      <li><strong>5. Deterministic tie-break</strong><span>Fit ↓ · Confidence ↓ · Cost ↑ · face ID ↑</span></li>
    </ol>
    <p>{model.tradeOff}</p>
    <small>Planning Fit is a product-defined planning aid, not predicted campaign performance or certification.</small>
  </section>;
}
```

`selectMethodView` reads the stored `PlanningTrace` and five contribution facts; each contribution equals `pillar score × preset weight`, all five weights sum to 1, and the displayed contributions reconcile exactly to Planning Fit. The optional `pillar` state expands its definition, numerator/denominator, reducer, version and evidence link. Evidence Confidence is a separate row and never a sixth contribution.

- [ ] **Step 5: Render safe audience details and degraded states**

Reach shows target/universe, raw paired count/rate scenarios, basis/threshold, exposure-plan fingerprint, deduplication, uncertainty, evidence and zone marginals. Influence shows construct, adult denominator, archetype modelled coverage, joint reach method and limitations. Use exhaustive safe-state presenters:

```ts
// src/domain/audience/presenter.ts
export const headlineCount = (value: number) => `${Number((value / 1_000).toPrecision(2))}k`;
const formatRange = (series: ReachSeries) => `${headlineCount(series.lower.rawCount)}–${headlineCount(series.upper.rawCount)}`;

export function reachStatusText(result: ReachResult): string {
  switch (result.status) {
    case "available": return `${formatRange(result.series)} est. target reach`;
    case "native_only": return `${result.label}: ${result.value} ${result.unit}`;
    case "unavailable": return "Target reach not modelled";
    case "withheld": return result.reason === "privacy_threshold"
      ? "Target reach withheld — privacy threshold" : "Target reach withheld — sample threshold";
    case "invalidated": return "Target reach unavailable for this adjusted plan";
    default: return assertNever(result);
  }
}

export function influenceStatusText(result: InfluenceResult): string {
  switch (result.status) {
    case "available": return `~${Math.round(result.series.point.capturePct)}% influence capture`;
    case "unavailable": {
      switch (result.reason) {
        case "profile_not_configured": return "Influence profile not configured";
        case "profile_unconfirmed": return "Influence profile awaiting confirmation";
        case "joint_reach_not_supplied": return "Influence-member reach not modelled for this plan";
        case "unknown_age_cells": return "Influence capture unavailable — adult denominator unresolved";
        case "zero_influence_universe": return "Influence capture unavailable — no positive influence universe";
        case "incompatible_profile": return "Influence profile is incompatible with this target";
        case "incomplete_profile_coverage": return "Influence profile coverage is incomplete";
        case "evidence_below_d": return "Influence capture unavailable — evidence below D";
        default: return assertNever(result.reason);
      }
    }
    case "withheld": return result.reason === "privacy_threshold"
      ? "Influence capture withheld — privacy threshold" : "Influence capture withheld — sample threshold";
    case "invalidated": return "Influence capture unavailable for this adjusted plan";
    default: return assertNever(result);
  }
}

function assertNever(value: never): never { throw new Error(`Unhandled audience state: ${JSON.stringify(value)}`); }
```

```tsx
// src/features/drawer/AudiencePanel.tsx
import type { DrawerState } from "@/features/drawer/drawerModel";
import { usePlanner } from "@/app/PlannerProvider";
import { selectAudienceView } from "@/app/plannerSelectors";
import { headlineCount, influenceStatusText, reachStatusText } from "@/domain/audience/presenter";

const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);
function ScenarioBand({ low, base, high, unit, ariaLabel }: {
  low: number; base: number; high: number; unit: "people" | "percent"; ariaLabel: string;
}) {
  const span = Math.max(high - low, 1e-9);
  const position = (value: number) => `${5 + 90 * (value - low) / span}%`;
  const format = (value: number) => unit === "people" ? headlineCount(value) : `${Math.round(value)}%`;
  return <figure className="scenario-band" aria-label={ariaLabel}>
    <div className="scenario-track" />
    {[{ id: "low", value: low }, { id: "base", value: base }, { id: "high", value: high }].map(marker =>
      <span key={marker.id} className={`scenario-marker ${marker.id}`} style={{ left: position(marker.value) }}>
        {titleCase(marker.id)} {format(marker.value)}</span>)}
  </figure>;
}

function MarginalList({ rows, onSelect }: {
  rows: readonly { id: string; label: string; value: number; display: string }[];
  onSelect: (id: string) => void;
}) {
  return <ol aria-label="Modelled marginal contribution ranking">{rows.map(row => <li key={row.id}>
    <button onClick={() => onSelect(row.id)}><span>{row.label}</span><strong>{row.display}</strong></button>
  </li>)}</ol>;
}

export function AudiencePanel({ state: drawerState }: {
  state: Extract<DrawerState, { kind: "audience" }>;
}) {
  const { state, dispatch } = usePlanner();
  const model = selectAudienceView(state, drawerState);
  const openTab = (tab: "summary" | "reach" | "influence") => dispatch({ type: "drawer_opened",
    drawer: { kind: "audience", tab }, lens: tab === "summary" ? "rank" : tab });
  return <section aria-labelledby="audience-title"><h2 id="audience-title">Audience estimate</h2>
    <div role="tablist" aria-label="Audience metric">
      {(["summary", "reach", "influence"] as const).map(tab => <button key={tab} role="tab"
        aria-selected={drawerState.tab === tab} onClick={() => openTab(tab)}>{titleCase(tab)}</button>)}
    </div>
    {drawerState.tab === "summary" && <div role="tabpanel">
      <p>{reachStatusText(model.summary.reach)}</p><p>{influenceStatusText(model.summary.influence)}</p>
      <small>{model.summary.basisLabel} • Audience evidence {model.summary.audienceEvidenceGrade ?? "unranked"}</small>
    </div>}
    {drawerState.tab === "reach" && <div role="tabpanel">
      {model.summary.reach.status === "available" ? <>
        <ScenarioBand low={model.summary.reach.series.lower.rawCount}
          base={model.summary.reach.series.point.rawCount} high={model.summary.reach.series.upper.rawCount}
          unit="people" ariaLabel="Low, base and high exact-plan target reach" />
        <dl>{model.reachMethodFacts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        <MarginalList rows={model.reachZoneMarginals} onSelect={zoneId => dispatch({ type: "focus_changed",
          zoneId, faceId: null })} />
      </> : <p>{reachStatusText(model.summary.reach)}</p>}
    </div>}
    {drawerState.tab === "influence" && <div role="tabpanel">
      {model.summary.influence.status === "available" ? <>
        <ScenarioBand low={model.summary.influence.series.lower.capturePct}
          base={model.summary.influence.series.point.capturePct}
          high={model.summary.influence.series.upper.capturePct}
          unit="percent" ariaLabel="Low, base and high Influence Capture" />
        <p>{model.influenceConstruct}</p><p>{model.influenceDenominator}</p>
        <div className="archetype-bars">{Object.entries(model.summary.influence.series.point.archetypes)
          .map(([id, row]) => <button key={id}
          onClick={() => dispatch({ type: "drawer_opened", drawer: { kind: "audience", tab: "influence",
            archetypeId: id } })}><span>{row.label}</span><span style={{ width: `${row.capturePct}%` }} />
          <strong>{Math.round(row.capturePct)}%</strong></button>)}</div>
      </> : <p>{influenceStatusText(model.summary.influence)}</p>}
    </div>}
    <button onClick={() => dispatch({ type: "drawer_opened", drawer: { kind: "evidence",
      evidenceId: model.evidenceId, backStack: [drawerState] } })}>View source</button>
    <p className="limitation">{model.limitation}</p>
  </section>;
}
```

`ScenarioBand` uses one horizontal axis with low/base/high markers from the same coherent scenario members; `MarginalList` is the numerical twin of the map symbols. Neither component sums marginals or presents them as geographic coverage.

Absent/withheld/invalidated values never fall back to zero. `formatRange` uses two significant digits/nearest thousand for headlines while evidence tables retain raw paired values.

- [ ] **Step 6: Verify interaction and accessibility contracts**

Run: `npm test -- tests/component/plannerMap.test.tsx tests/component/audienceDrawer.test.tsx tests/component/evidencePath.test.tsx`

Expected: direct metric entry, five-interaction paths, Escape/Back, focus restoration, map/list synchronization and degraded-state tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/map src/features/drawer src/app/plannerSelectors.ts tests/component/plannerMap.test.tsx tests/component/audienceDrawer.test.tsx tests/component/evidencePath.test.tsx
git commit -m "feat: add navigable map and audience evidence drawer"
```

## Task 8: Add visible adjustments and `What changed?`

**Files:**
- Create: `src/features/adjustments/BudgetControl.tsx`
- Create: `src/features/adjustments/AdjustmentPanel.tsx`
- Create: `src/features/adjustments/WhatChangedPanel.tsx`
- Modify: `src/features/drawer/PlannerDrawer.tsx`
- Modify: `src/app/plannerReducer.ts`
- Test: `tests/component/adjustments.test.tsx`

- [ ] **Step 1: Write failing adjustment-flow tests**

```tsx
it("shows the reach-versus-influence trade-off and can undo", async () => {
  renderLoadedWizard();
  await userEvent.click(screen.getByRole("button", { name: "Adjust sites" }));
  await userEvent.click(screen.getByRole("button", { name: /Replace Yaba\/Akoka with Lekki/ }));
  expect(screen.getByText(/Target reach.*240k–290k.*270k–320k/)).toBeTruthy();
  expect(screen.getByText(/Influence capture.*63%.*56%/)).toBeTruthy();
  expect(screen.getByText(/Broader modelled reach; lower merchant-peer-adviser coverage/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Undo last change" }));
  expect(screen.queryByText("Draft changed")).toBeNull();
});

it("warns before applying a plan with invalidated audience evidence", async () => {
  renderDraftWithUnsupportedUploadedFace();
  await userEvent.click(screen.getByRole("button", { name: "Apply draft" }));
  expect(screen.getByText(/Audience estimate will become unavailable/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm and apply" })).toBeTruthy();
});
```

Run: `npm test -- tests/component/adjustments.test.tsx`

Expected: FAIL because adjustment UI is absent.

- [ ] **Step 2: Implement the only supported MVP adjustments**

Expose budget change, recommended-zone exclusion, alternative-zone replacement, site swap/remove and reset through one action dispatcher:

```tsx
// src/features/adjustments/AdjustmentPanel.tsx
interface AdjustmentPanelProps {
  recommendation: Recommendation;
  faceLookup: Readonly<Record<string, InventoryFace>>;
  zoneNames: Readonly<Record<string, string>>;
  alternatives: { zones: readonly string[]; faces: readonly InventoryFace[] };
  dispatchAction: (action: DraftAction) => Promise<void>;
  reset: () => Promise<void>;
}

export function AdjustmentPanel({ recommendation, faceLookup, zoneNames, alternatives,
  dispatchAction, reset }: AdjustmentPanelProps) {
  const zoneCounts = recommendation.package.faceIds.reduce<Record<string, number>>((counts, faceId) => {
    const zoneId = faceLookup[faceId].zoneId;
    counts[zoneId] = (counts[zoneId] ?? 0) + 1;
    return counts;
  }, {});
  return <section aria-labelledby="adjust-sites-title">
    <h2 id="adjust-sites-title">Adjust sites</h2>
    <BudgetControl value={recommendation.brief.budgetNgn}
      onCommit={budgetNgn => dispatchAction({ type: "set_budget", budgetNgn })} />
    {recommendation.package.zoneIds.map(zoneId => <div key={zoneId}>
      <strong>{zoneNames[zoneId]}</strong>
      <button onClick={() => dispatchAction({ type: "exclude_zone", zoneId })}>Exclude zone</button>
      {alternatives.zones.map(addZoneId => <button key={addZoneId}
        onClick={() => dispatchAction({ type: "replace_zone", removeZoneId: zoneId, addZoneId })}>
        Replace {zoneNames[zoneId]} with {zoneNames[addZoneId]}
      </button>)}
    </div>)}
    {recommendation.package.faceIds.map(faceId => <div key={faceId}>
      <span>{faceLookup[faceId].address}</span>
      <button disabled={(zoneCounts[faceLookup[faceId].zoneId] ?? 0) === 1}
        onClick={() => dispatchAction({ type: "remove_face", faceId })}>Remove site</button>
      {alternatives.faces.filter(face => face.zoneId === faceLookup[faceId].zoneId)
        .map(face => <button key={face.id} onClick={() => dispatchAction({ type: "swap_face",
          removeFaceId: faceId, addFaceId: face.id })}>Swap for {face.address}</button>)}
    </div>)}
    <button onClick={reset}>Reset to original</button>
  </section>;
}
```

```tsx
// src/features/adjustments/BudgetControl.tsx
import { useEffect, useState } from "react";

export function BudgetControl({ value, onCommit }: { value: number; onCommit: (value: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== value) void onCommit(parsed);
  };
  return <label>Working budget (NGN)<input aria-label="Working budget" inputMode="numeric"
    value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} /></label>;
}
```

`faceLookup`, `zoneNames` and `alternatives` come from `plannerSelectors`, never from component-side scoring. `BudgetControl` keeps a local numeric draft and calls `onCommit` on blur or Enter only when finite and positive. Each interaction awaits `plannerService.recalculateDraft`, sets `data-changed="true"` on affected GeoJSON features for 180 ms, and replaces recommendation sentence, cost, package, audience signal and RFQ preview from the returned session.

- [ ] **Step 3: Render comparable deltas without false precision**

`WhatChangedPanel` has active→draft and original→draft sections. Render only comparison objects already calculated by the domain:

```tsx
// src/features/adjustments/WhatChangedPanel.tsx
const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
const formatSignedNgn = (value: number) => `${value >= 0 ? "+" : "−"}₦${Math.abs(value).toLocaleString("en-NG")}`;
const formatSignedRoundedPeople = (value: number) => `${value >= 0 ? "+" : "−"}${Math.round(Math.abs(value) / 1_000)}k people`;
const audienceDeltaText = (delta: AudienceDelta, unit: "people" | "points") => {
  if (delta.status === "withheld") return "Change withheld — privacy threshold";
  if (delta.status === "invalidated") return "Audience estimate unavailable for this adjusted plan";
  if (delta.status === "not_comparable") return "Not comparable — basis changed";
  return unit === "people" ? `${formatSignedRoundedPeople(delta.basePointDelta)}`
    : `${delta.basePointDelta >= 0 ? "+" : ""}${Math.round(delta.basePointDelta)} pp`;
};

export function WhatChangedPanel({ changed }: { changed: WhatChanged }) {
  const section = (title: string, delta: RecommendationDelta) => <section>
    <h3>{title}</h3>
    <dl>
      <div><dt>Cost</dt><dd>{formatSignedNgn(delta.costNgn)}</dd></div>
      <div><dt>Planning Fit</dt><dd>{formatSigned(delta.planningFit)}</dd></div>
      <div><dt>Target reach</dt><dd>{audienceDeltaText(delta.reach, "people")}</dd></div>
      <div><dt>Influence capture</dt><dd>{audienceDeltaText(delta.influence, "points")}</dd></div>
    </dl>
  </section>;
  return <aside aria-label="What changed"><h2>What changed?</h2>
    <p>{changed.cause}</p><p>{changed.tradeOff}</p>
    {section("Current active → draft", changed.activeToDraft)}
    {section("Original → draft", changed.originalToDraft)}
  </aside>;
}
```

Show full reach/influence ranges side-by-side elsewhere in the panel only when comparability keys match. Display integer percentage-point change from the base scenario only; never subtract low from high.

- [ ] **Step 4: Implement Undo, Apply, Reset and Apply & review RFQ**

Wire the controls to the service so the session is replaced only after each operation resolves:

```tsx
const undo = async () => dispatch({ type: "session_changed",
  session: await operations.undoDraft(state.session!) });
const apply = async (openRfq: boolean, acknowledgeAudienceLoss = false) => dispatch({
  type: "session_changed",
  session: await operations.applyDraft(state.session!, { openRfq, acknowledgeAudienceLoss })
});
const reset = async () => dispatch({ type: "session_changed",
  session: await operations.resetPlan(state.session!) });

<button type="button" onClick={undo}>Undo last change</button>
<button type="button" onClick={() => apply(false)}>Apply draft</button>
<button type="button" onClick={reset}>Reset to original</button>
<button type="button" onClick={() => apply(true)}>Apply &amp; review RFQ</button>
```

Catch application errors at the provider boundary and retain the existing dirty session. When the audience is invalidated, render the exact warning plus a separate `Confirm and apply` action that calls `apply(..., true)`.

- [ ] **Step 5: Verify all adjustment states**

Run: `npm test -- tests/unit/adjustments.test.ts tests/component/adjustments.test.tsx`

Expected: budget/zone/site, invalid removal, comparable/non-comparable/withheld deltas, audience-loss acknowledgment and apply/reset tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/adjustments src/features/drawer/PlannerDrawer.tsx src/app/plannerReducer.ts tests/component/adjustments.test.tsx
git commit -m "feat: add reversible campaign adjustments"
```

## Task 9: Add live XLSX/CSV upload with preview, mapping and quarantine

**Files:**
- Create: `src/adapters/workbook/readSpreadsheet.ts`
- Create: `src/adapters/workbook/mapHeaders.ts`
- Create: `src/adapters/workbook/validateImport.ts`
- Create: `src/adapters/geocoding/demoAddressLookup.ts`
- Create: `src/domain/geometry.ts`
- Create: `src/features/upload/UploadDialog.tsx`
- Create: `src/features/upload/UploadPreview.tsx`
- Create: `public/upload-templates/service-locations.csv`
- Create: `public/upload-templates/inventory.csv`
- Create: `tests/fixtures/service-locations.csv`
- Create: `tests/fixtures/service-locations-fmcg.csv`
- Create: `tests/fixtures/service-locations-real-estate.csv`
- Test: `tests/unit/imports.test.ts`
- Test: `tests/component/uploadPreview.test.tsx`

- [ ] **Step 1: Write failing CSV/XLSX preview tests**

```ts
import ExcelJS from "exceljs";
import { expect, it } from "vitest";
import { inspectWorkbook, previewSpreadsheet } from "@/adapters/workbook/readSpreadsheet";

async function buildMultiSheetWorkbookFile() {
  const workbook = new ExcelJS.Workbook();
  const headers = ["face_id", "owner", "latitude", "longitude", "format", "media_class", "rate",
    "currency", "gross_net", "rate_basis", "available_from", "available_to", "source_dataset", "rate_as_of"];
  workbook.addWorksheet("Inventory").addRow(headers);
  workbook.addWorksheet("Archive").addRow(headers);
  const bytes = await workbook.xlsx.writeBuffer();
  return new File([bytes], "inventory.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

it("maps and quarantines service-location rows", async () => {
  const file = new File([
    "location_id,type,latitude,longitude,status,weight,service_radius_m,source_dataset\n" +
    "svc-1,branch,6.5244,3.3792,active,1,2000,client-service-v1\n" +
    "svc-2,atm,invalid,3.3515,active,1,2000,client-service-v1"
  ], "service.csv", { type: "text/csv" });
  const preview = await previewSpreadsheet(file, "service_locations");
  if (preview.status !== "ready") throw new Error(`Expected ready, received ${preview.status}`);
  expect(preview.accepted).toHaveLength(1);
  expect(preview.quarantined).toEqual([
    expect.objectContaining({ sourceRow: 3, errors: [expect.stringContaining("latitude")] })
  ]);
});

it("requires selection when an XLSX has multiple plausible sheets", async () => {
  const file = await buildMultiSheetWorkbookFile();
  const preview = await inspectWorkbook(file, "inventory");
  expect(preview.status).toBe("sheet_selection_required");
  if (preview.status !== "sheet_selection_required") throw new Error("Expected sheet selection");
  expect(preview.sheetCandidates.map(sheet => sheet.name)).toEqual(["Inventory", "Archive"]);
});
```

Run: `npm test -- tests/unit/imports.test.ts`

Expected: FAIL because workbook adapters do not exist.

- [ ] **Step 2: Parse files entirely in-browser**

```ts
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { DEMO_LIMITS } from "@/domain/ruleset";
import type { ImportPreview, ImportType } from "@/application/contracts";
import { mapHeaders, REQUIRED, scoreSheetHeaders } from "@/adapters/workbook/mapHeaders";
import { validateImport } from "@/adapters/workbook/validateImport";

export interface WorkbookSheet { name: string; rows: readonly (readonly unknown[])[] }
export type WorkbookInspection =
  | { status: "ready"; selectedSheet: WorkbookSheet }
  | { status: "sheet_selection_required"; sheetCandidates: readonly WorkbookSheet[] };
export class ImportFileError extends Error { constructor(public readonly reasons: readonly string[]) { super(reasons.join("; ")); } }

function inspectionFromSheets(sheets: readonly WorkbookSheet[], type: ImportType,
  selectedSheetName?: string): WorkbookInspection {
  if (selectedSheetName) {
    const selectedSheet = sheets.find(sheet => sheet.name === selectedSheetName);
    if (!selectedSheet) throw new ImportFileError([`Sheet not found: ${selectedSheetName}`]);
    return { status: "ready", selectedSheet };
  }
  if (sheets.length === 1) return { status: "ready", selectedSheet: sheets[0] };
  const plausible = sheets.filter(sheet => scoreSheetHeaders(
    (sheet.rows[0] ?? []).map(value => String(value ?? "")), type
  ) >= 3);
  if (plausible.length === 1) return { status: "ready", selectedSheet: plausible[0] };
  if (plausible.length > 1) return { status: "sheet_selection_required", sheetCandidates: plausible };
  throw new ImportFileError(["No sheet matches the selected template"]);
}

async function checksumFile(file: File) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function inspectWorkbook(file: File, type: ImportType,
  selectedSheetName?: string): Promise<WorkbookInspection> {
  if (file.size > DEMO_LIMITS.maximumUploadBytes) throw new ImportFileError(["File exceeds the 5 MB demo limit"]);
  if (file.name.toLowerCase().endsWith(".csv")) {
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    if (parsed.errors.length) throw new ImportFileError(parsed.errors.map(error => error.message));
    return inspectionFromSheets([{ name: "CSV", rows: parsed.data }], type, selectedSheetName);
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new ImportFileError(["Use .xlsx or .csv"]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()));
  const sheets = workbook.worksheets.map(sheet => ({
    name: sheet.name,
    rows: sheet.getSheetValues().slice(1).map(row => Array.isArray(row) ? row.slice(1) : [])
  }));
  if (sheets.some(sheet => sheet.rows.flat().some(value =>
    typeof value === "object" && value !== null && "formula" in value))) {
    throw new ImportFileError(["Formula cells are not supported; paste values before upload"]);
  }
  return inspectionFromSheets(sheets, type, selectedSheetName);
}

export async function previewSpreadsheet(file: File, type: ImportType, options?: {
  selectedSheet?: string; confirmedHeaders?: Readonly<Record<string, string>>;
}): Promise<ImportPreview> {
  const inspection = await inspectWorkbook(file, type, options?.selectedSheet);
  const checksum = await checksumFile(file);
  if (inspection.status !== "ready") return { type, checksum, status: "sheet_selection_required",
    sheetCandidates: inspection.sheetCandidates, accepted: [], quarantined: [], required: [...REQUIRED[type]],
    invalid: [], previewRows: [], mapped: {}, ignored: [], mappingCandidates: [] };
  const [headers, ...rows] = inspection.selectedSheet.rows;
  const mapping = mapHeaders(headers.map(value => String(value ?? "")), type, options?.confirmedHeaders);
  return validateImport({ type, fileName: file.name, checksum,
    sheetName: inspection.selectedSheet.name, mapping, rows });
}
```

Reject `.xls`, `.xlsm`, macro/formula evaluation and files above the versioned demo size limit. Do not upload bytes to a server.

- [ ] **Step 3: Implement deterministic header mapping**

Normalize case, punctuation and spaces; use explicit alias catalogs per template. Exact canonical header = 1.0, explicit alias = 0.9, deterministic Jaccard token similarity = recorded score, no match = 0:

```ts
// src/adapters/workbook/mapHeaders.ts
import type { ImportType } from "@/application/contracts";

export const REQUIRED = {
  service_locations: ["location_id", "type", "status", "weight", "source_dataset"],
  inventory: ["face_id", "owner", "format", "media_class", "rate", "currency", "gross_net",
    "rate_basis", "available_from", "available_to", "source_dataset", "rate_as_of"]
} as const;
const HEADERS = {
  service_locations: [...REQUIRED.service_locations, "latitude", "longitude", "address", "service_radius_m"],
  inventory: [...REQUIRED.inventory, "latitude", "longitude", "address", "permit_state", "photo_url"]
} as const;
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  location_id: ["location id", "branch id", "outlet id", "atm id"],
  face_id: ["face id", "panel id", "site id"],
  latitude: ["lat"], longitude: ["lon", "lng", "long"],
  source_dataset: ["source", "dataset", "source file"],
  service_radius_m: ["service radius m", "radius metres", "radius meters"],
  gross_net: ["gross net", "price type"], rate_as_of: ["rate as of", "price date"]
};
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const similarity = (left: string, right: string) => {
  const a = new Set(normalize(left).split(" ").filter(Boolean));
  const b = new Set(normalize(right).split(" ").filter(Boolean));
  const intersection = [...a].filter(token => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
};

export function mapHeaders(headers: readonly string[], type: ImportType,
  confirmedHeaders: Readonly<Record<string, string>> = {}) {
  const candidates = headers.flatMap((header, sourceIndex) => HEADERS[type].map(canonical => {
    const normalized = normalize(header);
    const canonicalNormalized = normalize(canonical);
    const alias = (ALIASES[canonical] ?? []).map(normalize).includes(normalized);
    const confidence = normalized === canonicalNormalized ? 1 : alias ? .9 : similarity(header, canonical);
    return { header, sourceIndex, canonical, confidence };
  })).sort((a, b) => b.confidence - a.confidence || a.sourceIndex - b.sourceIndex);
  const used = new Set<number>();
  const mapped = HEADERS[type].map(canonical => {
    const confirmedHeader = confirmedHeaders[canonical];
    const match = candidates.find(candidate => candidate.canonical === canonical
      && (!confirmedHeader || candidate.header === confirmedHeader) && !used.has(candidate.sourceIndex));
    if (!match || match.confidence === 0) return { canonical, status: "missing" as const, confidence: 0 };
    used.add(match.sourceIndex);
    return { ...match, confidence: confirmedHeader ? 1 : match.confidence,
      status: confirmedHeader || match.confidence >= .8 ? "mapped" as const : "confirmation_required" as const };
  });
  const found = new Set(mapped.filter(item => item.status !== "missing").map(item => item.canonical));
  const requiredMissing: string[] = REQUIRED[type].filter(canonical => !found.has(canonical));
  if (!(found.has("address") || (found.has("latitude") && found.has("longitude")))) {
    requiredMissing.push("latitude+longitude or address");
  }
  return { mapped, requiredMissing,
    confirmationRequired: mapped.filter(item => item.status === "confirmation_required").map(item => item.canonical),
    ignored: headers.filter((_, index) => !used.has(index)) };
}

export function scoreSheetHeaders(headers: readonly string[], type: ImportType): number {
  const result = mapHeaders(headers, type);
  return result.mapped.filter(item => item.status === "mapped").length - result.requiredMissing.length * 2;
}
```

A mapping below 0.8 is `confirmation_required`; it cannot be accepted silently. Preserve ignored headers and original source-row numbers.

Service required fields: ID, type, coordinates or exact seeded address, status, weight, source dataset. Eligibility mode additionally requires supplied `service_radius_m` or polygon; the fixture uses 2,000 m and labels it a user-provided planning assumption.

Inventory required fields: face ID, owner, coordinates or exact seeded address, format, static/DOOH class, rate/currency/gross-net/rate basis, availability window, source dataset and `rate_as_of`. Missing permit/photo becomes explicit conditional/unknown.

- [ ] **Step 4: Validate, preview and quarantine**

Return `required`, `mapped`, `ignored`, `invalid`, `accepted`, `quarantined` and first-ten-row preview. The validator uses strict parsing and source row `index + 2`:

```ts
// src/adapters/workbook/validateImport.ts
import { z } from "zod";
import type { ImportPreview, ImportType } from "@/application/contracts";
import { demoAddressLookup } from "@/adapters/geocoding/demoAddressLookup";
import { REQUIRED, mapHeaders } from "@/adapters/workbook/mapHeaders";

const OptionalNumber = z.preprocess(value => value === "" || value === null || value === undefined
  ? undefined : value, z.coerce.number().optional());
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ServiceRow = z.object({
  location_id: z.string().min(1), type: z.enum(["branch", "atm", "agent", "merchant", "outlet", "project"]),
  latitude: OptionalNumber.pipe(z.number().gte(-90).lte(90).optional()),
  longitude: OptionalNumber.pipe(z.number().gte(-180).lte(180).optional()), address: z.string().optional(),
  status: z.enum(["active", "inactive"]), weight: z.coerce.number().positive(),
  service_radius_m: z.coerce.number().positive().optional(), source_dataset: z.string().min(1)
}).strict().refine(row => Boolean(row.address) || (row.latitude !== undefined && row.longitude !== undefined),
  { message: "latitude+longitude or address is required", path: ["latitude"] });

const InventoryImportRow = z.object({
  face_id: z.string().min(1), owner: z.string().min(1),
  latitude: OptionalNumber.pipe(z.number().gte(-90).lte(90).optional()),
  longitude: OptionalNumber.pipe(z.number().gte(-180).lte(180).optional()), address: z.string().optional(),
  format: z.enum(["static_billboard", "dooh_screen", "street_panel"]),
  media_class: z.enum(["static", "dooh"]), rate: z.coerce.number().positive(), currency: z.literal("NGN"),
  gross_net: z.enum(["gross", "net", "unknown"]), rate_basis: z.literal("four_weeks"),
  available_from: IsoDate, available_to: IsoDate, source_dataset: z.string().min(1), rate_as_of: IsoDate,
  permit_state: z.enum(["verified", "pending", "unknown", "rejected"]).optional(),
  photo_url: z.string().url().optional()
}).strict().refine(row => Boolean(row.address) || (row.latitude !== undefined && row.longitude !== undefined),
  { message: "latitude+longitude or address is required", path: ["latitude"] })
  .refine(row => row.available_from <= row.available_to,
    { message: "available_to must be on or after available_from", path: ["available_to"] });

type HeaderMapping = ReturnType<typeof mapHeaders>;
export interface ValidateImportInput {
  type: ImportType;
  fileName: string;
  checksum: string;
  sheetName: string;
  mapping: HeaderMapping;
  rows: readonly (readonly unknown[])[];
}

export function validateImport(input: ValidateImportInput): ImportPreview {
  const required = REQUIRED[input.type];
  const confirmed = input.mapping.mapped.filter(item => item.status === "mapped" && "sourceIndex" in item);
  const invalid = [...input.mapping.requiredMissing, ...input.mapping.confirmationRequired];
  const mapped = Object.fromEntries(confirmed.map(item => [item.canonical, item.header]));
  if (invalid.length) return { type: input.type, checksum: input.checksum,
    status: "mapping_confirmation_required", accepted: [], quarantined: [], required: [...required],
    invalid, previewRows: input.rows.slice(0, 10), mapped, ignored: input.mapping.ignored,
    mappingCandidates: input.mapping.mapped.filter(item => item.status === "confirmation_required" && "header" in item)
      .map(item => ({ canonical: item.canonical, header: item.header, confidence: item.confidence })),
    selectedSheet: input.sheetName };
  const accepted: Record<string, unknown>[] = [];
  const quarantined: { sourceRow: number; errors: string[]; values: readonly unknown[] }[] = [];
  input.rows.forEach((values, index) => {
    const record = Object.fromEntries(confirmed.map(item => [item.canonical, values[item.sourceIndex]]));
    const parsed = input.type === "service_locations" ? ServiceRow.safeParse(record) : InventoryImportRow.safeParse(record);
    if (parsed.success) {
      const value = parsed.data;
      if (value.latitude === undefined && value.address) {
        const coordinates = demoAddressLookup[value.address.trim().toLowerCase()];
        if (!coordinates) {
          quarantined.push({ sourceRow: index + 2, errors: ["address: no exact demo match; coordinates required"], values });
          return;
        }
        accepted.push({ ...value, longitude: coordinates[0], latitude: coordinates[1] });
      } else accepted.push(value);
    } else quarantined.push({ sourceRow: index + 2,
      errors: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`), values });
  });
  return { type: input.type, checksum: input.checksum, status: "ready", accepted, quarantined,
    required: [...required], invalid: [], previewRows: input.rows.slice(0, 10), mapped,
    ignored: input.mapping.ignored, mappingCandidates: [], selectedSheet: input.sheetName };
}
```

```ts
// src/adapters/geocoding/demoAddressLookup.ts
export const demoAddressLookup: Readonly<Record<string, readonly [number, number]>> = {
  "yaba demo service centre": [3.3900, 6.5150],
  "ikeja demo branch": [3.3500, 6.6010],
  "vi demo project office": [3.4300, 6.4550]
};
```

Never silently drop or coerce beyond explicit Zod numeric coercion reported in preview. An arbitrary address is quarantined, not geocoded.

- [ ] **Step 5: Confirm as a reversible dataset revision**

The upload UI asks purpose/rights/privacy classification, import type and `Context only | Eligibility constraint`. Use a three-state dialog (`choose → preview → confirm`) and disable confirmation until rights/purpose are present, all low-confidence mappings are confirmed and at least one row is accepted:

```tsx
// src/features/upload/UploadPreview.tsx
import type { ImportConfirmation, ImportPreview } from "@/application/contracts";

export type GovernanceState = ImportConfirmation;
interface UploadPreviewProps {
  preview: ImportPreview;
  governance: GovernanceState;
  onGovernance: (value: GovernanceState) => void;
  onConfirm: () => void;
  onConfirmMappings: () => void;
}

export function UploadPreview({ preview, governance, onGovernance, onConfirm, onConfirmMappings }: UploadPreviewProps) {
  const geometryReady = governance.decisionUse !== "eligibility_constraint"
    || preview.type !== "service_locations"
    || preview.accepted.every(row => typeof row.service_radius_m === "number" && row.service_radius_m > 0);
  const canConfirm = preview.status === "ready" && preview.accepted.length > 0
    && governance.purpose.trim().length > 0 && governance.rightsConfirmed && geometryReady;
  return <section aria-labelledby="upload-preview-title"><h2 id="upload-preview-title">Upload preview</h2>
    <p>{preview.accepted.length} accepted · {preview.quarantined.length} quarantined · {preview.ignored.length} ignored columns</p>
    {preview.status === "mapping_confirmation_required" && <div role="alert">
      <p>Review required: {preview.invalid.join(", ")}</p>
      {preview.mappingCandidates.map(item => <p key={item.canonical}>
        {item.header} → {item.canonical} ({Math.round(item.confidence * 100)}%)</p>)}
      {!!preview.mappingCandidates.length && <button onClick={onConfirmMappings}>Confirm suggested mappings</button>}
    </div>}
    <label>Purpose<input value={governance.purpose}
      onChange={event => onGovernance({ ...governance, purpose: event.target.value })} /></label>
    <label><input type="checkbox" checked={governance.rightsConfirmed}
      onChange={event => onGovernance({ ...governance, rightsConfirmed: event.target.checked })} />
      I confirm the right to use this data for campaign planning</label>
    <label>Privacy classification<select value={governance.privacyClass}
      onChange={event => onGovernance({ ...governance,
        privacyClass: event.target.value as GovernanceState["privacyClass"] })}>
      <option value="non_personal_business">Non-personal business data</option>
      <option value="aggregate_location">Aggregate location data</option>
    </select></label>
    <label>Decision use<select value={governance.decisionUse}
      onChange={event => onGovernance({ ...governance, decisionUse: event.target.value as GovernanceState["decisionUse"] })}>
      <option value="context_only">Context only</option><option value="eligibility_constraint">Eligibility constraint</option>
    </select></label>
    {!geometryReady && <p role="alert">Eligibility constraint requires a supplied service_radius_m for every accepted row.</p>}
    <button disabled={!canConfirm} onClick={onConfirm}>Confirm upload</button>
  </section>;
}
```

```tsx
// src/features/upload/UploadDialog.tsx
import { useState } from "react";
import type { ImportPreview, ImportType, PlanSession, PlannerOperations } from "@/application/contracts";
import { UploadPreview, type GovernanceState } from "@/features/upload/UploadPreview";

interface UploadDialogProps {
  operations: PlannerOperations;
  session: PlanSession;
  onConfirmed: (session: PlanSession) => void;
  onClose: () => void;
}

export function UploadDialog({ operations, session, onConfirmed, onClose }: UploadDialogProps) {
  const [type, setType] = useState<ImportType>("service_locations");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [governance, setGovernance] = useState<GovernanceState>({ purpose: "",
    rightsConfirmed: false, privacyClass: "non_personal_business", decisionUse: "context_only" });
  const inspect = async (nextFile: File, options?: {
    selectedSheet?: string; confirmedHeaders?: Readonly<Record<string, string>>;
  }) => {
    setFile(nextFile);
    const result = await operations.previewImport(nextFile, type, options);
    setPreview(result);
  };
  const confirm = async () => {
    if (!preview) return;
    onConfirmed(await operations.confirmImport(session, preview, governance));
    onClose();
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="upload-title">
    <h2 id="upload-title">Upload spreadsheet</h2>
    <label>Template<select value={type} onChange={event => {
      setType(event.target.value as ImportType); setPreview(null); setFile(null);
    }}>
      <option value="service_locations">Service/distribution locations</option>
      <option value="inventory">Inventory</option>
    </select></label>
    <input aria-label="Spreadsheet file" type="file" accept=".xlsx,.csv"
      onChange={event => { const file = event.target.files?.[0]; if (file) void inspect(file); }} />
    {preview?.status === "sheet_selection_required" && <div><p>Select a sheet</p>
      {preview.sheetCandidates.map(sheet => <button key={sheet.name}
        onClick={() => { if (file) void inspect(file, { selectedSheet: sheet.name }); }}>{sheet.name}</button>)}</div>}
    {preview && preview.status !== "sheet_selection_required" && <UploadPreview preview={preview} governance={governance}
      onGovernance={setGovernance} onConfirm={() => void confirm()}
      onConfirmMappings={() => { if (file) void inspect(file, { selectedSheet: preview.selectedSheet,
        confirmedHeaders: Object.fromEntries(preview.mappingCandidates.map(item => [item.canonical, item.header])) }); }} />}
    <button onClick={onClose}>Close</button>
  </div>;
}
```

```ts
// src/domain/geometry.ts
import type { ImportConfirmation, ImportPreview } from "@/application/contracts";

export function disclosedCircle(longitude: number, latitude: number, radiusMetres: number): GeoJSON.Polygon {
  if (!Number.isFinite(radiusMetres) || radiusMetres <= 0) throw new Error("A positive supplied radius is required");
  const earthRadius = 6_371_008.8;
  const angular = radiusMetres / earthRadius;
  const latitudeRadians = latitude * Math.PI / 180;
  const points = Array.from({ length: 65 }, (_, index) => {
    const bearing = 2 * Math.PI * index / 64;
    const lat = Math.asin(Math.sin(latitudeRadians) * Math.cos(angular)
      + Math.cos(latitudeRadians) * Math.sin(angular) * Math.cos(bearing));
    const lon = longitude * Math.PI / 180 + Math.atan2(Math.sin(bearing) * Math.sin(angular)
      * Math.cos(latitudeRadians), Math.cos(angular) - Math.sin(latitudeRadians) * Math.sin(lat));
    return [lon * 180 / Math.PI, lat * 180 / Math.PI];
  });
  return { type: "Polygon", coordinates: [points] };
}

export function pointInPolygon(point: readonly [number, number], polygon: GeoJSON.Polygon): boolean {
  const ring = polygon.coordinates[0];
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const crosses = (yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function assertImportConfirmation(preview: ImportPreview, confirmation: ImportConfirmation) {
  if (preview.status !== "ready" || !preview.accepted.length) throw new Error("A ready preview with accepted rows is required");
  if (!confirmation.rightsConfirmed || !confirmation.purpose.trim()) throw new Error("Purpose and data rights confirmation are required");
  if (preview.type === "service_locations" && confirmation.decisionUse === "eligibility_constraint"
    && preview.accepted.some(row => typeof row.service_radius_m !== "number" || row.service_radius_m <= 0)) {
    throw new Error("Eligibility constraint requires a supplied service radius");
  }
}
```

`plannerService.confirmImport` calls `assertImportConfirmation` before mutation, then sets `dataRevision = import-${preview.checksum.slice(0, 12)}`, re-runs cohort stabilization and returns a dirty draft whose first history action is an `import_revision` system record. For service eligibility, create one `disclosedCircle(...)` per accepted row and retain a face only when `pointInPolygon([face.longitude, face.latitude], circle)` is true for at least one supplied circle. The map shows those exact polygons; `What changed?` names the revision, accepted/quarantined counts, supplied radius/rule and affected gates. Context-only rows appear on the map but do not change eligibility or scores.

An uploaded inventory face without synthetic audience coverage may be selected, but its draft audience state becomes invalidated/unavailable and requires the Task 8 acknowledgment before Apply.

- [ ] **Step 6: Verify both upload templates**

Use these exact UTF-8 template fixtures:

`public/upload-templates/service-locations.csv` and `tests/fixtures/service-locations.csv`:

```csv
location_id,type,latitude,longitude,status,weight,service_radius_m,source_dataset
svc-ikeja,branch,6.6010,3.3500,active,1,2000,client-service-demo-v1
svc-lekki,agent,6.4470,3.5000,active,1,2000,client-service-demo-v1
svc-surulere,merchant,6.5000,3.3500,active,1,2000,client-service-demo-v1
```

`public/upload-templates/inventory.csv`:

```csv
face_id,owner,latitude,longitude,format,media_class,rate,currency,gross_net,rate_basis,available_from,available_to,source_dataset,rate_as_of,permit_state,photo_url
client-face-001,Client Supplier,6.5150,3.3900,static_billboard,static,3500000,NGN,gross,four_weeks,2026-09-01,2026-09-28,client-inventory-demo-v1,2026-08-01,unknown,
```

`tests/fixtures/service-locations-fmcg.csv`:

```csv
location_id,type,latitude,longitude,status,weight,service_radius_m,source_dataset
svc-lekki,agent,6.4470,3.5000,active,1,2000,client-service-fmcg-v1
svc-surulere,merchant,6.5000,3.3500,active,1,2000,client-service-fmcg-v1
svc-vi,outlet,6.4550,3.4300,active,1,2000,client-service-fmcg-v1
```

`tests/fixtures/service-locations-real-estate.csv`:

```csv
location_id,type,latitude,longitude,status,weight,service_radius_m,source_dataset
svc-surulere,project,6.5000,3.3500,active,1,2000,client-service-property-v1
svc-yaba,project,6.5150,3.3900,active,1,2000,client-service-property-v1
svc-lekki,project,6.4470,3.5000,active,1,2000,client-service-property-v1
```

The nine audience snapshot tests use the default Bank upload plus these two sector-specific fixtures, so every named `upload` golden is tied to an exact reproducible input.

Run: `npm test -- tests/unit/imports.test.ts tests/component/uploadPreview.test.tsx`

Expected: CSV/XLSX, multi-sheet selection, low-confidence confirmation, accepted/ignored/quarantined rows, supplied radius, inventory conditional fields and post-confirmation draft tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/adapters/workbook src/domain/geometry.ts src/features/upload public/upload-templates tests/unit/imports.test.ts tests/component/uploadPreview.test.tsx
git commit -m "feat: add governed spreadsheet uploads"
```

## Task 10: Generate reviewable supplier-verification RFQs and downloads

**Files:**
- Create: `src/domain/rfq.ts`
- Create: `src/features/rfq/RfqReviewPanel.tsx`
- Create: `src/adapters/downloads/downloadRfq.ts`
- Test: `tests/unit/rfq.test.ts`
- Test: `tests/component/rfqReview.test.tsx`

- [ ] **Step 1: Write failing RFQ isolation and claims tests**

```ts
it("groups lines by supplier and excludes private values by default", () => {
  const generateRfq = createRfqGenerator(demoFaceLookup);
  const generated = generateRfq(appliedDemoSession, validReviewFields());
  expect(generated.supplierMessages).toHaveLength(3);
  for (const message of generated.supplierMessages) {
    expect(message.body).toContain("DEMO — DO NOT SEND");
    expect(message.body).not.toMatch(/influence capture|other supplier|internal budget/i);
    expect(message.faceIds.every(id => selectedFacesForOwner(message.ownerId).includes(id))).toBe(true);
  }
  expect(generated.internalRequest.audiencePlanningBasis).toBeTruthy();
});

it("blocks generation from an unapplied dirty draft", () => {
  const generateRfq = createRfqGenerator(demoFaceLookup);
  expect(() => generateRfq(sessionWithDirtyDraft, validReviewFields())).toThrow(/Apply draft/);
});
```

Run: `npm test -- tests/unit/rfq.test.ts tests/component/rfqReview.test.tsx`

Expected: FAIL because RFQ generator/review do not exist.

- [ ] **Step 2: Implement the RFQ domain contract**

Validate buyer contact, response deadline and confirmed dates, then group only active faces by owner:

```ts
// src/domain/rfq.ts
import { z } from "zod";
import type { GeneratedRfq, PlanSession, RfqReviewInput } from "@/application/contracts";
import type { InventoryFace } from "@/domain/model";

const ReviewSchema = z.object({ buyerName: z.string().min(2), buyerEmail: z.string().email(),
  responseDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  datesConfirmed: z.literal(true), supplierNotes: z.string().max(2_000) }).refine(value => value.startDate <= value.endDate,
    { message: "End date must be on or after start date", path: ["endDate"] });

const money = (value: number) => `NGN ${Math.round(value).toLocaleString("en-NG")}`;
const forbidden = /\b(booked|reserved|sent|guaranteed reach|perception|persuasion|market share|sales uplift)\b/i;

export function createRfqGenerator(faceLookup: Readonly<Record<string, InventoryFace>>) {
  return (session: PlanSession, rawReview: RfqReviewInput): GeneratedRfq => {
    if (session.draft) throw new Error("Apply draft before generating the RFQ");
    const review = ReviewSchema.parse(rawReview);
    const recommendation = session.active.recommendation;
    const faces = recommendation.package.faceIds.map(id => {
      const face = faceLookup[id];
      if (!face) throw new Error(`Missing active face ${id}`);
      return face;
    });
    const owners = [...new Set(faces.map(face => face.ownerId))].sort();
    const supplierMessages = owners.map(ownerId => {
      const ownerFaces = faces.filter(face => face.ownerId === ownerId);
      const watermark = ownerFaces.some(face => face.provenance === "demo") ? "DEMO — DO NOT SEND\n\n" : "";
      const lines = ownerFaces.map(face => [
        `- Face: ${face.id}`,
        `  Location: ${face.address}`,
        `  Format: ${face.format}`,
        `  Flight: ${review.startDate} to ${review.endDate}`,
        `  Requested delivery: ${face.format === "dooh_screen" ? "confirm share-of-time and play schedule" : "one four-week posting"}`,
        `  Indicative conditional line rate: ${money(face.rateNgn)} ${face.grossNet}, ${face.rateBasis}, as of ${face.rateAsOf}`
      ].join("\n")).join("\n");
      const body = `${watermark}Supplier verification request\nBuyer: ${review.buyerName} <${review.buyerEmail}>\n`
        + `Response requested by: ${review.responseDeadline}\n\n${lines}\n\n`
        + "Please confirm availability, current rate and basis, taxes, production, installation, lead time, "
        + "physical-site permit status, proof-of-posting and available measurement/method files.\n"
        + `Notes: ${review.supplierNotes || "None"}`;
      if (forbidden.test(body)) throw new Error("RFQ contains prohibited outcome or transaction wording");
      return { ownerId, faceIds: ownerFaces.map(face => face.id), body };
    });
    return { supplierMessages, internalRequest: {
      planId: recommendation.id,
      workingBudgetNgn: recommendation.package.totalCostNgn,
      audiencePlanningBasis: recommendation.audience,
      lines: faces.map(face => ({ ownerId: face.ownerId, faceId: face.id, rateNgn: face.rateNgn }))
    } };
  };
}
```

The consolidated internal object includes all active lines, internal working budget and the audience planning basis or explicit unavailable state. Supplier messages ask only for that supplier's face-level inputs/method; they do not ask a supplier to confirm cross-supplier deduplication or `deliver thought leaders`.

- [ ] **Step 3: Enforce provenance, rights and safe wording**

The generator above adds `DEMO — DO NOT SEND` to every supplier output containing demo inventory; prepend the same watermark field to `internal-request.json` in the download adapter. Numeric audience estimates never enter supplier copy. Keep aggregate disclosure post-MVP; the demo exposes no override, so cell/archetype/suppressed details cannot leak. The `forbidden` check blocks transaction, guarantee, perception, persuasion, sales and market-share claims.

- [ ] **Step 4: Build the focused RFQ review and browser downloads**

The drawer edits only buyer contact, response deadline, flight dates and supplier notes. Preserve values on generation failure:

```tsx
// src/features/rfq/RfqReviewPanel.tsx
import { useState } from "react";
import type { GeneratedRfq, PlanSession, PlannerOperations, RfqReviewInput } from "@/application/contracts";
import { copySupplierMessage, downloadGeneratedRfq } from "@/adapters/downloads/downloadRfq";

function RfqDownloads({ output }: { output: GeneratedRfq }) {
  const [copyError, setCopyError] = useState<string | null>(null);
  return <div aria-label="Generated RFQ downloads">
    {output.supplierMessages.map(message => <button key={message.ownerId} onClick={() => {
      void copySupplierMessage(message.body).then(() => setCopyError(null))
        .catch(error => setCopyError(error instanceof Error ? error.message : "Copy failed"));
    }}>Copy {message.ownerId} request</button>)}
    <button onClick={() => downloadGeneratedRfq(output)}>Download all</button>
    {copyError && <p role="alert">{copyError}</p>}
  </div>;
}

export function RfqReviewPanel({ session, operations }: { session: PlanSession; operations: PlannerOperations }) {
  const active = session.active.recommendation;
  const [fields, setFields] = useState<RfqReviewInput>({ buyerName: "", buyerEmail: "",
    responseDeadline: "2026-08-20", startDate: active.brief.startDate,
    endDate: active.brief.endDate, datesConfirmed: false, supplierNotes: "" });
  const [state, setState] = useState<{ kind: "review" | "generating" | "generated" | "failed";
    output?: GeneratedRfq; message?: string }>({ kind: "review" });
  const generate = async () => {
    setState({ kind: "generating" });
    try { setState({ kind: "generated", output: await operations.generateRfq(session, fields) }); }
    catch (error) { setState({ kind: "failed", message: error instanceof Error ? error.message : "Generation failed" }); }
  };
  return <section aria-labelledby="rfq-title"><h2 id="rfq-title">Review supplier-verification RFQ</h2>
    <label>Buyer name<input value={fields.buyerName}
      onChange={event => setFields({ ...fields, buyerName: event.target.value })} /></label>
    <label>Buyer email<input type="email" value={fields.buyerEmail}
      onChange={event => setFields({ ...fields, buyerEmail: event.target.value })} /></label>
    <label>Response deadline<input type="date" value={fields.responseDeadline}
      onChange={event => setFields({ ...fields, responseDeadline: event.target.value })} /></label>
    <label>Start date<input type="date" value={fields.startDate}
      onChange={event => setFields({ ...fields, startDate: event.target.value })} /></label>
    <label>End date<input type="date" value={fields.endDate}
      onChange={event => setFields({ ...fields, endDate: event.target.value })} /></label>
    <label><input type="checkbox" checked={fields.datesConfirmed}
      onChange={event => setFields({ ...fields, datesConfirmed: event.target.checked })} />
      Confirm campaign dates</label>
    <label>Supplier notes<textarea value={fields.supplierNotes}
      onChange={event => setFields({ ...fields, supplierNotes: event.target.value })} /></label>
    <button disabled={state.kind === "generating"} onClick={() => void generate()}>Generate RFQ</button>
    {state.kind === "failed" && <p role="alert">{state.message}</p>}
    {state.kind === "generated" && state.output && <RfqDownloads output={state.output} />}
  </section>;
}
```

```ts
// src/adapters/downloads/downloadRfq.ts
function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

export function downloadGeneratedRfq(output: GeneratedRfq) {
  output.supplierMessages.forEach(message => download(`rfq-${message.ownerId}.txt`, message.body, "text/plain"));
  download("internal-request.json", JSON.stringify({ watermark: "DEMO — DO NOT SEND",
    ...output.internalRequest }, null, 2), "application/json");
}

export async function copySupplierMessage(body: string) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable; use Download instead");
  await navigator.clipboard.writeText(body);
}
```

In Task 10, replace Task 7's inline RFQ drawer section with `<RfqReviewPanel session={session} operations={operations} />`.

- [ ] **Step 5: Verify RFQ generation**

Run: `npm test -- tests/unit/rfq.test.ts tests/component/rfqReview.test.tsx`

Expected: required fields, active-plan-only, supplier isolation, watermarks, audience exclusion, denied export rights, forbidden language, copy/download and recoverable failure tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/rfq.ts src/features/rfq src/adapters/downloads tests/unit/rfq.test.ts tests/component/rfqReview.test.tsx
git commit -m "feat: add supplier verification RFQ workflow"
```

## Task 11: Lock visual quality, accessibility, offline behavior and the four-minute demo

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: `src/features/map/*`
- Modify: `src/features/drawer/*`
- Create: `tests/e2e/sector-flows.spec.ts`
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/upload-rfq.spec.ts`
- Create: `tests/e2e/responsive-navigation.spec.ts`
- Create: `tests/e2e/offline.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/visual.spec.ts`
- Create: `README.md`

Use one shared E2E state navigator:

```ts
// tests/e2e/helpers.ts
import type { Page } from "@playwright/test";

export async function openBankRecommendation(page: Page) {
  await page.goto("/");
  await page.getByLabel("Sector").selectOption("bank_fintech");
  await page.getByRole("button", { name: "Create recommendation" }).click();
  await page.getByText("Focus on Yaba/Akoka, Ikeja and VI/Ikoyi").waitFor();
}

export async function openDemoState(page: Page,
  state: "brief" | "recommendation" | "audience" | "upload" | "rfq") {
  if (state === "brief") { await page.goto("/"); return; }
  await openBankRecommendation(page);
  if (state === "audience") await page.getByRole("button", { name: /63% influence capture/i }).click();
  if (state === "upload") {
    await page.getByRole("button", { name: "Upload spreadsheet" }).click();
    await page.getByLabel("Spreadsheet file").setInputFiles("tests/fixtures/service-locations.csv");
  }
  if (state === "rfq") await page.getByRole("button", { name: "Review RFQ" }).click();
}
```

- [ ] **Step 1: Write the failing Bank/Fintech presentation path**

```ts
import { expect, test } from "@playwright/test";

test("Bank/Fintech demo completes the core story", async ({ page }) => {
  const started = Date.now();
  await page.goto("/");
  await page.getByLabel("Sector").selectOption("bank_fintech");
  await page.getByRole("button", { name: "Create recommendation" }).click();
  await expect(page.getByText("Focus on Yaba/Akoka, Ikeja and VI/Ikoyi")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3000);
  await expect(page.getByText("240k–290k est. target reach")).toBeVisible();
  await page.getByRole("button", { name: /63% influence capture/i }).click();
  await page.getByRole("button", { name: "Merchant peer advisers" }).click();
  await expect(page.getByText("Modelled marginal contribution, not geographic coverage")).toBeVisible();
  await page.getByRole("button", { name: "Replace Yaba/Akoka with Lekki" }).click();
  await expect(page.getByText(/Broader modelled reach/)).toBeVisible();
  await page.getByRole("button", { name: "Undo last change" }).click();
});
```

Run: `npm run test:e2e -- tests/e2e/sector-flows.spec.ts`

Expected: FAIL until the integrated flow and selectors are complete.

- [ ] **Step 2: Add all three sector flows and the upload→RFQ journey**

Use table-driven assertions for all seeded first outputs:

```ts
// tests/e2e/sector-flows.spec.ts
import { expect, test } from "@playwright/test";

const sectors = [
  { id: "bank_fintech", sentence: "Focus on Yaba/Akoka, Ikeja and VI/Ikoyi",
    reach: "240k–290k est. target reach", influence: "~63% influence capture" },
  { id: "fmcg", sentence: "Focus on Yaba/Akoka, Ikeja and Surulere",
    reach: "360k–430k est. target reach", influence: "~64% influence capture" },
  { id: "real_estate", sentence: "Focus on Ikeja, VI/Ikoyi and Lekki",
    reach: "160k–190k est. target reach", influence: "~77% influence capture" }
] as const;

for (const sector of sectors) test(`${sector.id} has its fixed first output`, async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Sector").selectOption(sector.id);
  await page.getByRole("button", { name: "Create recommendation" }).click();
  await expect(page.getByText(sector.sentence)).toBeVisible();
  await expect(page.getByRole("button", { name: sector.reach })).toBeVisible();
  await expect(page.getByRole("button", { name: sector.influence })).toBeVisible();
  await expect(page.getByText("Synthetic scenario • Audience evidence D")).toBeVisible();
});
```

```ts
// tests/e2e/upload-rfq.spec.ts
import { expect, test } from "@playwright/test";

test("service upload changes the plan and produces reviewable watermarked files", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create recommendation" }).click();
  await page.getByRole("button", { name: "Upload spreadsheet" }).click();
  await page.getByLabel("Spreadsheet file").setInputFiles("tests/fixtures/service-locations.csv");
  await page.getByLabel("Purpose").fill("Constrain planning to active service coverage");
  await page.getByLabel(/right to use/i).check();
  await page.getByLabel("Decision use").selectOption("eligibility_constraint");
  await page.getByRole("button", { name: "Confirm upload" }).click();
  await expect(page.getByText(/import-[a-f0-9]{12}/)).toBeVisible();
  await expect(page.getByText(/270k–320k est. target reach/)).toBeVisible();
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  await page.getByLabel("Buyer name").fill("Demo Brand Team");
  await page.getByLabel("Buyer email").fill("demo@example.com");
  await page.getByLabel("Confirm campaign dates").check();
  await page.getByRole("button", { name: "Generate RFQ" }).click();
  await expect(page.getByRole("button", { name: "Download all" })).toBeVisible();
  const downloads = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  expect((await downloads).suggestedFilename()).toMatch(/rfq-|internal-request/);
});
```

Also assert the raw six-decimal baseline/swap/upload values inside the audience drawer's evidence table; screenshots never replace numeric assertions.

- [ ] **Step 3: Prove offline and failure behavior**

Intercept external requests, then exercise the WebGL fallback:

```ts
// tests/e2e/offline.spec.ts
import { expect, test } from "@playwright/test";

test("seeded flow makes no external request", async ({ page }) => {
  const external: string[] = [];
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    external.push(url.href);
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create recommendation" }).click();
  await expect(page.getByText(/Focus on/)).toBeVisible();
  expect(external).toEqual([]);
});

test("ranked list remains usable without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const replacement = function(this: HTMLCanvasElement, type: string, options?: unknown) {
      if (type === "webgl" || type === "webgl2") return null;
      return Reflect.apply(original, this, [type, options]);
    };
    HTMLCanvasElement.prototype.getContext = replacement as unknown as typeof original;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create recommendation" }).click();
  await expect(page.getByRole("list", { name: "Ranked zones" })).toBeVisible();
  await page.getByRole("button", { name: /Yaba\/Akoka details/ }).click();
  await expect(page.getByRole("complementary", { name: "Recommendation details" })).toBeVisible();
});
```

Unit/component tests inject rejected source-link, clipboard and RFQ-generation promises, assert state is preserved and expose retry/download alternatives. Fixture tests verify fewer-than-three eligible zones and no-valid-package states never insert fillers.

- [ ] **Step 4: Prove responsive keyboard and accessibility behavior**

Run desktop and 390×844 mobile. Use the same five-click path from the component test and add automated axe gates:

```ts
// tests/e2e/accessibility.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openDemoState } from "./helpers";

for (const state of ["brief", "recommendation", "audience", "upload", "rfq"] as const) {
  test(`${state} has no serious or critical axe violations`, async ({ page }) => {
    await openDemoState(page, state);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(violation => ["serious", "critical"].includes(violation.impact ?? "")))
      .toEqual([]);
  });
}
```

```ts
// tests/e2e/responsive-navigation.spec.ts
import { expect, test } from "@playwright/test";
import { openBankRecommendation } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });
test("mobile audience evidence stays within five interactions and the page does not overflow", async ({ page }) => {
  await openBankRecommendation(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Audience estimate" }).click();
  await page.getByRole("tab", { name: "Influence" }).click();
  await page.getByRole("button", { name: "Merchant peer advisers" }).click();
  await page.getByRole("button", { name: /Ikeja/ }).click();
  await page.getByRole("button", { name: "View source" }).click();
  await expect(page.getByText("Synthetic influence model v1")).toBeVisible();
});

test("drawer supports keyboard entry, Back, Escape and focus restoration", async ({ page }) => {
  await openBankRecommendation(page);
  const audience = page.getByRole("button", { name: "Audience estimate" });
  await audience.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("complementary", { name: "Recommendation details" })).toBeVisible();
  await page.getByRole("tab", { name: "Influence" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Merchant peer advisers" }).click();
  await page.getByRole("button", { name: /Ikeja/ }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: /Ikeja/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Recommendation details" })).toBeHidden();
  await expect(audience).toBeFocused();
  await expect(page.getByRole("list", { name: "Ranked zones" })).toContainText("Ikeja");
  await expect(page.getByLabel(/Influence legend|Rank legend/)).toBeVisible();
});
```

The Task 7 component focus-trap test adds this exact assertion:

```tsx
const drawer = screen.getByRole("complementary", { name: "Recommendation details" });
const focusable = [...drawer.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, select")];
focusable[0].focus();
await userEvent.tab({ shift: true });
expect(focusable.at(-1)).toHaveFocus();
focusable.at(-1)!.focus();
await userEvent.tab();
expect(focusable[0]).toHaveFocus();
```

- [ ] **Step 5: Finish the approved visual system**

Match the approved mockup's proportions with these layout constraints:

```css
/* append to src/styles/global.css */
.planner-workspace { position: relative; min-height: min(68vh, 720px); }
.planner-map { position: absolute; inset: 0; min-height: 560px; }
.recommendation-header { position: absolute; z-index: 2; top: 16px; left: 16px; max-width: 560px;
  padding: 12px 14px; background: rgb(255 254 250 / 94%); border: 1px solid var(--border);
  border-radius: var(--radius-md); backdrop-filter: blur(8px); }
.planner-drawer { position: absolute; z-index: 3; top: 16px; right: 16px; bottom: 92px; width: min(390px, calc(100% - 32px));
  overflow: auto; padding: 16px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-float); }
.package-strip { position: absolute; z-index: 2; right: 16px; bottom: 16px; left: 16px; display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto; gap: 16px; align-items: center;
  padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.audience-signal button { padding: 0; color: var(--foreground); background: none; border: 0; text-decoration: underline; text-underline-offset: 3px; }
.zone-rank-marker { width: 32px; height: 32px; color: white; background: var(--primary); border: 2px solid white;
  border-radius: 50%; box-shadow: 0 4px 14px rgb(23 32 29 / 24%); font-weight: 900; }
.decision-path { display: grid; gap: 14px; padding-left: 20px; }
.decision-path li { padding-left: 4px; }
.decision-path strong, .decision-path span { display: block; }
.contribution-bar { display: flex; height: 34px; margin: 7px 0; overflow: hidden; border-radius: var(--radius-sm); }
.contribution-bar button { min-width: 34px; color: white; background: var(--green); border: 1px solid rgb(255 255 255 / 55%); font-weight: 900; }
.scenario-band { position: relative; height: 72px; margin: 12px 0 20px; }
.scenario-track { position: absolute; top: 28px; right: 5%; left: 5%; height: 8px; background: #dfe8e3; border-radius: 999px; }
.scenario-marker { position: absolute; top: 9px; translate: -50% 0; font-size: .72rem; white-space: nowrap; }
.scenario-marker::after { content: ""; display: block; width: 2px; height: 30px; margin: 4px auto 0; background: var(--green); }
.scenario-marker.base { font-weight: 900; }
.archetype-bars { display: grid; gap: 8px; }
.archetype-bars button { display: grid; grid-template-columns: minmax(0, 1fr) minmax(60px, 1fr) auto; gap: 8px;
  align-items: center; padding: 8px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); text-align: left; }
.archetype-bars button > span:nth-child(2) { display: block; max-width: 100%; height: 7px; background: var(--green); border-radius: 99px; }
.changed-feature { animation: changed-pulse 180ms ease-out; }
@keyframes changed-pulse { from { filter: saturate(1.8); } to { filter: none; } }
@media (max-width: 760px) {
  .planner-workspace { min-height: 700px; }
  .recommendation-header { right: 10px; top: 10px; left: 10px; }
  .planner-drawer { top: auto; right: 0; bottom: 0; left: 0; width: 100%; max-height: 68%; border-radius: 18px 18px 0 0; }
  .package-strip { right: 10px; bottom: 10px; left: 10px; grid-template-columns: 1fr; gap: 8px; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; } }
```

Keep the default map uncluttered: no dashboard rail, KPI cards, radar chart, visible weight editor or default heatmap. Use only 150–200 ms transitions.

```ts
// tests/e2e/visual.spec.ts
import { expect, test } from "@playwright/test";
import { openBankRecommendation } from "./helpers";

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`approved map-first composition at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openBankRecommendation(page);
    await expect(page).toHaveScreenshot(`bank-map-${viewport.width}x${viewport.height}.png`, {
      animations: "disabled", fullPage: true, maxDiffPixelRatio: .015
    });
  });
}
```

Run once with `npm run test:e2e -- tests/e2e/visual.spec.ts --update-snapshots`, compare all three images against the approved HTML mockup, then commit the reviewed baselines.

- [ ] **Step 6: Document demo operation and explicit limitations**

Create `README.md` with this exact operating contract:

```markdown
# OOH Promotion Wizard Demo

Local-first demonstration for FMCG, Real Estate and Bank/Fintech campaign planning in five illustrative Lagos zones.

## Run

`npm install`
`npx playwright install chromium`
`npm run dev`

Use the seeded Bank/Fintech brief for the core path. The app makes no external AI, geocoding, map-tile, font or data request on seeded flows.

## Four-minute demo

1. Submit the compact Bank/Fintech brief.
2. Read the three-zone recommendation and `240k–290k est. target reach • ~63% influence capture`.
3. Click Influence Capture, select Merchant peer advisers, then inspect Ikeja and its source.
4. Replace Yaba/Akoka with Lekki; explain broader modelled reach and lower influence capture; undo.
5. Upload `public/upload-templates/service-locations.csv` as an eligibility constraint and apply the disclosed 2 km assumption.
6. Apply the draft, review the supplier-isolated RFQ, then generate the `DEMO — DO NOT SEND` files.

Optional branch: `How was this chosen?` shows the fixed five-pillar Planning Fit method and separate audience-estimate method.

## Claim glossary

- Planning Fit: product-defined planning score, not predicted campaign performance or industry certification.
- Estimated target reach: deduplicated synthetic scenario for the exact seeded exposure plan.
- Influence Capture: modelled share of the adult target's category-specific influential-member mass reached; display-only and not persuasion or perception change.
- Passenger movements and historical placements: context only, never impressions or bookable availability.

## Demo provenance and limitations

All suppliers, inventory, rates, availability, audience universes, overlap and influence profiles are fictional deterministic fixtures. Audience results are `Synthetic scenario • Audience evidence D`. Outputs do not predict sales or market share and do not represent live Lagos measurement. Uploaded bytes stay in the browser session. Unsupported inventory shows `Audience estimate unavailable`; the app never fabricates coverage.

## Upload templates

- `/upload-templates/service-locations.csv`
- `/upload-templates/inventory.csv`

## Production adapters deferred

Authentication, PostGIS, object storage, live inventory/rates, provider audience models, arbitrary geocoding, supplier sending/booking/payment, PDF/DOCX output and cross-media adapters are intentionally outside this demo slice. The typed `PlannerOperations` seam is the replacement boundary.

## Verify

`npm run verify`
```

- [ ] **Step 7: Run the full verification gate**

Run: `npm run verify`

Expected: lint exits 0, all unit/component tests pass, production build exits 0, all Chromium E2E/axe tests pass, no external requests occur on the seeded path and recommendation appears within three seconds.

- [ ] **Step 8: Commit**

```bash
git add src tests README.md
git commit -m "test: lock promotion wizard demo experience"
```

## Acceptance traceability

| Approved requirement | Owning tasks |
|---|---|
| Sparse brief → generating → recommendation → draft/customised/failure states | 1, 6, 11 |
| Deterministic five-pillar method, confidence and truthful zone/package result | 2, 3, 11 |
| First-output target reach and Influence Capture with safe degraded states | 4, 6, 7 |
| Clickable map/list evidence paths in five interactions | 5, 7, 11 |
| Reach/Influence lenses, exact marginals, rank restoration and accessibility | 4, 7, 11 |
| Homogeneous D/E modes, five-pillar arithmetic and separate Evidence Confidence | 2, 3, 7 |
| Missing/unconfirmed/withheld/invalidated audience states never render as zero | 4, 6, 7, 11 |
| Budget/zone/site changes, deltas, undo/apply/reset and atomic RFQ handoff | 5, 8 |
| Live service/distribution and inventory XLSX/CSV upload | 9 |
| Supplier-isolated, internal-audience-aware, watermarked RFQ | 10 |
| Three sector fixtures, fixed snapshots, offline and <3-second demo | 2, 4, 11 |
| Historical placements and passenger movements remain labelled context, never reach or availability | 2, 7, 11 |
| Seeded fixed-user surface cannot access non-demo audience records | 2, 5, 11 |
| Adult-only aggregate influence, sample/privacy suppression and no person identification | 4, 7, 10 |
| Distribution is a factual constraint only; sales and market share are not projected | 8, 9, 10, 11 |
| No fabricated reach, supplier facts, outcomes, booking or demographic influence | 2–11 |

## Final execution checklist

Before declaring the MVP complete:

- [ ] All commits above exist in order and each commit's targeted tests passed before moving on.
- [ ] `npm run verify` is green from a clean checkout.
- [ ] `git status --short` is empty.
- [ ] Bank/FMCG/Real Estate baseline, swap and upload goldens exactly match `expectedSnapshots.ts`.
- [ ] The demo runs with browser network disabled after initial static asset load.
- [ ] No output contains real supplier contact, unwatermarked demo RFQ, unsupported audience number or market-outcome claim.
- [ ] The approved design spec and README link to this implementation plan.
