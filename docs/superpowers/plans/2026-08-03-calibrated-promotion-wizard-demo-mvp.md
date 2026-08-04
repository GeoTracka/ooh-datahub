# Calibrated Promotion Wizard Demo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a presentation-ready promotion wizard that turns an FMCG, Real Estate, or Bank/Fintech brief into one evidence-labelled three-zone OOH package, a navigable causal delivery explanation, reversible adjustments, and a supplier-verification RFQ draft; spreadsheet upload adds an offline-first, context-only inventory vignette with optional live enrichment.

**Architecture:** Use one Next.js application with a pure TypeScript planning engine and session-local React state. The seeded Evidence-D Lagos experience runs entirely in the browser from a frozen bundle; only an explicit enrichment action crosses server-only route handlers, and renderer-specific scene projection prevents provider content from leaking between Google Maps and MapLibre.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, MapLibre GL, React MapLibre, React Google Maps, read-excel-file, Papa Parse, Vitest, fast-check, React Testing Library, Playwright, axe-core, CSS custom properties, and local GeoJSON.

---

**Status:** Approved replacement plan

**Normative design:** [Calibrated Reach and Live Enrichment Design](../specs/2026-08-03-calibrated-reach-enrichment-design.md)

**Parent experience design:** [Map-First Promotion Wizard MVP Design](../specs/2026-08-02-map-first-promotion-wizard-design.md)

**Replaces:** [Superseded Promotion Wizard Demo MVP Plan](2026-08-03-promotion-wizard-demo-mvp.md)

## Delivery boundary

This plan implements the smallest acceptance-complete demo:

- a frozen Lagos Evidence-D bundle with coherent Low, Base, and High scenarios;
- a stable weighted overlap panel, not summed per-face reach;
- one package with three selected-zone cards and two internal replacement candidates;
- Broad reach, Influential core, and Near conversion presets;
- Plan, Activity, Reach, and Influence lenses;
- Location → Places → Movement → OTS → Target → Unique explanation;
- dirty-draft adjustments with Undo, Reset, and Apply & review RFQ;
- local CSV, TSV, and XLSX parsing with a 50-row limit;
- explicit enrichment preflight and a server-only provider gateway;
- a feature-gated Google Geocoding adapter;
- mutually exclusive Google and MapLibre scene projections;
- an editable review boundary plus supplier-isolated, watermarked RFQ downloads; and
- network-disabled seeded operation.

This plan deliberately does not implement:

- field-pilot collection or production model fitting;
- Evidence-C or production promotion; the runtime accepts only the seeded Evidence-D contract;
- activation of Places Aggregate or Routes before recorded commercial and legal approval;
- Places Insights, BigQuery, live traffic counts, or Google-derived training features;
- a database, authentication, organizations, background jobs, or persistent provider caching;
- production audience or influence studies;
- full Drive ETL, live supplier availability, supplier sending, booking, payment, or reservations;
- legacy XLS, PDF or DOCX generation;
- cross-media adapters or cross-media deduplication; or
- market-share, sales, persuasion, or perception prediction.

These are explicit scope exclusions, not unfinished code paths. Unsupported capabilities return typed unavailable states with a reason.

**Terminology lock:** the demo’s **Influence Capture** is the implementation-safe form of the requested “target audience dominance perception share”: the percentage of a category-specific, influence-weighted target universe receiving 1+ modelled OOH exposure. It is a coverage metric for likely demographic opinion leaders, never a claim that perception, persuasion, or market share changed.

## Locked architecture

### File map

~~~text
ooh-datahub/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── public/
│   └── map/lagos-open-context.geojson
├── scripts/
│   ├── build-demo-bundle.ts
│   ├── build-golden-outputs.ts
│   ├── validate-frozen-bundle.ts
│   └── verify-client-secrets.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── enrichment/preflight/route.ts
│   │   │   ├── enrichment/run/route.ts
│   │   │   └── maps/google-config/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── application/
│   │   ├── plannerReducer.ts
│   │   ├── plannerSelectors.ts
│   │   └── plannerService.ts
│   ├── bundle/
│   │   ├── bundleSchema.ts
│   │   ├── loadFrozenBundle.ts
│   │   └── validateFrozenBundle.ts
│   ├── contracts/
│   │   ├── domain.ts
│   │   ├── enrichment.ts
│   │   ├── metrics.ts
│   │   ├── renderer.ts
│   │   └── rfq.ts
│   ├── demo/lagos-v1/
│   │   ├── bundle.json
│   │   └── golden-outputs.json
│   ├── enrichment/
│   │   ├── enrichmentClient.ts
│   │   ├── enrichmentSnapshot.ts
│   │   └── policyRules.ts
│   ├── features/
│   │   ├── AdjustmentsPanel.tsx
│   │   ├── BriefPanel.tsx
│   │   ├── CausalDrawer.tsx
│   │   ├── LensTabs.tsx
│   │   ├── PackageStrip.tsx
│   │   ├── PlannerPage.tsx
│   │   ├── RecommendationCards.tsx
│   │   ├── RfqDrawer.tsx
│   │   ├── UploadDialog.tsx
│   │   └── UploadPreview.tsx
│   ├── import/
│   │   ├── mapHeaders.ts
│   │   ├── readLocalSpreadsheet.ts
│   │   └── validateRows.ts
│   ├── maps/
│   │   ├── GoogleRenderer.tsx
│   │   ├── MapCanvas.tsx
│   │   ├── MapLibreRenderer.tsx
│   │   ├── mapLibreStyle.ts
│   │   └── projectScene.ts
│   ├── planning/
│   │   ├── activityPotential.ts
│   │   ├── claimLadder.ts
│   │   ├── calibrationGate.ts
│   │   ├── engine.ts
│   │   ├── evidence.ts
│   │   ├── exposure.ts
│   │   ├── featureRegistry.ts
│   │   ├── fingerprint.ts
│   │   ├── influence.ts
│   │   ├── movement.ts
│   │   ├── overlapPanel.ts
│   │   ├── objectiveDelivery.ts
│   │   ├── packageOptimizer.ts
│   │   ├── planningFit.ts
│   │   └── rfq.ts
│   ├── server/enrichment/
│   │   ├── adapter.ts
│   │   ├── gateway.ts
│   │   ├── policy.ts
│   │   ├── requestSchemas.ts
│   │   ├── runtime.ts
│   │   └── providers/
│   │       ├── disabledProvider.ts
│   │       └── googleGeocodingProvider.ts
│   └── shared/
│       ├── canonicalJson.ts
│       └── fixedClock.ts
└── tests/
    ├── server-only.ts
    ├── component/
    ├── e2e/
    ├── fixtures/
    └── unit/
~~~

### Dependency rules

- Files under `src/planning` import only contracts, bundle records, and pure shared utilities.
- Planning code never imports React, Next.js, browser globals, filesystem APIs, network clients, provider SDKs, or current time.
- Low, Base, and High are coherent end-to-end scenario runs. The engine never combines unrelated endpoints.
- No record contains a precomputed `faceReach` field.
- Reusing a reach result requires an exact exposure-plan fingerprint. Comparing two recomputed plans requires a matching comparability key.
- Every score feature has one registered Planning Fit pillar. Measurement predictors cannot reappear as independent score bonuses.
- Spreadsheet parsing, preview, and context shortlisting remain local; only Review enrichment and the separately confirmed Enrich locations action use the network.
- Server provider modules import `server-only` and never expose the server key.
- The scene projector returns either a Google scene or a MapLibre scene, never a mixed scene.
- RFQs derive from the applied plan only. Synthetic evidence forces the `DEMO — DO NOT SEND` watermark.

### Dependency order

~~~text
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
                  └────────→ Task 7 → Task 8 → Task 9
Task 6 + Task 9 → Task 10
Task 6 → Task 11
Task 10 + Task 11 → Task 12
~~~

Tasks 3–6 and 7–9 may run as separate tracks after Task 2. Do not begin the visual shell before the claim contracts and scene policy exist.

## Task 1: Scaffold the single-app runtime and deterministic test harness

**Files:**

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/shared/canonicalJson.ts`
- Create: `src/shared/fixedClock.ts`
- Create: `tests/server-only.ts`
- Test: `tests/unit/shared/canonicalJson.test.ts`

- [ ] **Step 1: Initialize the package and install only the approved dependencies**

Run:

~~~bash
pnpm init
pnpm add next react react-dom zod server-only maplibre-gl @vis.gl/react-maplibre @vis.gl/react-google-maps read-excel-file papaparse @turf/boolean-point-in-polygon @radix-ui/react-dialog @radix-ui/react-tabs clsx
pnpm add -D typescript @types/node @types/react @types/react-dom @types/papaparse @types/geojson eslint eslint-config-next prettier vitest jsdom fast-check @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test @axe-core/playwright
~~~

Expected: `package.json` and `pnpm-lock.yaml` exist. The lockfile, rather than this plan, pins resolved versions.

- [ ] **Step 2: Add deterministic scripts and strict configuration**

Set the scripts in `package.json` to:

~~~json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
~~~

Create `next.config.ts`:

~~~ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
~~~

Create `tsconfig.json`:

~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
~~~

Create `eslint.config.mjs`:

~~~js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**"]),
]);
~~~

Create `.gitignore`:

~~~gitignore
node_modules/
.next/
coverage/
playwright-report/
test-results/
.env*
!.env.example
~~~

Create `vitest.config.ts`:

~~~ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "server-only": path.resolve(rootDir, "tests/server-only.ts"),
    },
  },
});
~~~

Create `playwright.config.ts`:

~~~ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
});
~~~

Create `tests/setup.ts`:

~~~ts
import "@testing-library/jest-dom/vitest";
~~~

Create the empty test-only poison-package shim `tests/server-only.ts`:

~~~ts
export {};
~~~

- [ ] **Step 3: Write the failing deterministic-serialization test**

Create `tests/unit/shared/canonicalJson.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";
import type { ExposureBlock } from "@/planning/movement";
import { canonicalJson } from "@/shared/canonicalJson";

describe("canonicalJson", () => {
  it("sorts object keys recursively without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [3, 1] }))
      .toBe('{"a":{"b":3,"y":2},"list":[3,1],"z":1}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ value: Number.NaN }))
      .toThrow("Non-finite number");
  });
});
~~~

- [ ] **Step 4: Run the test and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/shared/canonicalJson.test.ts
~~~

Expected: FAIL because `@/shared/canonicalJson` does not exist.

- [ ] **Step 5: Implement the deterministic utility and fixed demo clock**

Create `src/shared/canonicalJson.ts`:

~~~ts
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const normalized: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))) {
      normalized[key] = normalize(child);
    }
    return normalized;
  }
  throw new Error("Unsupported JSON value: " + typeof value);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}
~~~

Create `src/shared/fixedClock.ts`:

~~~ts
export const DEMO_NOW_ISO = "2026-08-03T12:00:00.000Z";

export type Clock = { nowIso(): string };

export const fixedDemoClock: Clock = {
  nowIso: () => DEMO_NOW_ISO,
};
~~~

- [ ] **Step 6: Add the minimal Next shell**

Create `src/app/layout.tsx`:

~~~tsx
import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "OOH Promotion Wizard",
  description: "Evidence-labelled campaign planning demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
~~~

Create `src/app/page.tsx`:

~~~tsx
export default function HomePage() {
  return <main><h1>OOH Promotion Wizard</h1></main>;
}
~~~

Create `src/app/globals.css`:

~~~css
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #f4f5f7;
  color: #172033;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
button, input, select { font: inherit; }
~~~

- [ ] **Step 7: Verify the scaffold**

Run:

~~~bash
pnpm test -- tests/unit/shared/canonicalJson.test.ts
pnpm typecheck
pnpm build
~~~

Expected: both tests PASS, TypeScript exits 0, and Next reports a successful production build.

- [ ] **Step 8: Commit**

~~~bash
git add .gitignore package.json pnpm-lock.yaml next.config.ts tsconfig.json eslint.config.mjs vitest.config.ts playwright.config.ts src/app src/shared tests/setup.ts tests/server-only.ts tests/unit/shared
git commit -m "chore: scaffold calibrated promotion wizard"
~~~

## Task 2: Define typed claims, provenance, evidence, and feature-use rules

**Files:**

- Create: `src/contracts/domain.ts`
- Create: `src/contracts/metrics.ts`
- Create: `src/planning/evidence.ts`
- Create: `src/planning/featureRegistry.ts`
- Test: `tests/unit/contracts/metrics.test.ts`
- Test: `tests/unit/planning/evidence.test.ts`
- Test: `tests/unit/planning/featureRegistry.test.ts`

- [ ] **Step 1: Write failing claim-contract tests**

Create `tests/unit/contracts/metrics.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { MetricClaimSchema } from "@/contracts/metrics";

const common = {
  id: "claim-1",
  label: "Demo delivery",
  sourceIds: ["demo-source"],
  caveats: ["Synthetic scenario"],
  applicability: "inside",
};

describe("MetricClaimSchema", () => {
  it("rejects Activity Potential with a people unit", () => {
    expect(() => MetricClaimSchema.parse({
      ...common,
      kind: "activity_potential",
      state: "modelled",
      evidence: "D",
      unit: "people",
      value: 72,
    })).toThrow();
  });

  it("accepts only Low/Base/High for an assumed demo reach", () => {
    expect(MetricClaimSchema.parse({
      ...common,
      kind: "scenario_target_reach",
      state: "assumed",
      evidence: "D",
      unit: "people",
      universe: 800_000,
      range: { type: "scenario", low: 220_000, base: 250_000, high: 285_000 },
    }).kind).toBe("scenario_target_reach");
  });

  it("rejects Influence Capture without a qi source", () => {
    expect(() => MetricClaimSchema.parse({
      ...common,
      kind: "influence_capture",
      state: "assumed",
      evidence: "D",
      unit: "percent",
      range: { type: "scenario", low: 40, base: 45, high: 51 },
    })).toThrow();
  });
});
~~~

- [ ] **Step 2: Run the tests and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/contracts/metrics.test.ts
~~~

Expected: FAIL because the claim schema does not exist.

- [ ] **Step 3: Implement the domain enums and claim union**

Create `src/contracts/domain.ts`:

~~~ts
import { z } from "zod";

export const SectorSchema = z.enum(["fmcg", "real_estate", "bank_fintech"]);
export const ObjectiveSchema = z.enum(["broad_reach", "influential_core", "near_conversion"]);
export const DaypartSchema = z.enum(["all_day", "am", "midday", "pm", "evening"]);
export const EvidenceGradeSchema = z.enum(["A", "B", "C", "D", "unavailable"]);
export const ProvenanceStateSchema = z.enum(["observed", "modelled", "assumed", "unavailable"]);
export const ApplicabilitySchema = z.enum(["inside", "outside", "unknown"]);

export type Sector = z.infer<typeof SectorSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type Daypart = z.infer<typeof DaypartSchema>;
export type EvidenceGrade = z.infer<typeof EvidenceGradeSchema>;
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;
~~~

Create `src/contracts/metrics.ts`:

~~~ts
import { z } from "zod";
import {
  ApplicabilitySchema,
  EvidenceGradeSchema,
  ProvenanceStateSchema,
  type EvidenceGrade,
} from "@/contracts/domain";

const CommonClaimSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  state: ProvenanceStateSchema,
  evidence: EvidenceGradeSchema,
  sourceIds: z.array(z.string().min(1)),
  caveats: z.array(z.string()),
  applicability: ApplicabilitySchema,
});

const ScenarioRangeSchema = z.object({
  type: z.literal("scenario"),
  low: z.number().nonnegative(),
  base: z.number().nonnegative(),
  high: z.number().nonnegative(),
}).refine((value) => value.low <= value.base && value.base <= value.high, {
  message: "Scenario range must be ordered Low ≤ Base ≤ High",
});

const QuantileRangeSchema = z.object({
  type: z.literal("quantile"),
  p10: z.number().nonnegative(),
  p50: z.number().nonnegative(),
  p90: z.number().nonnegative(),
}).refine((value) => value.p10 <= value.p50 && value.p50 <= value.p90, {
  message: "Quantiles must be ordered P10 ≤ P50 ≤ P90",
});

export const MetricClaimSchema = z.discriminatedUnion("kind", [
  CommonClaimSchema.extend({
    kind: z.literal("activity_potential"),
    unit: z.literal("index_0_100"),
    value: z.number().min(0).max(100),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("movement"),
    unit: z.enum(["vehicle_passages", "person_passages"]),
    value: z.number().nonnegative(),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("general_ots"),
    unit: z.literal("ots"),
    value: z.number().nonnegative(),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("target_ots"),
    unit: z.literal("ots"),
    value: z.number().nonnegative(),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("scenario_target_reach"),
    state: z.literal("assumed"),
    evidence: z.literal("D"),
    unit: z.literal("people"),
    universe: z.number().positive(),
    range: ScenarioRangeSchema,
  }),
  CommonClaimSchema.extend({
    kind: z.literal("calibrated_target_reach"),
    state: z.literal("modelled"),
    unit: z.literal("people"),
    universe: z.number().positive(),
    range: QuantileRangeSchema,
  }),
  CommonClaimSchema.extend({
    kind: z.literal("influence_capture"),
    unit: z.literal("percent"),
    qiSourceId: z.string().min(1),
    range: z.union([ScenarioRangeSchema, QuantileRangeSchema]),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("influence_weighted_coverage"),
    unit: z.literal("percent"),
    weightSourceId: z.string().min(1),
    range: z.union([ScenarioRangeSchema, QuantileRangeSchema]),
  }),
  CommonClaimSchema.extend({
    kind: z.literal("unavailable"),
    state: z.literal("unavailable"),
    evidence: z.literal("unavailable"),
    unit: z.literal("none"),
    reasonCode: z.string().min(1),
  }),
]).superRefine((claim, context) => {
  if (
    (claim.kind === "scenario_target_reach" && claim.range.high > claim.universe) ||
    (claim.kind === "calibrated_target_reach" && claim.range.p90 > claim.universe)
  ) {
    context.addIssue({ code: "custom", message: "Reach cannot exceed its universe" });
  }
  if (claim.kind === "influence_capture" || claim.kind === "influence_weighted_coverage") {
    const values = claim.range.type === "scenario"
      ? [claim.range.low, claim.range.base, claim.range.high]
      : [claim.range.p10, claim.range.p50, claim.range.p90];
    if (values.some((value) => value > 100)) {
      context.addIssue({ code: "custom", message: "Percentage range cannot exceed 100" });
    }
    if (claim.range.type === "scenario" && (claim.state !== "assumed" || claim.evidence !== "D")) {
      context.addIssue({ code: "custom", message: "Scenario influence must be Assumed Evidence D" });
    }
    if (claim.range.type === "quantile" && claim.state !== "modelled") {
      context.addIssue({ code: "custom", message: "Quantile influence must be modelled" });
    }
  }
});

export type MetricClaim = z.infer<typeof MetricClaimSchema>;

export type PanelFailureCode =
  | "SCALING_OUTSIDE_ENVELOPE"
  | "MEMBER_RATE_OUTSIDE_ENVELOPE"
  | "FREQUENCY_OUTSIDE_ENVELOPE";

export type ScenarioMeasurement = {
  id: "low" | "base" | "high";
  reach: number | null;
  targetOts: number | null;
  influenceCapture: number | null;
  influenceMass: number | null;
  serviceableReach: number | null;
  averageFrequency: number | null;
  failureCode: PanelFailureCode | null;
};

export type MetricEvidence = {
  score: number;
  grade: EvidenceGrade;
  sourceIds: string[];
};

export type MeasurementStage = {
  id: "location" | "places" | "movement" | "ots" | "target" | "unique";
  state: z.infer<typeof ProvenanceStateSchema>;
  valueText: string;
  sourceLabel: string;
  freshnessLabel: string;
  transformation: string;
  nextMapping: string;
  caveats: string[];
  recoveryAction: string | null;
};

export type ReplayEnvelope = {
  bundleId: string;
  bundleSchemaVersion: string;
  modelVersion: string;
  featureSnapshotId: string;
  featureSchemaCompatibilityId: string;
  evidenceProfileVersion: string;
  scheduleModelVersion: string;
  influenceLinkageAssumptionId: string;
  influenceSensitivityId: string;
  sourceManifestIds: string[];
  enrichmentSnapshotId: string | null;
  dataRevision: string;
  exposurePlanFingerprint: string;
  comparabilityKey: string;
  overlapMethodId: string;
  replicateSetId: string;
  seed: number;
  controls: {
    sector: string;
    daypart: string;
    flightStart: string;
    flightEnd: string;
    flightDays: number;
    scheduleBlocks: Array<{
      date: string;
      daypart: "am" | "midday" | "pm" | "evening";
      startMinute: number;
      endMinute: number;
      durationHours: number;
    }>;
    siteIds: string[];
    exposureThreshold: "1+";
  };
};

export type EstimatePackageResult = {
  claim: MetricClaim;
  influence: MetricClaim | null;
  evidence: {
    permittedClaim: MetricEvidence;
    uniqueReach: MetricEvidence | null;
    influence: MetricEvidence | null;
    serviceability: MetricEvidence | null;
  };
  availability: {
    influence: { reasonCode: string | null; recoveryAction: string | null };
    serviceability: { reasonCode: string | null; recoveryAction: string | null };
  };
  scenarios: ScenarioMeasurement[];
  stages: MeasurementStage[];
  fingerprint: string;
  comparabilityKey: string;
  replay: ReplayEnvelope;
};
~~~

- [ ] **Step 4: Write and run the failing evidence-evaluation test**

Create `tests/unit/planning/evidence.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { evaluateEvidence } from "@/planning/evidence";

const syntheticProfile = {
  source: 25,
  validation: 25,
  temporal: 55,
  granularityCoverage: 60,
  completeness: 70,
  minimumCritical: 25,
  caps: [54],
  hasZeroCritical: false,
};

describe("evaluateEvidence", () => {
  it("computes the synthetic score as 40/D; 54 is only a ceiling", () => {
    expect(evaluateEvidence(syntheticProfile)).toEqual({ score: 40, grade: "D" });
  });

  it("fails closed when a critical component is zero", () => {
    expect(evaluateEvidence({ ...syntheticProfile, hasZeroCritical: true }))
      .toEqual({ score: 0, grade: "unavailable" });
  });
});
~~~

Run:

~~~bash
pnpm test -- tests/unit/planning/evidence.test.ts
~~~

Expected: FAIL because the evidence evaluator does not exist.

- [ ] **Step 5: Add evidence scoring and grade caps**

Create `src/planning/evidence.ts`:

~~~ts
import type { EvidenceGrade } from "@/contracts/domain";

export type EvidenceComponents = {
  source: number;
  validation: number;
  temporal: number;
  granularityCoverage: number;
  completeness: number;
  minimumCritical: number;
  caps: number[];
  hasZeroCritical: boolean;
};

export function evidenceScore(input: EvidenceComponents): number {
  const raw =
    0.25 * input.source +
    0.25 * input.validation +
    0.20 * input.temporal +
    0.20 * input.granularityCoverage +
    0.10 * input.completeness;
  return Math.min(raw, input.minimumCritical + 15, ...input.caps);
}

export function evidenceGrade(score: number, hasZeroCritical = false): EvidenceGrade {
  if (hasZeroCritical || score < 40) return "unavailable";
  if (score < 55) return "D";
  if (score < 70) return "C";
  if (score < 85) return "B";
  return "A";
}

export function evaluateEvidence(input: EvidenceComponents): {
  score: number;
  grade: EvidenceGrade;
} {
  const score = input.hasZeroCritical ? 0 : evidenceScore(input);
  return { score, grade: evidenceGrade(score, input.hasZeroCritical) };
}
~~~

- [ ] **Step 6: Write the failing feature-registry tests**

Create `tests/unit/planning/featureRegistry.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { verifyFeatureRegistry } from "@/planning/featureRegistry";

describe("verifyFeatureRegistry", () => {
  it("rejects one derived feature assigned to two score pillars", () => {
    expect(() => verifyFeatureRegistry([
      { id: "restaurant-density", role: "score", pillar: "A" },
      { id: "restaurant-density", role: "score", pillar: "C" },
    ])).toThrow("restaurant-density");
  });

  it("rejects a reach predictor reused as a score bonus", () => {
    expect(() => verifyFeatureRegistry([
      { id: "poi-attraction", role: "measurement", pillar: null },
      { id: "poi-attraction", role: "score", pillar: "A" },
    ])).toThrow("poi-attraction");
  });
});
~~~

- [ ] **Step 7: Run the feature test and verify it fails**

Run:

~~~bash
pnpm test -- tests/unit/planning/featureRegistry.test.ts
~~~

Expected: FAIL because the registry verifier does not exist.

- [ ] **Step 8: Implement the feature-use registry**

Create `src/planning/featureRegistry.ts`:

~~~ts
export type PlanningPillar = "A" | "D" | "C" | "P" | "E";
export type FeatureUse = {
  id: string;
  role: "measurement" | "score";
  pillar: PlanningPillar | null;
};

export function verifyFeatureRegistry(entries: FeatureUse[]): void {
  const uses = new Map<string, FeatureUse[]>();
  for (const entry of entries) {
    const current = uses.get(entry.id) ?? [];
    current.push(entry);
    uses.set(entry.id, current);
  }
  for (const [featureId, featureUses] of uses) {
    const scoredPillars = new Set(
      featureUses.filter((item) => item.role === "score").map((item) => item.pillar),
    );
    const isMeasurement = featureUses.some((item) => item.role === "measurement");
    if (scoredPillars.size > 1 || (isMeasurement && scoredPillars.size > 0)) {
      throw new Error("Feature used more than once: " + featureId);
    }
  }
}
~~~

- [ ] **Step 9: Run all Task 2 tests**

Run:

~~~bash
pnpm test -- tests/unit/contracts/metrics.test.ts tests/unit/planning/evidence.test.ts tests/unit/planning/featureRegistry.test.ts
pnpm typecheck
~~~

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 10: Commit**

~~~bash
git add src/contracts src/planning/evidence.ts src/planning/featureRegistry.ts tests/unit/contracts tests/unit/planning/featureRegistry.test.ts
git commit -m "feat: define planning claims and evidence rules"
~~~

## Task 3: Build the frozen Lagos bundle and fail-closed calibration gate

**Files:**

- Create: `src/bundle/bundleSchema.ts`
- Create: `src/bundle/loadFrozenBundle.ts`
- Create: `src/bundle/validateFrozenBundle.ts`
- Create: `src/planning/calibrationGate.ts`
- Create: `scripts/build-demo-bundle.ts`
- Create: `scripts/validate-frozen-bundle.ts`
- Generate: `src/demo/lagos-v1/bundle.json`
- Test: `tests/unit/bundle/frozenBundle.test.ts`
- Test: `tests/unit/planning/calibrationGate.test.ts`

- [ ] **Step 1: Write failing calibration-gate tests**

Create `tests/unit/planning/calibrationGate.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { evaluateMovementCalibration } from "@/planning/calibrationGate";

const passing = {
  heldOutLocations: 3,
  directionalBlocks: 192,
  mdape: 0.31,
  wape: 0.29,
  intervalCoverage: 0.74,
  absoluteSignedWape: 0.11,
  worstEligibleStratumAbsoluteSignedWape: 0.21,
  independentDateReplication: true,
  claimInputsComplete: true,
  insideApplicabilityEnvelope: true,
  downstreamProtocolRegistered: true,
};

describe("evaluateMovementCalibration", () => {
  it("passes only the complete Evidence-C movement gate", () => {
    expect(evaluateMovementCalibration(passing)).toEqual({ passed: true, failures: [] });
  });

  it("fails the original 96-block directional prototype", () => {
    expect(evaluateMovementCalibration({
      ...passing,
      directionalBlocks: 96,
      independentDateReplication: false,
    }).passed).toBe(false);
  });

  it("fails when interval coverage is below 70 percent", () => {
    expect(evaluateMovementCalibration({
      ...passing,
      intervalCoverage: 0.69,
    }).failures).toContain("INTERVAL_COVERAGE");
  });
});
~~~

- [ ] **Step 2: Run the calibration test and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/planning/calibrationGate.test.ts
~~~

Expected: FAIL because `evaluateMovementCalibration` does not exist.

- [ ] **Step 3: Implement the movement calibration gate**

Create `src/planning/calibrationGate.ts`:

~~~ts
export type MovementCalibrationReport = {
  heldOutLocations: number;
  directionalBlocks: number;
  mdape: number;
  wape: number;
  intervalCoverage: number;
  absoluteSignedWape: number;
  worstEligibleStratumAbsoluteSignedWape: number;
  independentDateReplication: boolean;
  claimInputsComplete: boolean;
  insideApplicabilityEnvelope: boolean;
  downstreamProtocolRegistered: boolean;
};

export type CalibrationFailure =
  | "HELD_OUT_LOCATIONS"
  | "DIRECTIONAL_BLOCKS"
  | "INDEPENDENT_DATE_REPLICATION"
  | "MDAPE"
  | "WAPE"
  | "INTERVAL_COVERAGE"
  | "SIGNED_WAPE"
  | "STRATUM_BIAS"
  | "CLAIM_INPUTS"
  | "APPLICABILITY"
  | "DOWNSTREAM_PROTOCOL";

export function evaluateMovementCalibration(
  report: MovementCalibrationReport,
): { passed: boolean; failures: CalibrationFailure[] } {
  const failures: CalibrationFailure[] = [];
  if (report.heldOutLocations < 3) failures.push("HELD_OUT_LOCATIONS");
  if (report.directionalBlocks < 192) failures.push("DIRECTIONAL_BLOCKS");
  if (!report.independentDateReplication) failures.push("INDEPENDENT_DATE_REPLICATION");
  if (report.mdape > 0.35) failures.push("MDAPE");
  if (report.wape > 0.35) failures.push("WAPE");
  if (report.intervalCoverage < 0.70) failures.push("INTERVAL_COVERAGE");
  if (report.absoluteSignedWape > 0.15) failures.push("SIGNED_WAPE");
  if (report.worstEligibleStratumAbsoluteSignedWape > 0.25) failures.push("STRATUM_BIAS");
  if (!report.claimInputsComplete) failures.push("CLAIM_INPUTS");
  if (!report.insideApplicabilityEnvelope) failures.push("APPLICABILITY");
  if (!report.downstreamProtocolRegistered) failures.push("DOWNSTREAM_PROTOCOL");
  return { passed: failures.length === 0, failures };
}
~~~

- [ ] **Step 4: Write the failing frozen-bundle tests**

Create `tests/unit/bundle/frozenBundle.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { buildDemoBundle } from "../../../scripts/build-demo-bundle";
import { validateFrozenBundle } from "@/bundle/validateFrozenBundle";
import { canonicalJson } from "@/shared/canonicalJson";

describe("frozen Lagos bundle", () => {
  it("is deterministic and remains Evidence D", () => {
    const first = buildDemoBundle();
    const second = buildDemoBundle();
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(first.manifest.maximumEvidenceGrade).toBe("D");
  });

  it("reconciles panel weights to every target universe", () => {
    const bundle = validateFrozenBundle(buildDemoBundle());
    for (const target of bundle.targets) {
      const weight = bundle.panel
        .filter((member) => member.sector === target.sector && member.cellId === target.cellId)
        .reduce((sum, member) => sum + member.weight, 0);
      expect(weight).toBeCloseTo(target.universe, 6);
    }
  });

  it("uses one mutually exclusive target partition per sector", () => {
    const bundle = validateFrozenBundle(buildDemoBundle());
    expect(bundle.targets.every((target) => target.membership === "mutually_exclusive"))
      .toBe(true);
    expect(new Set(bundle.panel.map((member) => member.id)).size)
      .toBe(bundle.panel.length);
    for (const member of bundle.panel) {
      expect(bundle.targets.filter((target) =>
        target.sector === member.sector && target.cellId === member.cellId,
      )).toHaveLength(1);
    }
  });

  it("contains exactly Low, Base, and High coherent scenarios", () => {
    const scenarios = buildDemoBundle().scenarios;
    expect(scenarios.map((item) => item.id))
      .toEqual(["low", "base", "high"]);
    expect(new Set(scenarios.map((item) => item.propensityConcentration)).size).toBe(1);
  });

  it("rejects duplicate scenario IDs and non-monotone exposure factors", () => {
    const duplicate = structuredClone(buildDemoBundle());
    duplicate.scenarios[2].id = "base";
    expect(() => validateFrozenBundle(duplicate))
      .toThrow("exactly one Low, Base, and High");

    const reversed = structuredClone(buildDemoBundle());
    reversed.scenarios[0].movementMultiplier = 1.2;
    expect(() => validateFrozenBundle(reversed))
      .toThrow("exposure multipliers must be monotone");
  });

  it("contains the minimum 30-location Activity Potential cohort", () => {
    expect(buildDemoBundle().activityCohort).toHaveLength(30);
  });

  it("rejects every non-D bundle because production promotion is out of MVP scope", () => {
    const candidate = structuredClone(buildDemoBundle());
    candidate.manifest.synthetic = false;
    candidate.manifest.maximumEvidenceGrade = "C";
    candidate.calibrationReport = {
      heldOutLocations: 3,
      directionalBlocks: 192,
      mdape: 0.36,
      wape: 0.30,
      intervalCoverage: 0.75,
      absoluteSignedWape: 0.10,
      worstEligibleStratumAbsoluteSignedWape: 0.20,
      independentDateReplication: true,
      claimInputsComplete: true,
      insideApplicabilityEnvelope: true,
      downstreamProtocolRegistered: true,
      downstreamValidation: {
        ots: true,
        targetOts: true,
        uniqueReach: false,
        influence: false,
      },
    };
    expect(() => validateFrozenBundle(candidate)).toThrow("MVP runtime accepts Evidence D only");
  });

  it("rejects a target whose universe or qi source is absent", () => {
    const candidate = structuredClone(buildDemoBundle());
    candidate.targets[0].qiSourceId = "missing-source";
    expect(() => validateFrozenBundle(candidate)).toThrow("Dangling target source");
  });

  it("rejects an absent or mis-versioned target-allocation source", () => {
    const absent = structuredClone(buildDemoBundle());
    absent.targetAllocationSourceIds.fmcg = "missing-allocation-source";
    expect(() => validateFrozenBundle(absent))
      .toThrow("Dangling target allocation source");

    const wrongKind = structuredClone(buildDemoBundle());
    const source = wrongKind.sourceManifest.find(
      (item) => item.id === wrongKind.targetAllocationSourceIds.fmcg,
    )!;
    source.kind = "influence";
    expect(() => validateFrozenBundle(wrongKind))
      .toThrow("Incompatible target allocation source");
  });

  it("rejects aggregate target allocation overflow in any scenario", () => {
    const candidate = structuredClone(buildDemoBundle());
    const shares = candidate.sites[0].targetShareBySector.fmcg;
    for (const cellId of Object.keys(shares)) shares[cellId] = 0.34;
    expect(() => validateFrozenBundle(candidate))
      .toThrow("Target shares exceed a probability bound");
  });
});
~~~

- [ ] **Step 5: Run the bundle test and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/bundle/frozenBundle.test.ts
~~~

Expected: FAIL because the bundle builder and validator do not exist.

- [ ] **Step 6: Define the complete frozen-bundle schema**

Create `src/bundle/bundleSchema.ts`:

~~~ts
import { z } from "zod";
import { DaypartSchema, EvidenceGradeSchema, SectorSchema } from "@/contracts/domain";

const ScoreSchema = z.object({
  A: z.number().min(0).max(100),
  C: z.number().min(0).max(100),
  P: z.number().min(0).max(100),
  E: z.number().min(0).max(100),
});

const EvidenceComponentsSchema = z.object({
  source: z.number().min(0).max(100),
  validation: z.number().min(0).max(100),
  temporal: z.number().min(0).max(100),
  granularityCoverage: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  minimumCritical: z.number().min(0).max(100),
  caps: z.array(z.number().min(0).max(100)).min(1),
  hasZeroCritical: z.boolean(),
});

export const FrozenBundleSchema = z.object({
  manifest: z.object({
    id: z.literal("lagos-demo-v1"),
    geographyId: z.literal("lagos-demo-v1"),
    schemaVersion: z.literal("1.0.0"),
    createdAt: z.literal("2026-08-03T12:00:00.000Z"),
    maximumEvidenceGrade: EvidenceGradeSchema,
    synthetic: z.boolean(),
    seed: z.literal(260803),
    modelVersion: z.literal("conditional-poisson-demo-v1"),
    featureSnapshotId: z.literal("lagos-synthetic-features-v1"),
    featureSchemaCompatibilityId: z.string().min(1),
    targetUniverseVersion: z.literal("lagos-target-universe-v1"),
    panelVersion: z.literal("weighted-panel-v1"),
    replicateSetId: z.literal("scenario-low-base-high-v1"),
    targetCellPartitionId: z.literal("mutually-exclusive-sector-cells-v1"),
    targetCellAssignmentRule: z.literal("ordered-first-match-with-residual-v1"),
    evidenceProfileVersion: z.literal("synthetic-evidence-profiles-v1"),
    scheduleModelVersion: z.literal("inclusive-daily-daypart-v1"),
    influenceLinkageAssumptionId: z.literal("conditional-independence-within-target-cell-v1"),
    influenceSensitivityId: z.literal("coherent-exposure-scaling-low-base-high-v1"),
    dataRevision: z.literal("lagos-demo-data-r1"),
  }),
  zones: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    center: z.tuple([z.number(), z.number()]),
  })).min(5),
  sites: z.array(z.object({
    id: z.string().min(1),
    zoneId: z.string().min(1),
    label: z.string().min(1),
    supplierId: z.string().min(1),
    coordinate: z.tuple([z.number(), z.number()]),
    format: z.enum(["static", "dooh"]),
    rateNgn: z.number().positive(),
    baseMovement: z.record(DaypartSchema, z.number().positive()),
    visibility: z.number().min(0).max(1),
    deliverySchedule: z.object({
      availabilityStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      availabilityEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      uptime: z.number().min(0).max(1),
      shareOfTime: z.number().min(0).max(1),
      availabilityRevision: z.string().min(1),
      uptimeRevision: z.string().min(1),
      shareOfTimeRevision: z.string().min(1),
    }),
    targetShareBySector: z.record(SectorSchema, z.record(z.string(), z.number().min(0).max(1))),
    planningScoresBySector: z.record(SectorSchema, ScoreSchema),
    available: z.boolean(),
  })).min(10),
  activityCohort: z.array(z.object({
    id: z.string().min(1),
    zoneId: z.string().min(1),
    value: z.number().positive(),
  })).min(30),
  targets: z.array(z.object({
    sector: SectorSchema,
    cellId: z.string().min(1),
    universe: z.number().positive(),
    universeSourceId: z.string().min(1),
    membership: z.literal("mutually_exclusive"),
    defaultQi: z.number().min(0).max(1),
    qiSourceId: z.string().min(1),
    defaultServiceability: z.number().min(0).max(1),
    serviceabilitySourceId: z.string().min(1),
  })).min(9),
  targetAllocationSourceIds: z.record(SectorSchema, z.string().min(1)),
  panel: z.array(z.object({
    id: z.string().min(1),
    sector: SectorSchema,
    cellId: z.string().min(1),
    weight: z.number().positive(),
    qi: z.number().min(0).max(1),
    serviceability: z.number().min(0).max(1),
    zoneAffinity: z.record(z.string(), z.number().positive()),
    timeAffinity: z.record(DaypartSchema, z.number().positive()),
  })).min(200),
  scenarios: z.array(z.object({
    id: z.enum(["low", "base", "high"]),
    movementMultiplier: z.number().positive(),
    visibilityMultiplier: z.number().positive(),
    targetShareMultiplier: z.number().positive(),
    propensityConcentration: z.number().positive(),
  })).length(3),
  scalingEnvelope: z.object({
    minimumC: z.number().positive(),
    maximumC: z.number().positive(),
    maximumMemberLambda: z.number().positive(),
    maximumAverageFrequency: z.number().positive(),
  }),
  featureRegistry: z.array(z.object({
    id: z.string().min(1),
    role: z.enum(["measurement", "score"]),
    pillar: z.enum(["A", "D", "C", "P", "E"]).nullable(),
  })),
  sourceManifest: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum([
      "inventory",
      "target_universe",
      "target_allocation",
      "influence",
      "serviceability",
    ]),
    sector: SectorSchema.nullable(),
    geographyId: z.literal("lagos-demo-v1"),
    productScope: z.enum(["all", "fmcg", "real_estate", "bank_fintech"]),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    provenance: z.literal("synthetic"),
    rendererEligibility: z.literal("maplibre"),
    modelUse: z.literal("demo_only"),
  })),
  evidenceProfiles: z.object({
    recommendation: EvidenceComponentsSchema,
    activityPotential: EvidenceComponentsSchema,
    movement: EvidenceComponentsSchema,
    generalOts: EvidenceComponentsSchema,
    targetOts: EvidenceComponentsSchema,
    reach: EvidenceComponentsSchema,
    influence: EvidenceComponentsSchema,
    serviceability: EvidenceComponentsSchema,
  }),
  calibrationReport: z.object({
    heldOutLocations: z.number().int().nonnegative(),
    directionalBlocks: z.number().int().nonnegative(),
    mdape: z.number().nonnegative(),
    wape: z.number().nonnegative(),
    intervalCoverage: z.number().min(0).max(1),
    absoluteSignedWape: z.number().nonnegative(),
    worstEligibleStratumAbsoluteSignedWape: z.number().nonnegative(),
    independentDateReplication: z.boolean(),
    claimInputsComplete: z.boolean(),
    insideApplicabilityEnvelope: z.boolean(),
    downstreamProtocolRegistered: z.boolean(),
    downstreamValidation: z.object({
      ots: z.boolean(),
      targetOts: z.boolean(),
      uniqueReach: z.boolean(),
      influence: z.boolean(),
    }),
  }).optional(),
});

export type FrozenBundle = z.infer<typeof FrozenBundleSchema>;
~~~

- [ ] **Step 7: Implement the deterministic bundle builder**

Create `scripts/build-demo-bundle.ts` with these exact constants and generation rules:

~~~ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrozenBundle } from "../src/bundle/bundleSchema";
import { validateFrozenBundle } from "../src/bundle/validateFrozenBundle";
import { canonicalJson } from "../src/shared/canonicalJson";

const zones = [
  { id: "yaba", label: "Yaba / Akoka", center: [3.3792, 6.5158] as [number, number] },
  { id: "ikeja", label: "Ikeja", center: [3.3515, 6.6018] as [number, number] },
  { id: "vi", label: "Victoria Island", center: [3.4219, 6.4281] as [number, number] },
  { id: "oshodi", label: "Oshodi", center: [3.3436, 6.5534] as [number, number] },
  { id: "lekki", label: "Lekki", center: [3.4723, 6.4698] as [number, number] },
];

const targetSeeds = {
  fmcg: [
    ["student_buyers_18_24", 250_000, 0.20, 0.82],
    ["household_nonstudent_buyers_25_44", 240_000, 0.30, 0.88],
    ["residual_convenience_nonstudent_nonhousehold", 310_000, 0.15, 0.91],
  ],
  real_estate: [
    ["diaspora_intenders", 60_000, 0.45, 0.38],
    ["resident_professional_intenders", 180_000, 0.28, 0.66],
    ["resident_nonprofessional_investors", 90_000, 0.40, 0.48],
  ],
  bank_fintech: [
    ["merchant_owner_users", 140_000, 0.35, 0.94],
    ["student_nonmerchant_users", 220_000, 0.18, 0.86],
    ["professional_nonmerchant_nonstudent_users", 280_000, 0.22, 0.92],
  ],
} as const;

// defaultQi and defaultServiceability seed heterogeneous panel members only.
// Runtime delivery uses member-level values, so a member may legitimately differ
// from its cell defaults and the validator must not force equality back onto it.

const dayparts = ["all_day", "am", "midday", "pm", "evening"] as const;
const sectors = ["fmcg", "real_estate", "bank_fintech"] as const;

export function buildDemoBundle(): FrozenBundle {
  const sites = zones.flatMap((zone, zoneIndex) =>
    [0, 1].map((faceIndex) => {
      const index = zoneIndex * 2 + faceIndex;
      const base = 48_000 + index * 7_500;
      return {
        id: zone.id + "-face-" + (faceIndex + 1),
        zoneId: zone.id,
        label: zone.label + " " + (faceIndex === 0 ? "corridor" : "junction"),
        supplierId: "supplier-" + ((index % 3) + 1),
        coordinate: [
          zone.center[0] + (faceIndex === 0 ? -0.004 : 0.004),
          zone.center[1] + (faceIndex === 0 ? 0.003 : -0.003),
        ] as [number, number],
        format: index % 3 === 0 ? "dooh" as const : "static" as const,
        rateNgn: 2_800_000 + index * 240_000,
        baseMovement: {
          all_day: base * 4,
          am: base,
          midday: base * 0.78,
          pm: base * 1.18,
          evening: base * 0.88,
        },
        visibility: 0.44 + (index % 4) * 0.06,
        deliverySchedule: {
          availabilityStart: "2026-01-01",
          availabilityEnd: "2027-12-31",
          uptime: index % 3 === 0 ? 0.90 : 1,
          shareOfTime: index % 3 === 0 ? 0.20 : 1,
          availabilityRevision: "synthetic-availability-r1",
          uptimeRevision: "synthetic-uptime-r1",
          shareOfTimeRevision: "synthetic-sot-r1",
        },
        targetShareBySector: Object.fromEntries(
          sectors.map((sector, sectorIndex) => [
            sector,
            Object.fromEntries(
              targetSeeds[sector].map(([cellId], cellIndex) => [
                cellId,
                0.16 + ((zoneIndex + sectorIndex + cellIndex + faceIndex) % 5) * 0.045,
              ]),
            ),
          ]),
        ),
        planningScoresBySector: Object.fromEntries(
          sectors.map((sector, sectorIndex) => [
            sector,
            {
              A: 55 + ((index + sectorIndex * 3) % 8) * 5,
              C: 50 + ((index * 2 + sectorIndex) % 9) * 5,
              P: 58 + ((zoneIndex + sectorIndex) % 7) * 5,
              E: 52 + ((9 - index + sectorIndex) % 8) * 5,
            },
          ]),
        ),
        available: true,
      };
    }),
  );

  const targets = sectors.flatMap((sector) =>
    targetSeeds[sector].map(([cellId, universe, qi, serviceability]) => ({
      sector,
      cellId,
      universe,
      universeSourceId: "synthetic-" + sector + "-target-universe-v1",
      membership: "mutually_exclusive" as const,
      defaultQi: qi,
      qiSourceId: "synthetic-" + sector + "-influence-v1",
      defaultServiceability: serviceability,
      serviceabilitySourceId: "synthetic-" + sector + "-serviceability-v1",
    })),
  );

  const activityCohort = zones.flatMap((zone, zoneIndex) =>
    Array.from({ length: 6 }, (_, locationIndex) => ({
      id: zone.id + "-activity-" + (locationIndex + 1),
      zoneId: zone.id,
      value: 34_000 + zoneIndex * 9_500 + locationIndex * 4_100,
    })),
  );

  const panel = targets.flatMap((target, targetIndex) =>
    Array.from({ length: 24 }, (_, memberIndex) => ({
      id: target.sector + "-" + target.cellId + "-" + String(memberIndex + 1).padStart(2, "0"),
      sector: target.sector,
      cellId: target.cellId,
      weight: target.universe / 24,
      qi: target.defaultQi,
      serviceability: target.defaultServiceability,
      zoneAffinity: Object.fromEntries(
        zones.map((zone, zoneIndex) => [
          zone.id,
          0.55 + ((memberIndex * 7 + zoneIndex * 3 + targetIndex) % 13) / 10,
        ]),
      ),
      timeAffinity: Object.fromEntries(
        dayparts.map((daypart, daypartIndex) => [
          daypart,
          0.70 + ((memberIndex * 5 + daypartIndex + targetIndex) % 9) / 10,
        ]),
      ),
    })),
  );

  return validateFrozenBundle({
    manifest: {
      id: "lagos-demo-v1",
      geographyId: "lagos-demo-v1",
      schemaVersion: "1.0.0",
      createdAt: "2026-08-03T12:00:00.000Z",
      maximumEvidenceGrade: "D",
      synthetic: true,
      seed: 260803,
      modelVersion: "conditional-poisson-demo-v1",
      featureSnapshotId: "lagos-synthetic-features-v1",
      featureSchemaCompatibilityId: "lagos-context-feature-schema-v1",
      targetUniverseVersion: "lagos-target-universe-v1",
      panelVersion: "weighted-panel-v1",
      replicateSetId: "scenario-low-base-high-v1",
      targetCellPartitionId: "mutually-exclusive-sector-cells-v1",
      targetCellAssignmentRule: "ordered-first-match-with-residual-v1",
      evidenceProfileVersion: "synthetic-evidence-profiles-v1",
      scheduleModelVersion: "inclusive-daily-daypart-v1",
      influenceLinkageAssumptionId: "conditional-independence-within-target-cell-v1",
      influenceSensitivityId: "coherent-exposure-scaling-low-base-high-v1",
      dataRevision: "lagos-demo-data-r1",
    },
    zones,
    sites,
    activityCohort,
    targets,
    targetAllocationSourceIds: Object.fromEntries(
      sectors.map((sector) => [
        sector,
        "synthetic-" + sector + "-target-allocation-v1",
      ]),
    ),
    panel,
    scenarios: [
      { id: "low", movementMultiplier: 0.86, visibilityMultiplier: 0.94, targetShareMultiplier: 0.95, propensityConcentration: 1 },
      { id: "base", movementMultiplier: 1, visibilityMultiplier: 1, targetShareMultiplier: 1, propensityConcentration: 1 },
      { id: "high", movementMultiplier: 1.14, visibilityMultiplier: 1.04, targetShareMultiplier: 1.05, propensityConcentration: 1 },
    ],
    scalingEnvelope: {
      minimumC: 0.000001,
      maximumC: 12,
      maximumMemberLambda: 8,
      maximumAverageFrequency: 12,
    },
    featureRegistry: [
      { id: "poi-attraction", role: "measurement", pillar: null },
      { id: "movement-output", role: "score", pillar: "D" },
      { id: "objective-match", role: "score", pillar: "A" },
      { id: "conversion-context", role: "score", pillar: "C" },
      { id: "portfolio-coverage", role: "score", pillar: "P" },
      { id: "relative-economics", role: "score", pillar: "E" },
    ],
    sourceManifest: [
      { id: "lagos-demo-synthetic-v1", kind: "inventory" as const, sector: null, productScope: "all" as const },
      ...sectors.flatMap((sector) => [
        { id: "synthetic-" + sector + "-influence-v1", kind: "influence" as const, sector, productScope: sector },
        { id: "synthetic-" + sector + "-target-universe-v1", kind: "target_universe" as const, sector, productScope: sector },
        { id: "synthetic-" + sector + "-target-allocation-v1", kind: "target_allocation" as const, sector, productScope: sector },
        { id: "synthetic-" + sector + "-serviceability-v1", kind: "serviceability" as const, sector, productScope: sector },
      ]),
    ].map((source) => ({
      ...source,
      geographyId: "lagos-demo-v1" as const,
      periodStart: "2026-01-01",
      periodEnd: "2027-12-31",
      provenance: "synthetic" as const,
      rendererEligibility: "maplibre" as const,
      modelUse: "demo_only" as const,
    })),
    evidenceProfiles: {
      recommendation: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 60,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      activityPotential: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      movement: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      generalOts: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      targetOts: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      reach: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 70, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      influence: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 65, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
      serviceability: {
        source: 25, validation: 25, temporal: 55, granularityCoverage: 50,
        completeness: 65, minimumCritical: 25, caps: [54], hasZeroCritical: false,
      },
    },
  });
}
~~~

Add a script footer that writes canonical JSON only when invoked directly:

~~~ts
const outputPath = resolve("src/demo/lagos-v1/bundle.json");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    canonicalJson(buildDemoBundle()) + "\n",
    "utf8",
  );
}
~~~

- [ ] **Step 8: Implement validation and loading**

Create `src/bundle/validateFrozenBundle.ts`:

~~~ts
import { FrozenBundleSchema, type FrozenBundle } from "@/bundle/bundleSchema";
import { evaluateEvidence } from "@/planning/evidence";
import { verifyFeatureRegistry } from "@/planning/featureRegistry";

export function validateFrozenBundle(input: unknown): FrozenBundle {
  const bundle = FrozenBundleSchema.parse(input);
  if (bundle.manifest.maximumEvidenceGrade !== "D") {
    throw new Error("MVP runtime accepts Evidence D only");
  }
  for (const [profileId, profile] of Object.entries(bundle.evidenceProfiles)) {
    const result = evaluateEvidence(profile);
    if (
      profile.source !== 25 ||
      profile.minimumCritical !== 25 ||
      Math.min(...profile.caps) > 54 ||
      result.score !== 40 ||
      result.grade !== "D"
    ) {
      throw new Error("Synthetic evidence profile must evaluate to 40/D: " + profileId);
    }
  }
  const scenariosById = new Map(bundle.scenarios.map((scenario) => [scenario.id, scenario]));
  if (
    scenariosById.size !== 3 ||
    !scenariosById.has("low") ||
    !scenariosById.has("base") ||
    !scenariosById.has("high")
  ) {
    throw new Error("Scenarios must contain exactly one Low, Base, and High row");
  }
  const lowScenario = scenariosById.get("low")!;
  const baseScenario = scenariosById.get("base")!;
  const highScenario = scenariosById.get("high")!;
  for (const key of [
    "movementMultiplier",
    "visibilityMultiplier",
    "targetShareMultiplier",
  ] as const) {
    if (!(lowScenario[key] <= baseScenario[key] && baseScenario[key] <= highScenario[key])) {
      throw new Error("Scenario exposure multipliers must be monotone: " + key);
    }
  }
  if (
    lowScenario.propensityConcentration !== baseScenario.propensityConcentration ||
    baseScenario.propensityConcentration !== highScenario.propensityConcentration
  ) {
    throw new Error("Scenario propensity shape must remain fixed for coherent delivery ranges");
  }
  verifyFeatureRegistry(bundle.featureRegistry);
  const sourceIds = new Set(bundle.sourceManifest.map((source) => source.id));
  const sourceById = new Map(bundle.sourceManifest.map((source) => [source.id, source]));
  const targetKeys = new Set<string>();
  for (const target of bundle.targets) {
    const targetKey = target.sector + "/" + target.cellId;
    if (targetKeys.has(targetKey)) throw new Error("Duplicate target cell: " + targetKey);
    targetKeys.add(targetKey);
    if (
      !sourceIds.has(target.universeSourceId) ||
      !sourceIds.has(target.qiSourceId) ||
      !sourceIds.has(target.serviceabilitySourceId)
    ) {
      throw new Error("Dangling target source: " + target.sector + "/" + target.cellId);
    }
    for (const [sourceId, kind] of [
      [target.universeSourceId, "target_universe"],
      [target.qiSourceId, "influence"],
      [target.serviceabilitySourceId, "serviceability"],
    ] as const) {
      const source = sourceById.get(sourceId)!;
      if (
        source.kind !== kind ||
        source.sector !== target.sector ||
        source.geographyId !== bundle.manifest.geographyId ||
        source.productScope !== target.sector ||
        source.periodStart > source.periodEnd
      ) {
        throw new Error("Incompatible target source: " + sourceId);
      }
    }
    const panelWeight = bundle.panel
      .filter((member) => member.sector === target.sector && member.cellId === target.cellId)
      .reduce((sum, member) => sum + member.weight, 0);
    if (Math.abs(panelWeight - target.universe) > 0.000001) {
      throw new Error("Panel weight does not equal universe: " + target.sector + "/" + target.cellId);
    }
  }
  const panelIds = new Set<string>();
  for (const member of bundle.panel) {
    if (panelIds.has(member.id)) throw new Error("Duplicate panel member: " + member.id);
    panelIds.add(member.id);
    if (!targetKeys.has(member.sector + "/" + member.cellId)) {
      throw new Error("Panel member outside target partition: " + member.id);
    }
  }
  for (const site of bundle.sites) {
    for (const sector of ["fmcg", "real_estate", "bank_fintech"] as const) {
      const allocationSourceId = bundle.targetAllocationSourceIds[sector];
      const allocationSource = sourceById.get(allocationSourceId);
      if (!allocationSource) {
        throw new Error("Dangling target allocation source: " + allocationSourceId);
      }
      if (
        allocationSource.kind !== "target_allocation" ||
        allocationSource.sector !== sector ||
        allocationSource.geographyId !== bundle.manifest.geographyId ||
        allocationSource.productScope !== sector ||
        allocationSource.periodStart > allocationSource.periodEnd
      ) {
        throw new Error("Incompatible target allocation source: " + allocationSourceId);
      }
      const expectedCells = bundle.targets
        .filter((target) => target.sector === sector)
        .map((target) => target.cellId)
        .sort();
      const actualCells = Object.keys(site.targetShareBySector[sector]).sort();
      if (actualCells.join("|") !== expectedCells.join("|")) {
        throw new Error("Target share partition mismatch: " + site.id + "/" + sector);
      }
      const shareTotal = Object.values(site.targetShareBySector[sector])
        .reduce((sum, share) => sum + share, 0);
      const exceedsScenarioAllocation = bundle.scenarios.some(
        (scenario) => shareTotal * scenario.targetShareMultiplier > 1,
      );
      if (shareTotal > 1 || exceedsScenarioAllocation) {
        throw new Error("Target shares exceed a probability bound: " + site.id + "/" + sector);
      }
    }
  }
  return bundle;
}
~~~

Create `src/bundle/loadFrozenBundle.ts`:

~~~ts
import bundleJson from "@/demo/lagos-v1/bundle.json";
import { validateFrozenBundle } from "@/bundle/validateFrozenBundle";

export const frozenLagosBundle = validateFrozenBundle(bundleJson);
~~~

Create `scripts/validate-frozen-bundle.ts`:

~~~ts
import bundleJson from "../src/demo/lagos-v1/bundle.json";
import { validateFrozenBundle } from "../src/bundle/validateFrozenBundle";
import { canonicalJson } from "../src/shared/canonicalJson";

const bundle = validateFrozenBundle(bundleJson);
const roundTrip = canonicalJson(bundle) + "\n";
const checkedIn = canonicalJson(bundleJson) + "\n";
if (roundTrip !== checkedIn) throw new Error("BUNDLE_NOT_CANONICAL");
console.log("Validated " + bundle.manifest.id + " with " + bundle.sites.length + " sites");
~~~

- [ ] **Step 9: Generate and validate the checked-in bundle**

Add scripts:

~~~json
{
  "scripts": {
    "bundle:build": "tsx scripts/build-demo-bundle.ts",
    "bundle:check": "tsx scripts/validate-frozen-bundle.ts"
  }
}
~~~

Install the script runner:

~~~bash
pnpm add -D tsx
pnpm bundle:build
pnpm test -- tests/unit/bundle/frozenBundle.test.ts tests/unit/planning/calibrationGate.test.ts
~~~

Expected: the JSON file is created, every test passes, and two consecutive bundle builds produce no Git diff.

- [ ] **Step 10: Commit**

~~~bash
git add package.json pnpm-lock.yaml scripts src/bundle src/demo/lagos-v1 src/planning/calibrationGate.ts tests/unit/bundle tests/unit/planning/calibrationGate.test.ts
git commit -m "feat: add frozen Lagos demo bundle"
~~~

## Task 4: Implement the six-stage causal measurement engine

**Files:**

- Create: `src/planning/activityPotential.ts`
- Create: `src/planning/claimLadder.ts`
- Create: `src/planning/movement.ts`
- Create: `src/planning/exposure.ts`
- Create: `src/planning/overlapPanel.ts`
- Create: `src/planning/influence.ts`
- Create: `src/planning/sourceEligibility.ts`
- Create: `src/planning/fingerprint.ts`
- Create: `src/planning/engine.ts`
- Test: `tests/unit/planning/measurementChain.test.ts`
- Test: `tests/unit/planning/claimLadder.test.ts`
- Test: `tests/unit/planning/reachProperties.test.ts`

- [ ] **Step 1: Write the failing causal-chain test**

Create `tests/unit/planning/measurementChain.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { estimatePackage } from "@/planning/engine";

const request = {
  sector: "fmcg" as const,
  daypart: "pm" as const,
  siteIds: ["yaba-face-1", "ikeja-face-1", "oshodi-face-1"],
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("estimatePackage", () => {
  it("runs coherent Low, Base, and High scenarios through the stable panel", () => {
    const result = estimatePackage(frozenLagosBundle, request);
    if (result.claim.kind !== "scenario_target_reach") {
      throw new Error("Expected scenario target reach, received " + result.claim.kind);
    }
    expect(result.claim.evidence).toBe("D");
    expect(result.evidence.uniqueReach).toMatchObject({ score: 40, grade: "D" });
    expect(result.evidence.influence).toMatchObject({ score: 40, grade: "D" });
    expect(result.claim.range.type).toBe("scenario");
    expect(result.claim.range.low).toBeLessThanOrEqual(result.claim.range.base);
    expect(result.claim.range.base).toBeLessThanOrEqual(result.claim.range.high);
    expect(result.influence?.kind).toBe("influence_capture");
    expect(result.stages.map((stage) => stage.id)).toEqual([
      "location", "places", "movement", "ots", "target", "unique",
    ]);
    expect(result.stages[0]).toMatchObject({ id: "location", state: "assumed" });
  });

  it("degrades to target OTS when panel scaling is outside its envelope", () => {
    const outside = structuredClone(frozenLagosBundle);
    outside.scalingEnvelope.maximumC = 0.0000011;
    const result = estimatePackage(outside, request);
    expect(result.claim.kind).toBe("target_ots");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "unique")?.state)
      .toBe("unavailable");
    expect(result.claim.caveats).toContain("Unique reach unavailable: SCALING_OUTSIDE_ENVELOPE");
  });

  it("reuses results only for an exact fingerprint", () => {
    const first = estimatePackage(frozenLagosBundle, request);
    const second = estimatePackage(frozenLagosBundle, request);
    const changed = estimatePackage(frozenLagosBundle, {
      ...request,
      siteIds: [...request.siteIds, "vi-face-1"],
    });
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).not.toBe(changed.fingerprint);
    expect(first.comparabilityKey).toBe(changed.comparabilityKey);
    expect(first.replay).toMatchObject({
      bundleId: "lagos-demo-v1",
      modelVersion: "conditional-poisson-demo-v1",
      featureSnapshotId: "lagos-synthetic-features-v1",
      overlapMethodId: "conditional-poisson-weighted-panel-v1",
      replicateSetId: "scenario-low-base-high-v1",
      seed: 260803,
    });
  });

  it("fingerprints every governed panel value while keeping reach comparability semantic", () => {
    const first = estimatePackage(frozenLagosBundle, request);
    const revisedQi = structuredClone(frozenLagosBundle);
    revisedQi.panel.find((member) => member.sector === "fmcg")!.qi -= 0.01;
    const second = estimatePackage(revisedQi, request);
    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(first.comparabilityKey).toBe(second.comparabilityKey);

    const revisedServiceability = structuredClone(frozenLagosBundle);
    revisedServiceability.panel.find((member) => member.sector === "fmcg")!
      .serviceability -= 0.01;
    expect(estimatePackage(revisedServiceability, request).fingerprint)
      .not.toBe(first.fingerprint);
  });

  it("changes comparability only when the mathematical feature schema changes", () => {
    const compatible = estimatePackage(frozenLagosBundle, request);
    const changedSchema = structuredClone(frozenLagosBundle);
    changedSchema.manifest.featureSchemaCompatibilityId = "lagos-context-feature-schema-v2";
    const changed = estimatePackage(changedSchema, request);
    expect(changed.comparabilityKey).not.toBe(compatible.comparabilityKey);
  });

  it("fingerprints allocation values and compares only matching allocation versions", () => {
    const baseline = estimatePackage(frozenLagosBundle, request);
    const revisedValues = structuredClone(frozenLagosBundle);
    revisedValues.sites.find((site) => site.id === request.siteIds[0])!
      .targetShareBySector.fmcg.student_buyers_18_24 -= 0.01;
    const valueChange = estimatePackage(revisedValues, request);
    expect(valueChange.fingerprint).not.toBe(baseline.fingerprint);
    expect(valueChange.comparabilityKey).toBe(baseline.comparabilityKey);

    const revisedVersion = structuredClone(revisedValues);
    const previousId = revisedVersion.targetAllocationSourceIds.fmcg;
    const nextId = "synthetic-fmcg-target-allocation-v2";
    revisedVersion.targetAllocationSourceIds.fmcg = nextId;
    revisedVersion.sourceManifest.push({
      ...revisedVersion.sourceManifest.find((source) => source.id === previousId)!,
      id: nextId,
    });
    const versionChange = estimatePackage(revisedVersion, request);
    expect(versionChange.fingerprint).not.toBe(valueChange.fingerprint);
    expect(versionChange.comparabilityKey).not.toBe(valueChange.comparabilityKey);
  });

  it("degrades incompatible target inputs to general OTS", () => {
    const expired = structuredClone(frozenLagosBundle);
    const universeSource = expired.sourceManifest.find(
      (source) => source.id === "synthetic-fmcg-target-universe-v1",
    )!;
    universeSource.periodEnd = "2026-08-31";
    const result = estimatePackage(expired, request);
    expect(result.claim.kind).toBe("general_ots");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "target")?.state)
      .toBe("unavailable");
    expect(result.stages.find((stage) => stage.id === "unique")?.state)
      .toBe("unavailable");
    expect(result.scenarios.every((scenario) =>
      scenario.targetOts === null &&
      scenario.reach === null &&
      scenario.influenceMass === null &&
      scenario.serviceableReach === null &&
      scenario.averageFrequency === null
    )).toBe(true);
  });

  it("degrades an unavailable flight schedule to movement", () => {
    const unavailable = structuredClone(frozenLagosBundle);
    unavailable.sites.find((site) => site.id === request.siteIds[0])!
      .deliverySchedule.availabilityEnd = "2026-08-31";
    const result = estimatePackage(unavailable, request);
    expect(result.claim.kind).toBe("movement");
    expect(result.influence).toBeNull();
    expect(result.stages.find((stage) => stage.id === "ots")?.state)
      .toBe("unavailable");
    expect(result.scenarios.every((scenario) =>
      scenario.targetOts === null &&
      scenario.reach === null &&
      scenario.influenceCapture === null &&
      scenario.influenceMass === null &&
      scenario.serviceableReach === null &&
      scenario.averageFrequency === null
    )).toBe(true);
  });

  it("materializes inclusive flight duration into target OTS", () => {
    const oneDay = estimatePackage(frozenLagosBundle, {
      ...request,
      flightStart: "2026-09-01",
      flightEnd: "2026-09-01",
    });
    const twoDays = estimatePackage(frozenLagosBundle, {
      ...request,
      flightStart: "2026-09-01",
      flightEnd: "2026-09-02",
    });
    expect(twoDays.scenarios[1].targetOts).toBeCloseTo(
      oneDay.scenarios[1].targetOts! * 2,
      8,
    );
    expect(twoDays.fingerprint).not.toBe(oneDay.fingerprint);
  });
});
~~~

- [ ] **Step 2: Run the causal-chain test and verify it fails**

Run:

~~~bash
pnpm test -- tests/unit/planning/measurementChain.test.ts
~~~

Expected: FAIL because the measurement engine does not exist.

- [ ] **Step 3: Implement movement and exposure primitives**

Create `src/planning/movement.ts`:

~~~ts
import type { Daypart } from "@/contracts/domain";

export function passageEvents(baseMovement: number, multiplier: number): number {
  if (baseMovement < 0 || multiplier <= 0) throw new Error("Invalid movement input");
  return baseMovement * multiplier;
}

export function inclusiveFlightDays(start: string, end: string): number {
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T00:00:00Z");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new Error("INVALID_FLIGHT_DATES");
  }
  const days = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (days > 366) throw new Error("FLIGHT_OUTSIDE_MVP_ENVELOPE");
  return days;
}

export function siteDeliveryCompatible(
  site: {
    available: boolean;
    deliverySchedule: { availabilityStart: string; availabilityEnd: string };
  },
  flightStart: string,
  flightEnd: string,
): boolean {
  return site.available &&
    site.deliverySchedule.availabilityStart <= flightStart &&
    site.deliverySchedule.availabilityEnd >= flightEnd;
}

export type ExposureBlock = {
  date: string;
  daypart: Exclude<Daypart, "all_day">;
  startMinute: number;
  endMinute: number;
  durationHours: number;
};

const windows: Record<ExposureBlock["daypart"], [number, number]> = {
  am: [360, 600],
  midday: [600, 900],
  pm: [900, 1140],
  evening: [1140, 1380],
};

export function materializeExposureBlocks(
  start: string,
  end: string,
  requestedDaypart: Daypart,
): ExposureBlock[] {
  const days = inclusiveFlightDays(start, end);
  const startMs = Date.parse(start + "T00:00:00Z");
  const dayparts: ExposureBlock["daypart"][] = requestedDaypart === "all_day"
    ? ["am", "midday", "pm", "evening"]
    : [requestedDaypart];
  return Array.from({ length: days }, (_, dayIndex) =>
    dayparts.map((daypart) => {
      const [startMinute, endMinute] = windows[daypart];
      return {
        date: new Date(startMs + dayIndex * 86_400_000).toISOString().slice(0, 10),
        daypart,
        startMinute,
        endMinute,
        durationHours: (endMinute - startMinute) / 60,
      };
    }),
  ).flat();
}
~~~

Create `src/planning/exposure.ts`:

~~~ts
export function generalOts(
  movement: number,
  visibility: number,
  delivery: number,
): number {
  if (visibility < 0 || visibility > 1) throw new Error("Visibility must be 0..1");
  if (delivery < 0 || delivery > 1) throw new Error("Delivery must be 0..1");
  return movement * visibility * delivery;
}

export function targetOts(ots: number, targetShare: number): number {
  if (targetShare < 0 || targetShare > 1) throw new Error("Target share must be 0..1");
  return ots * targetShare;
}
~~~

Create `src/planning/activityPotential.ts`:

~~~ts
export function activityPotential(value: number, frozenCohort: number[]): number | null {
  if (frozenCohort.length < 30) return null;
  const ordered = [...frozenCohort].sort((left, right) => left - right);
  const below = ordered.filter((item) => item < value).length;
  const equal = ordered.filter((item) => item === value).length;
  return 100 * (below + 0.5 * equal) / ordered.length;
}
~~~

- [ ] **Step 4: Implement every hard degradation as one pure claim-ceiling resolver**

Create `src/planning/claimLadder.ts`:

~~~ts
export type ClaimCeiling =
  | "context"
  | "activity_potential"
  | "movement"
  | "general_ots"
  | "target_ots"
  | "scenario_target_reach"
  | "calibrated_target_reach";

export type ClaimAvailability = {
  geocode: "precise" | "low_precision" | "unknown" | "not_needed";
  fallbackFacts: "seeded" | "uploaded" | "none";
  runtimeFailure: "none" | "enrichment_unavailable" | "quota_exceeded";
  calibration: "inside" | "outside" | "missing" | "failed" | "bundle_mismatch";
  activityPotentialAvailable: boolean;
  movementAvailable: boolean;
  movementUnit: "vehicle_passages" | "person_passages" | null;
  personConversionAvailable: boolean;
  orientationAvailable: boolean;
  viewZoneAvailable: boolean;
  schedule: "compatible" | "assumed" | "missing";
  visibilityAndDeliveryAvailable: boolean;
  targetUniverseAvailable: boolean;
  targetAllocationAvailable: boolean;
  overlap: "qualified" | "assumed" | "missing";
  qiAvailable: boolean;
};

export type ClaimResolution = {
  highest: ClaimCeiling;
  influenceEligible: boolean;
  evidenceCap: "C" | "D";
  reasonCode: string | null;
  recoveryAction: string | null;
};

function activityOrContext(
  input: ClaimAvailability,
  reasonCode: string,
  recoveryAction: string,
): ClaimResolution {
  return {
    highest: input.activityPotentialAvailable ? "activity_potential" : "context",
    influenceEligible: false,
    evidenceCap: "D",
    reasonCode,
    recoveryAction,
  };
}

export function resolveClaimLadder(input: ClaimAvailability): ClaimResolution {
  if (input.geocode === "unknown") {
    return {
      highest: "context",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: "UNKNOWN_ADDRESS",
      recoveryAction: "Supply or correct the location coordinate",
    };
  }
  if (input.geocode === "low_precision") {
    return {
      highest: "context",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: "LOW_PRECISION_GEOCODE",
      recoveryAction: "Supply an independently sourced precise coordinate",
    };
  }
  if (input.runtimeFailure !== "none" && input.fallbackFacts === "none") {
    return {
      highest: "context",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: input.runtimeFailure.toUpperCase(),
      recoveryAction: "Continue with seeded or customer-supplied facts",
    };
  }
  if (input.calibration !== "inside") {
    return activityOrContext(
      input,
      "CALIBRATION_" + input.calibration.toUpperCase(),
      input.calibration === "bundle_mismatch"
        ? "Load a feature-compatible calibration bundle"
        : "Use a passing bundle whose applicability includes this location",
    );
  }
  if (!input.movementAvailable || input.movementUnit === null) {
    return activityOrContext(
      input,
      "MOVEMENT_UNAVAILABLE",
      "Add an eligible movement observation or model input",
    );
  }
  const movementOnly =
    !input.orientationAvailable ||
    !input.viewZoneAvailable ||
    input.schedule === "missing" ||
    !input.visibilityAndDeliveryAvailable ||
    (input.movementUnit === "vehicle_passages" && !input.personConversionAvailable);
  if (movementOnly) {
    return {
      highest: "movement",
      influenceEligible: false,
      evidenceCap: "D",
      reasonCode: input.movementUnit === "vehicle_passages" && !input.personConversionAvailable
        ? "OCCUPANCY_CONVERSION_UNAVAILABLE"
        : "EXPOSURE_GEOMETRY_OR_SCHEDULE_UNAVAILABLE",
      recoveryAction: "Verify face orientation, view zone, delivery schedule, and any occupancy basis",
    };
  }
  if (!input.targetUniverseAvailable || !input.targetAllocationAvailable) {
    return {
      highest: "general_ots",
      influenceEligible: false,
      evidenceCap: input.schedule === "assumed" ? "D" : "C",
      reasonCode: "TARGET_BASIS_UNAVAILABLE",
      recoveryAction: "Attach a compatible target universe and allocation source",
    };
  }
  if (input.overlap === "missing") {
    return {
      highest: "target_ots",
      influenceEligible: false,
      evidenceCap: input.schedule === "assumed" ? "D" : "C",
      reasonCode: "OVERLAP_MODEL_UNAVAILABLE",
      recoveryAction: "Attach an eligible overlap model or show an assumed sensitivity scenario",
    };
  }
  const assumed = input.overlap === "assumed" || input.schedule === "assumed";
  return {
    highest: assumed ? "scenario_target_reach" : "calibrated_target_reach",
    influenceEligible: input.qiAvailable,
    evidenceCap: assumed ? "D" : "C",
    reasonCode: input.qiAvailable ? null : "QI_UNAVAILABLE",
    recoveryAction: input.qiAvailable
      ? null
      : "Attach a named category-specific influence propensity source",
  };
}
~~~

Create `tests/unit/planning/claimLadder.test.ts` with one accepted baseline and this table of degradations:

~~~ts
import { describe, expect, it } from "vitest";
import {
  resolveClaimLadder,
  type ClaimAvailability,
} from "@/planning/claimLadder";

const complete: ClaimAvailability = {
  geocode: "precise",
  fallbackFacts: "seeded",
  runtimeFailure: "none",
  calibration: "inside",
  activityPotentialAvailable: true,
  movementAvailable: true,
  movementUnit: "person_passages",
  personConversionAvailable: true,
  orientationAvailable: true,
  viewZoneAvailable: true,
  schedule: "assumed",
  visibilityAndDeliveryAvailable: true,
  targetUniverseAvailable: true,
  targetAllocationAvailable: true,
  overlap: "assumed",
  qiAvailable: true,
};

const cases: Array<[
  string,
  Partial<ClaimAvailability>,
  string,
  string,
]> = [
  ["low geocode", { geocode: "low_precision" }, "context", "LOW_PRECISION_GEOCODE"],
  ["unknown address", { geocode: "unknown" }, "context", "UNKNOWN_ADDRESS"],
  ["provider quota with no facts", { runtimeFailure: "quota_exceeded", fallbackFacts: "none" }, "context", "QUOTA_EXCEEDED"],
  ["no bundle", { calibration: "missing" }, "activity_potential", "CALIBRATION_MISSING"],
  ["outside geography", { calibration: "outside" }, "activity_potential", "CALIBRATION_OUTSIDE"],
  ["failed validation", { calibration: "failed" }, "activity_potential", "CALIBRATION_FAILED"],
  ["bundle mismatch", { calibration: "bundle_mismatch" }, "activity_potential", "CALIBRATION_BUNDLE_MISMATCH"],
  ["no orientation", { orientationAvailable: false }, "movement", "EXPOSURE_GEOMETRY_OR_SCHEDULE_UNAVAILABLE"],
  ["no schedule", { schedule: "missing" }, "movement", "EXPOSURE_GEOMETRY_OR_SCHEDULE_UNAVAILABLE"],
  ["vehicle flow only", { movementUnit: "vehicle_passages", personConversionAvailable: false }, "movement", "OCCUPANCY_CONVERSION_UNAVAILABLE"],
  ["no universe", { targetUniverseAvailable: false }, "general_ots", "TARGET_BASIS_UNAVAILABLE"],
  ["no overlap", { overlap: "missing" }, "target_ots", "OVERLAP_MODEL_UNAVAILABLE"],
];

describe("resolveClaimLadder", () => {
  it.each(cases)("degrades %s with a recovery action", (_, change, highest, reason) => {
    const resolution = resolveClaimLadder({ ...complete, ...change });
    expect(resolution.highest).toBe(highest);
    expect(resolution.reasonCode).toBe(reason);
    expect(resolution.recoveryAction).toBeTruthy();
  });

  it("keeps unique reach but disables Influence when qi is absent", () => {
    const resolution = resolveClaimLadder({ ...complete, qiAvailable: false });
    expect(resolution.highest).toBe("scenario_target_reach");
    expect(resolution.influenceEligible).toBe(false);
    expect(resolution.reasonCode).toBe("QI_UNAVAILABLE");
  });

  it("continues on seeded facts when enrichment is unavailable", () => {
    const resolution = resolveClaimLadder({
      ...complete,
      runtimeFailure: "enrichment_unavailable",
    });
    expect(resolution.highest).toBe("scenario_target_reach");
  });
});
~~~

The seeded engine calls the resolver with the complete Evidence-D availability record before calculating scenarios. Uploaded planning calls it from `applyUploadToDraft` in Task 8. UI selectors consume `ClaimResolution`; they never infer availability from a missing number.

- [ ] **Step 5: Implement source eligibility, exact fingerprints, and comparability keys**

Create `src/planning/sourceEligibility.ts` before the engine so Task 4 has no forward dependency on Task 5:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Sector } from "@/contracts/domain";

export type DeliveryScope = {
  sector: Sector;
  flightStart: string;
  flightEnd: string;
};

export function compatibleSource(
  bundle: FrozenBundle,
  sourceId: string,
  kind: "target_universe" | "target_allocation" | "influence" | "serviceability",
  scope: DeliveryScope,
): boolean {
  const source = bundle.sourceManifest.find((item) => item.id === sourceId);
  return Boolean(
    source &&
    source.kind === kind &&
    source.sector === scope.sector &&
    source.geographyId === bundle.manifest.geographyId &&
    source.productScope === scope.sector &&
    source.periodStart <= scope.flightStart &&
    source.periodEnd >= scope.flightEnd,
  );
}

export function targetProfileSourceIds(
  bundle: FrozenBundle,
  sector: Sector,
  field: "qiSourceId" | "serviceabilitySourceId",
): string[] {
  return [...new Set(bundle.targets
    .filter((target) => target.sector === sector)
    .map((target) => target[field]))].sort();
}

export function targetUniverseInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  const targets = bundle.targets.filter((target) => target.sector === scope.sector);
  return targets.length > 0 && targets.every((target) => compatibleSource(
    bundle, target.universeSourceId, "target_universe", scope,
  ));
}

export function targetAllocationInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  return compatibleSource(
    bundle,
    bundle.targetAllocationSourceIds[scope.sector],
    "target_allocation",
    scope,
  );
}

export function reachInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  return targetUniverseInputsCompatible(bundle, scope) &&
    targetAllocationInputsCompatible(bundle, scope);
}

export function serviceabilityInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  const targets = bundle.targets.filter((target) => target.sector === scope.sector);
  const sourceIds = targetProfileSourceIds(bundle, scope.sector, "serviceabilitySourceId");
  return targets.length > 0 && sourceIds.length === 1 && targets.every((target) =>
    compatibleSource(bundle, target.serviceabilitySourceId, "serviceability", scope)
  );
}

export function influenceInputsCompatible(
  bundle: FrozenBundle,
  scope: DeliveryScope,
): boolean {
  const targets = bundle.targets.filter((target) => target.sector === scope.sector);
  const sourceIds = targetProfileSourceIds(bundle, scope.sector, "qiSourceId");
  const denominator = bundle.panel
    .filter((member) => member.sector === scope.sector)
    .reduce((sum, member) => sum + member.weight * member.qi, 0);
  return targets.length > 0 && sourceIds.length === 1 &&
    targets.every((target) => compatibleSource(
      bundle, target.qiSourceId, "influence", scope,
    )) &&
    denominator > 0 &&
    bundle.manifest.influenceLinkageAssumptionId.length > 0 &&
    bundle.manifest.influenceSensitivityId.length > 0;
}
~~~

Create `src/planning/fingerprint.ts`:

~~~ts
import { canonicalJson } from "@/shared/canonicalJson";

function canonicalKey(namespace: string, value: unknown): string {
  // These keys are compared by full canonical equality. They are deliberately
  // not shortened to a collision-prone display hash.
  return namespace + "|" + canonicalJson(value);
}

export function exposurePlanFingerprint(
  bundle: FrozenBundle,
  request: {
    sector: Sector;
    daypart: Daypart;
    siteIds: string[];
    flightStart: string;
    flightEnd: string;
    flightDays: number;
    scheduleBlocks: ExposureBlock[];
    exposureThreshold: "1+";
  },
): string {
  // The demo favors exactness over compactness: full canonical bundle content plus
  // controls is the cache/RFQ identity. No shortened hash can collide. The UI only
  // shows a labelled prefix and exposes the complete value on demand.
  return canonicalKey("estimate-result-v2", {
    bundle,
    request: { ...request, siteIds: [...request.siteIds].sort() },
  });
}

export function reachComparabilityKey(input: {
  sector: string;
  geography: string;
  flightStart: string;
  flightEnd: string;
  basis: string;
  threshold: string;
  panelVersion: string;
  modelVersion: string;
  targetUniverseVersion: string;
  targetAllocationSourceId: string;
  featureSchemaCompatibilityId: string;
  replicateSetId: string;
  targetCellPartitionId: string;
  scheduleModelVersion: string;
  flightDays: number;
}): string {
  return canonicalKey("reach-comparability-v1", input);
}

export function objectiveDeliveryComparabilityKey(input: {
  reachComparabilityKey: string;
  objective: "broad_reach" | "influential_core" | "near_conversion";
  profileSourceIds: string[];
  assumptionIds: string[];
}): string {
  return canonicalKey("objective-delivery-comparability-v1", {
    ...input,
    profileSourceIds: [...input.profileSourceIds].sort(),
    assumptionIds: [...input.assumptionIds].sort(),
  });
}
~~~

The exact estimate key conservatively contains the complete validated frozen-bundle content plus the normalized request: site geography and movement, face visibility and schedules, target universes and allocations, panel weights/affinities/qi/serviceability, coherent scenarios, scaling envelope, evidence profiles, calibration report, source manifests, and every model/schema version. It uses full canonical equality, not a short non-cryptographic hash, so it can safely guard cache reuse and RFQ staleness. The reach comparability key deliberately excludes exact snapshot/data revisions: it records the mathematical target, allocation, panel, model, schedule, replicate, and compatible-feature-schema definitions. Each objective then derives its own comparability key by adding the governed profile and assumption IDs that define that delivery metric. A selector may subtract delivery only after both plans have been recomputed and the objective-specific keys match. Spreadsheet context has its own artifact fingerprint and never enters this exposure identity.

- [ ] **Step 6: Implement stable-panel scaling and overlap**

Create `src/planning/overlapPanel.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";

export type SiteTargetOts = {
  siteId: string;
  zoneId: string;
  blocks: Array<{
    blockId: string;
    daypart: Exclude<Daypart, "all_day">;
    byCell: Record<string, number>;
  }>;
};

export type PanelResult = {
  reach: number;
  targetOts: number;
  averageFrequency: number | null;
  influenceMass: number;
  influenceUniverse: number;
  serviceableReach: number;
};

export function runStablePanel(
  bundle: FrozenBundle,
  sector: Sector,
  siteInputs: SiteTargetOts[],
  propensityConcentration: number,
): PanelResult {
  let targetOtsTotal = 0;
  let reach = 0;
  let influenceMass = 0;
  let influenceUniverse = 0;
  let serviceableReach = 0;

  const targets = bundle.targets.filter((target) => target.sector === sector);
  for (const target of targets) {
    const members = bundle.panel.filter(
      (member) => member.sector === sector && member.cellId === target.cellId,
    );
    const lambdas = new Map(members.map((member) => [member.id, 0]));

    for (const siteInput of siteInputs) {
      for (const block of siteInput.blocks) {
        const siteTargetOts = block.byCell[target.cellId] ?? 0;
        targetOtsTotal += siteTargetOts;
        const bases = members.map((member) => ({
          member,
          value: Math.pow(
            member.zoneAffinity[siteInput.zoneId] * member.timeAffinity[block.daypart],
            propensityConcentration,
          ),
        }));
        const denominator = bases.reduce(
          (sum, item) => sum + item.member.weight * item.value,
          0,
        );
        if (siteTargetOts > 0 && denominator <= 0) {
          throw new Error("Zero panel propensity denominator");
        }
        const c = denominator === 0 ? 0 : siteTargetOts / denominator;
        if (
          siteTargetOts > 0 &&
          (c < bundle.scalingEnvelope.minimumC || c > bundle.scalingEnvelope.maximumC)
        ) {
          throw new Error("SCALING_OUTSIDE_ENVELOPE");
        }
        for (const item of bases) {
          const lambda = c * item.value;
          if (lambda > bundle.scalingEnvelope.maximumMemberLambda) {
            throw new Error("MEMBER_RATE_OUTSIDE_ENVELOPE");
          }
          lambdas.set(item.member.id, (lambdas.get(item.member.id) ?? 0) + lambda);
        }
      }
    }

    for (const member of members) {
      const probability = 1 - Math.exp(-(lambdas.get(member.id) ?? 0));
      reach += member.weight * probability;
      influenceMass += member.weight * member.qi * probability;
      influenceUniverse += member.weight * member.qi;
      serviceableReach += member.weight * member.serviceability * probability;
    }
  }

  const averageFrequency = reach > 0 ? targetOtsTotal / reach : null;
  if (
    averageFrequency !== null &&
    averageFrequency > bundle.scalingEnvelope.maximumAverageFrequency
  ) {
    throw new Error("FREQUENCY_OUTSIDE_ENVELOPE");
  }
  return {
    reach,
    targetOts: targetOtsTotal,
    averageFrequency,
    influenceMass,
    influenceUniverse,
    serviceableReach,
  };
}
~~~

- [ ] **Step 7: Implement Influence Capture**

Create `src/planning/influence.ts`:

~~~ts
export function influenceCapturePct(
  reachedInfluenceMass: number,
  influenceUniverse: number,
): number | null {
  if (influenceUniverse <= 0) return null;
  return 100 * reachedInfluenceMass / influenceUniverse;
}
~~~

- [ ] **Step 8: Implement the coherent scenario orchestrator**

Create `src/planning/engine.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Daypart, Sector } from "@/contracts/domain";
import type {
  EstimatePackageResult,
  MetricClaim,
  MetricEvidence,
  PanelFailureCode,
  ScenarioMeasurement,
} from "@/contracts/metrics";
import { MetricClaimSchema } from "@/contracts/metrics";
import { activityPotential } from "@/planning/activityPotential";
import { evaluateEvidence } from "@/planning/evidence";
import { generalOts, targetOts } from "@/planning/exposure";
import { resolveClaimLadder } from "@/planning/claimLadder";
import { exposurePlanFingerprint, reachComparabilityKey } from "@/planning/fingerprint";
import { influenceCapturePct } from "@/planning/influence";
import {
  inclusiveFlightDays,
  materializeExposureBlocks,
  passageEvents,
  siteDeliveryCompatible,
} from "@/planning/movement";
import {
  influenceInputsCompatible,
  serviceabilityInputsCompatible,
  targetAllocationInputsCompatible,
  targetUniverseInputsCompatible,
} from "@/planning/sourceEligibility";
import { runStablePanel } from "@/planning/overlapPanel";

export type EstimateRequest = {
  sector: Sector;
  daypart: Daypart;
  siteIds: string[];
  flightStart: string;
  flightEnd: string;
};

const panelFailures = new Set<PanelFailureCode>([
  "SCALING_OUTSIDE_ENVELOPE",
  "MEMBER_RATE_OUTSIDE_ENVELOPE",
  "FREQUENCY_OUTSIDE_ENVELOPE",
]);

function panelFailureCode(error: unknown): PanelFailureCode | null {
  if (!(error instanceof Error)) return null;
  return panelFailures.has(error.message as PanelFailureCode)
    ? error.message as PanelFailureCode
    : null;
}

const claimRank = {
  context: 0,
  activity_potential: 1,
  movement: 2,
  general_ots: 3,
  target_ots: 4,
  scenario_target_reach: 5,
  calibrated_target_reach: 6,
} as const;

function permits(
  highest: keyof typeof claimRank,
  required: keyof typeof claimRank,
): boolean {
  return claimRank[highest] >= claimRank[required];
}

export function estimatePackage(
  bundle: FrozenBundle,
  request: EstimateRequest,
): EstimatePackageResult {
  const selected = request.siteIds.map((id) => {
    const site = bundle.sites.find((candidate) => candidate.id === id);
    if (!site) throw new Error("Unknown site: " + id);
    return site;
  });
  const scheduleCompatible = selected.every((site) => siteDeliveryCompatible(
    site,
    request.flightStart,
    request.flightEnd,
  ));
  const flightDays = inclusiveFlightDays(request.flightStart, request.flightEnd);
  const scheduleBlocks = materializeExposureBlocks(
    request.flightStart,
    request.flightEnd,
    request.daypart,
  );
  const dataRevision = bundle.manifest.dataRevision;
  const targetUniverseAvailable = targetUniverseInputsCompatible(bundle, request);
  const targetAllocationAvailable = targetAllocationInputsCompatible(bundle, request);
  const influenceCompatible = influenceInputsCompatible(bundle, request);
  const serviceabilityCompatible = serviceabilityInputsCompatible(bundle, request);
  const inventorySourceIds = bundle.sourceManifest
    .filter((source) => source.kind === "inventory")
    .map((source) => source.id)
    .sort();
  const universeSourceIds = bundle.targets
    .filter((target) => target.sector === request.sector)
    .map((target) => target.universeSourceId);
  const allocationSourceIds = [bundle.targetAllocationSourceIds[request.sector]];
  const influenceSourceIds = [...new Set(bundle.targets
    .filter((target) => target.sector === request.sector)
    .map((target) => target.qiSourceId))].sort();
  const serviceabilitySourceIds = [...new Set(bundle.targets
    .filter((target) => target.sector === request.sector)
    .map((target) => target.serviceabilitySourceId))].sort();
  const movementSourceIds = [...new Set([
    ...inventorySourceIds,
    "feature:" + bundle.manifest.featureSnapshotId,
    "movement-model:" + bundle.manifest.modelVersion,
    "schedule-model:" + bundle.manifest.scheduleModelVersion,
  ])].sort();
  const targetOtsSourceIds = [...new Set([
    ...movementSourceIds,
    ...universeSourceIds,
    ...allocationSourceIds,
  ])].sort();
  const uniqueReachSourceIds = [...new Set([
    ...targetOtsSourceIds,
    "panel:" + bundle.manifest.panelVersion,
    "overlap-model:conditional-poisson-weighted-panel-v1",
    "replicate-set:" + bundle.manifest.replicateSetId,
  ])].sort();
  const influenceClaimSourceIds = [...new Set([
    ...uniqueReachSourceIds,
    ...influenceSourceIds,
    "influence-linkage:" + bundle.manifest.influenceLinkageAssumptionId,
    "influence-sensitivity:" + bundle.manifest.influenceSensitivityId,
  ])].sort();
  const serviceabilityClaimSourceIds = [...new Set([
    ...uniqueReachSourceIds,
    ...serviceabilitySourceIds,
  ])].sort();
  const claimResolution = resolveClaimLadder({
    geocode: "not_needed",
    fallbackFacts: "seeded",
    runtimeFailure: "none",
    calibration: "inside",
    activityPotentialAvailable: bundle.activityCohort.length >= 30,
    movementAvailable: true,
    movementUnit: "person_passages",
    personConversionAvailable: true,
    orientationAvailable: true,
    viewZoneAvailable: true,
    schedule: scheduleCompatible ? "assumed" : "missing",
    visibilityAndDeliveryAvailable: scheduleCompatible,
    targetUniverseAvailable,
    targetAllocationAvailable,
    overlap: "assumed",
    qiAvailable: influenceCompatible,
  });
  const canGeneralOts = permits(claimResolution.highest, "general_ots");
  const canTargetOts = permits(claimResolution.highest, "target_ots");
  const canUniqueReach = permits(claimResolution.highest, "scenario_target_reach");

  const scenarios: ScenarioMeasurement[] = bundle.scenarios.map((scenario) => {
    if (!canTargetOts) {
      return {
        id: scenario.id,
        reach: null,
        targetOts: null,
        influenceCapture: null,
        influenceMass: null,
        serviceableReach: null,
        averageFrequency: null,
        failureCode: null,
      };
    }
    const siteInputs = selected.map((site) => {
      const shares = site.targetShareBySector[request.sector];
      return {
        siteId: site.id,
        zoneId: site.zoneId,
        blocks: scheduleBlocks.map((block) => {
          const movement = passageEvents(
            site.baseMovement[block.daypart],
            scenario.movementMultiplier,
          );
          const ots = generalOts(
            movement,
            Math.min(1, site.visibility * scenario.visibilityMultiplier),
            site.deliverySchedule.uptime * site.deliverySchedule.shareOfTime,
          );
          return {
            blockId: block.date + "/" + block.daypart,
            daypart: block.daypart,
            byCell: Object.fromEntries(
              Object.entries(shares).map(([cellId, share]) => [
                cellId,
                targetOts(ots, share * scenario.targetShareMultiplier),
              ]),
            ),
          };
        }),
      };
    });
    const targetOtsValue = siteInputs.reduce(
      (siteSum, site) => siteSum + site.blocks.reduce(
        (blockSum, block) => blockSum + Object.values(block.byCell)
          .reduce((cellSum, value) => cellSum + value, 0),
        0,
      ),
      0,
    );
    if (!canUniqueReach) {
      return {
        id: scenario.id,
        reach: null,
        targetOts: targetOtsValue,
        influenceCapture: null,
        influenceMass: null,
        serviceableReach: null,
        averageFrequency: null,
        failureCode: null,
      };
    }
    try {
      const panel = runStablePanel(
        bundle,
        request.sector,
        siteInputs,
        scenario.propensityConcentration,
      );
      return {
        id: scenario.id,
        reach: panel.reach,
        targetOts: panel.targetOts,
        influenceCapture: influenceCompatible
          ? influenceCapturePct(panel.influenceMass, panel.influenceUniverse)
          : null,
        influenceMass: influenceCompatible ? panel.influenceMass : null,
        serviceableReach: serviceabilityCompatible ? panel.serviceableReach : null,
        averageFrequency: panel.averageFrequency,
        failureCode: null,
      };
    } catch (error) {
      const failureCode = panelFailureCode(error);
      if (!failureCode) throw error;
      return {
        id: scenario.id,
        reach: null,
        targetOts: targetOtsValue,
        influenceCapture: null,
        influenceMass: null,
        serviceableReach: null,
        averageFrequency: null,
        failureCode,
      };
    }
  });

  const low = scenarios.find((item) => item.id === "low")!;
  const base = scenarios.find((item) => item.id === "base")!;
  const high = scenarios.find((item) => item.id === "high")!;
  const universe = bundle.targets
    .filter((target) => target.sector === request.sector)
    .reduce((sum, target) => sum + target.universe, 0);
  const evidenceResults = {
    activityPotential: evaluateEvidence(bundle.evidenceProfiles.activityPotential),
    movement: evaluateEvidence(bundle.evidenceProfiles.movement),
    generalOts: evaluateEvidence(bundle.evidenceProfiles.generalOts),
    targetOts: evaluateEvidence(bundle.evidenceProfiles.targetOts),
    reach: evaluateEvidence(bundle.evidenceProfiles.reach),
    influence: evaluateEvidence(bundle.evidenceProfiles.influence),
    serviceability: evaluateEvidence(bundle.evidenceProfiles.serviceability),
  };
  const reachEvidence = evidenceResults.reach;
  const influenceEvidence = evidenceResults.influence;
  const serviceabilityEvidence = evidenceResults.serviceability;
  if (reachEvidence.grade !== "D") {
    throw new Error("SEEDED_REACH_EVIDENCE_NOT_D");
  }

  const baseScenarioDefinition = bundle.scenarios.find((scenario) => scenario.id === "base")!;
  const baseMovement = selected.reduce((siteSum, site) =>
    siteSum + scheduleBlocks.reduce((blockSum, block) => blockSum + passageEvents(
      site.baseMovement[block.daypart],
      baseScenarioDefinition.movementMultiplier,
    ), 0),
  0);
  const baseGeneralOts = selected.reduce((siteSum, site) =>
    siteSum + scheduleBlocks.reduce((blockSum, block) => blockSum + generalOts(
      passageEvents(
        site.baseMovement[block.daypart],
        baseScenarioDefinition.movementMultiplier,
      ),
      Math.min(1, site.visibility * baseScenarioDefinition.visibilityMultiplier),
      site.deliverySchedule.uptime * site.deliverySchedule.shareOfTime,
    ), 0),
  0);
  const hasReach = canUniqueReach &&
    scenarios.every((scenario) => scenario.reach !== null);
  const failureCode = scenarios.find((scenario) => scenario.failureCode)?.failureCode;
  const activityPotentialValue = activityPotential(
    baseMovement,
    bundle.activityCohort.map((location) => location.value),
  );
  const claim: MetricClaim = MetricClaimSchema.parse(hasReach
    ? {
        id: "target-reach",
        kind: "scenario_target_reach",
        label: "Scenario target reach",
        state: "assumed",
        evidence: reachEvidence.grade,
        unit: "people",
        universe,
        range: {
          type: "scenario",
          low: low.reach!,
          base: base.reach!,
          high: high.reach!,
        },
        sourceIds: uniqueReachSourceIds,
        caveats: ["Conditional-Poisson overlap scenario; not buying currency"],
        applicability: "inside",
      }
    : canTargetOts && base.targetOts !== null
      ? {
          id: "target-ots",
          kind: "target_ots",
          label: "Target opportunity to see",
          state: "assumed",
          evidence: evidenceResults.targetOts.grade,
          unit: "ots",
          value: base.targetOts,
          sourceIds: targetOtsSourceIds,
          caveats: ["Unique reach unavailable: " + (failureCode ?? claimResolution.reasonCode)],
          applicability: "outside",
        }
      : canGeneralOts
        ? {
            id: "general-ots",
            kind: "general_ots",
            label: "General opportunity to see",
            state: "modelled",
            evidence: evidenceResults.generalOts.grade,
            unit: "ots",
            value: baseGeneralOts,
            sourceIds: movementSourceIds,
            caveats: ["Target reach is unavailable because the target basis is incompatible"],
            applicability: "outside",
          }
        : permits(claimResolution.highest, "movement")
          ? {
              id: "movement",
              kind: "movement",
              label: "Modelled person movement",
              state: "modelled",
              evidence: evidenceResults.movement.grade,
              unit: "person_passages",
              value: baseMovement,
              sourceIds: movementSourceIds,
              caveats: ["OTS unavailable because the requested face schedule is incomplete"],
              applicability: "outside",
            }
          : activityPotentialValue !== null &&
              permits(claimResolution.highest, "activity_potential")
            ? {
                id: "activity-potential",
                kind: "activity_potential",
                label: "Activity Potential",
                state: "modelled",
                evidence: evidenceResults.activityPotential.grade,
                unit: "index_0_100",
                value: activityPotentialValue,
                sourceIds: movementSourceIds,
                caveats: ["Relative cohort index; not footfall or reach"],
                applicability: "outside",
              }
            : {
                id: "audience-delivery-unavailable",
                kind: "unavailable",
                label: "Audience delivery unavailable",
                state: "unavailable",
                evidence: "unavailable",
                unit: "none",
                reasonCode: claimResolution.reasonCode ?? "MEASUREMENT_INPUTS_UNAVAILABLE",
                sourceIds: [],
                caveats: ["No eligible audience-delivery claim can be made"],
                applicability: "unknown",
              });

  const hasInfluence = hasReach && influenceCompatible && claimResolution.influenceEligible &&
    influenceEvidence.grade === "D" && scenarios.every(
    (scenario) => scenario.influenceCapture !== null && scenario.influenceMass !== null,
  );
  const influence: MetricClaim | null = hasInfluence
    ? MetricClaimSchema.parse({
        id: "influence-capture",
        kind: "influence_capture",
        label: "Influence Capture",
        state: "assumed",
        evidence: influenceEvidence.grade,
        unit: "percent",
        qiSourceId: influenceSourceIds[0],
        range: {
          type: "scenario",
          low: low.influenceCapture!,
          base: base.influenceCapture!,
          high: high.influenceCapture!,
        },
        sourceIds: influenceClaimSourceIds,
        caveats: [
          "Exposure coverage of an assumed influence-weighted universe",
          "Conditional independence of influence propensity and exposure is assumed within each cell; Low/Base/High jointly vary movement and propensity concentration as the registered sensitivity",
        ],
        applicability: "inside",
      })
    : null;

  const hasServiceability = hasReach && serviceabilityCompatible &&
    serviceabilityEvidence.grade === "D" &&
    scenarios.every((scenario) => scenario.serviceableReach !== null);
  const unavailableEvidence: MetricEvidence = {
    score: 0,
    grade: "unavailable",
    sourceIds: [],
  };
  const evidenceForClaim = claim.kind === "activity_potential"
    ? evidenceResults.activityPotential
    : claim.kind === "movement"
      ? evidenceResults.movement
      : claim.kind === "general_ots"
        ? evidenceResults.generalOts
        : claim.kind === "target_ots"
          ? evidenceResults.targetOts
          : claim.kind === "scenario_target_reach" || claim.kind === "calibrated_target_reach"
            ? evidenceResults.reach
            : null;
  const permittedClaimEvidence: MetricEvidence = evidenceForClaim
    ? { ...evidenceForClaim, sourceIds: claim.sourceIds }
    : unavailableEvidence;
  const uniqueReachEvidence: MetricEvidence | null = hasReach
    ? { ...reachEvidence, sourceIds: uniqueReachSourceIds }
    : null;
  const influenceMetricEvidence: MetricEvidence | null = hasInfluence
    ? { ...influenceEvidence, sourceIds: influenceClaimSourceIds }
    : null;
  const serviceabilityMetricEvidence: MetricEvidence | null = hasServiceability
    ? { ...serviceabilityEvidence, sourceIds: serviceabilityClaimSourceIds }
    : null;

  const fingerprint = exposurePlanFingerprint(bundle, {
    sector: request.sector,
    daypart: request.daypart,
    siteIds: request.siteIds,
    flightStart: request.flightStart,
    flightEnd: request.flightEnd,
    flightDays,
    scheduleBlocks,
    exposureThreshold: "1+",
  });
  const comparabilityKey = reachComparabilityKey({
    sector: request.sector,
    geography: "lagos-demo-v1",
    flightStart: request.flightStart,
    flightEnd: request.flightEnd,
    basis: "target-ots",
    threshold: "1+",
    panelVersion: bundle.manifest.panelVersion,
    modelVersion: bundle.manifest.modelVersion,
    targetUniverseVersion: bundle.manifest.targetUniverseVersion,
    targetAllocationSourceId: bundle.targetAllocationSourceIds[request.sector],
    featureSchemaCompatibilityId: bundle.manifest.featureSchemaCompatibilityId,
    replicateSetId: bundle.manifest.replicateSetId,
    targetCellPartitionId: bundle.manifest.targetCellPartitionId,
    scheduleModelVersion: bundle.manifest.scheduleModelVersion,
    flightDays,
  });

  return {
    claim,
    influence,
    evidence: {
      permittedClaim: permittedClaimEvidence,
      uniqueReach: uniqueReachEvidence,
      influence: influenceMetricEvidence,
      serviceability: serviceabilityMetricEvidence,
    },
    availability: {
      influence: hasInfluence
        ? { reasonCode: null, recoveryAction: null }
        : !hasReach
          ? {
              reasonCode: "UNIQUE_REACH_UNAVAILABLE",
              recoveryAction: "Restore an eligible unique-reach basis first",
            }
          : !influenceCompatible
            ? {
                reasonCode: "INFLUENCE_PROFILE_INCOMPATIBLE",
                recoveryAction: "Provide a current governed qi profile for this sector and flight",
              }
            : {
                reasonCode: "INFLUENCE_EVIDENCE_UNAVAILABLE",
                recoveryAction: "Restore an eligible influence evidence profile",
              },
      serviceability: hasServiceability
        ? { reasonCode: null, recoveryAction: null }
        : !hasReach
          ? {
              reasonCode: "UNIQUE_REACH_UNAVAILABLE",
              recoveryAction: "Restore an eligible unique-reach basis first",
            }
          : !serviceabilityCompatible
            ? {
                reasonCode: "SERVICEABILITY_PROFILE_INCOMPATIBLE",
                recoveryAction: "Provide a current governed serviceability profile for this sector and flight",
              }
            : {
                reasonCode: "SERVICEABILITY_EVIDENCE_UNAVAILABLE",
                recoveryAction: "Restore an eligible serviceability evidence profile",
              },
    },
    scenarios,
    stages: [
      {
        id: "location",
        state: "assumed",
        valueText: selected.length + " selected synthetic media faces",
        sourceLabel: "Lagos synthetic inventory",
        freshnessLabel: bundle.manifest.createdAt.slice(0, 10),
        transformation: "Selected IDs resolved to frozen coordinates and faces",
        nextMapping: "Coordinates join the frozen context snapshot",
        caveats: ["Synthetic demo inventory"],
        recoveryAction: null,
      },
      {
        id: "places",
        state: "assumed",
        valueText: "Frozen contextual attraction inputs",
        sourceLabel: bundle.manifest.featureSnapshotId,
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "Context features feed movement predictors; they are not footfall",
        nextMapping: "Predictors enter the movement scenario",
        caveats: ["Nearby destinations imply context, not observed visits"],
        recoveryAction: null,
      },
      {
        id: "movement",
        state: "modelled",
        valueText: String(Math.round(baseMovement)) + " person passages",
        sourceLabel: bundle.manifest.modelVersion,
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "Frozen movement × coherent Base scenario multiplier",
        nextMapping: "Movement is filtered by visibility and delivery",
        caveats: ["Scenario movement; not a live traffic count"],
        recoveryAction: null,
      },
      {
        id: "ots",
        state: canGeneralOts ? "modelled" : "unavailable",
        valueText: canGeneralOts
          ? String(Math.round(baseGeneralOts)) + " general OTS"
          : "OTS unavailable",
        sourceLabel: bundle.manifest.modelVersion,
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "Movement × visibility × delivery",
        nextMapping: "General OTS is allocated to target cells",
        caveats: canGeneralOts
          ? ["Opportunity to see is not unique people"]
          : ["Selected-face availability does not cover the requested flight"],
        recoveryAction: canGeneralOts
          ? null
          : "Replace the unavailable face or change the flight dates",
      },
      {
        id: "target",
        state: base.targetOts !== null ? "assumed" : "unavailable",
        valueText: base.targetOts !== null
          ? String(Math.round(base.targetOts)) + " target OTS"
          : "Target OTS unavailable",
        sourceLabel: bundle.manifest.targetUniverseVersion,
        freshnessLabel: bundle.manifest.dataRevision,
        transformation: "General OTS × sector and cell allocation",
        nextMapping: "Target OTS scales the stable overlap panel",
        caveats: targetUniverseAvailable && targetAllocationAvailable
          ? ["Target allocation is assumed in the seeded bundle"]
          : ["A compatible target universe and allocation source are both required"],
        recoveryAction: base.targetOts !== null
          ? null
          : claimResolution.recoveryAction,
      },
      {
        id: "unique",
        state: hasReach ? "assumed" : "unavailable",
        valueText: hasReach
          ? String(Math.round(base.reach!)) + " target people 1+"
          : "Unique reach unavailable",
        sourceLabel: "conditional-poisson-weighted-panel-v1",
        freshnessLabel: bundle.manifest.replicateSetId,
        transformation: "Stable member propensities → 1 − exp(−Σλ)",
        nextMapping: "Eligible unique delivery enters the objective Delivery pillar once",
        caveats: claim.caveats,
        recoveryAction: hasReach
          ? null
          : claimResolution.recoveryAction ?? "Return to Target OTS or fit an eligible overlap model",
      },
    ],
    fingerprint,
    comparabilityKey,
    replay: {
      bundleId: bundle.manifest.id,
      bundleSchemaVersion: bundle.manifest.schemaVersion,
      modelVersion: bundle.manifest.modelVersion,
      featureSnapshotId: bundle.manifest.featureSnapshotId,
      featureSchemaCompatibilityId: bundle.manifest.featureSchemaCompatibilityId,
      evidenceProfileVersion: bundle.manifest.evidenceProfileVersion,
      scheduleModelVersion: bundle.manifest.scheduleModelVersion,
      influenceLinkageAssumptionId: bundle.manifest.influenceLinkageAssumptionId,
      influenceSensitivityId: bundle.manifest.influenceSensitivityId,
      sourceManifestIds: bundle.sourceManifest.map((source) => source.id).sort(),
      enrichmentSnapshotId: null,
      dataRevision,
      exposurePlanFingerprint: fingerprint,
      comparabilityKey,
      overlapMethodId: "conditional-poisson-weighted-panel-v1",
      replicateSetId: bundle.manifest.replicateSetId,
      seed: bundle.manifest.seed,
      controls: {
        sector: request.sector,
        daypart: request.daypart,
        flightStart: request.flightStart,
        flightEnd: request.flightEnd,
        flightDays,
        scheduleBlocks,
        siteIds: [...request.siteIds].sort(),
        exposureThreshold: "1+",
      },
    },
  };
}
~~~

- [ ] **Step 9: Add property tests for reach invariants**

Create `tests/unit/planning/reachProperties.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { estimatePackage } from "@/planning/engine";

const baseRequest = {
  sector: "fmcg" as const,
  daypart: "pm" as const,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("reach invariants", () => {
  it("keeps reach within universe and compatible target OTS", () => {
    const result = estimatePackage(frozenLagosBundle, {
      ...baseRequest,
      siteIds: ["yaba-face-1", "ikeja-face-1", "oshodi-face-1"],
    });
    const universe = result.claim.kind === "scenario_target_reach"
      ? result.claim.universe
      : 0;
    for (const scenario of result.scenarios) {
      expect(scenario.reach).not.toBeNull();
      expect(scenario.reach!).toBeLessThanOrEqual(universe);
      expect(scenario.reach!).toBeLessThanOrEqual(scenario.targetOts);
      expect(scenario.averageFrequency!).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps add/remove reach monotone for fixed delivery subsets", () => {
    const ids = frozenLagosBundle.sites.map((site) => site.id);
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: 0, max: ids.length - 1 }), {
        minLength: 1,
        maxLength: 4,
      }),
      fc.integer({ min: 0, max: ids.length - 1 }),
      (indices, extraIndex) => {
        fc.pre(!indices.includes(extraIndex));
        const selected = indices.map((index) => ids[index]);
        const smaller = estimatePackage(frozenLagosBundle, {
          ...baseRequest,
          siteIds: selected,
        });
        const larger = estimatePackage(frozenLagosBundle, {
          ...baseRequest,
          siteIds: [...selected, ids[extraIndex]],
        });
        expect(larger.scenarios[1].reach!)
          .toBeGreaterThanOrEqual(smaller.scenarios[1].reach!);
        expect(smaller.scenarios[1].reach!)
          .toBeLessThanOrEqual(larger.scenarios[1].reach!);
      },
    ), { seed: 260803, numRuns: 75 });
  });

  it("keeps every exact leave-one-out marginal non-negative", () => {
    const siteIds = ["yaba-face-1", "ikeja-face-1", "oshodi-face-1", "vi-face-1"];
    const full = estimatePackage(frozenLagosBundle, { ...baseRequest, siteIds });
    for (const removed of siteIds) {
      const reduced = estimatePackage(frozenLagosBundle, {
        ...baseRequest,
        siteIds: siteIds.filter((siteId) => siteId !== removed),
      });
      expect(full.scenarios[1].reach! - reduced.scenarios[1].reach!)
        .toBeGreaterThanOrEqual(0);
    }
  });
});
~~~

- [ ] **Step 10: Run the measurement suite**

Run:

~~~bash
pnpm test -- tests/unit/planning/claimLadder.test.ts tests/unit/planning/measurementChain.test.ts tests/unit/planning/reachProperties.test.ts
pnpm typecheck
~~~

Expected: all tests PASS. No output contains percentile terminology for the seeded scenario.

- [ ] **Step 11: Commit**

~~~bash
git add src/planning tests/unit/planning/measurementChain.test.ts tests/unit/planning/reachProperties.test.ts
git commit -m "feat: add causal reach and influence engine"
~~~

## Task 5: Implement objective scoring and bounded package optimisation

**Files:**

- Modify: `src/contracts/domain.ts`
- Create: `src/planning/planningFit.ts`
- Create: `src/planning/objectiveDelivery.ts`
- Create: `src/planning/packageOptimizer.ts`
- Test: `tests/unit/planning/planningFit.test.ts`
- Test: `tests/unit/planning/optimizerProperties.test.ts`

- [ ] **Step 1: Add plan-domain records**

Append to `src/contracts/domain.ts`:

~~~ts
export type Brief = {
  productName: string;
  productDescription: string;
  targetAudience: string;
  sector: Sector;
  objective: Objective;
  daypart: Daypart;
  budgetNgn: number;
  normalizationBudgetNgn: number;
  flightStart: string;
  flightEnd: string;
};

export type PillarScores = {
  A: number;
  D: number;
  C: number;
  P: number;
  E: number;
};

export type PlanMode = "planning_fit" | "context_shortlist";

export type PlanContextRevision = {
  mode: "context_shortlist";
  decisionUse: "context_only";
  selectedRowIds: string[];
  selectedRows: Array<{
    rowId: string;
    assetId: string;
    supplier: string | null;
    address: string | null;
    format: string | null;
    rateNgn: number | null;
    coordinate: {
      value: [number, number];
      provider: "customer" | "google" | "mapbox";
      accuracy: string;
      license: string;
      sourceArtifactId: string;
    } | null;
  }>;
  enrichmentSnapshotId: string;
  dataRevision: string;
  fingerprint: string;
  claimResolution: import("@/planning/claimLadder").ClaimResolution;
  planningFit: null;
};

export type PackageCandidate = {
  id: string;
  siteIds: string[];
  zoneIds: string[];
  costNgn: number;
  pillars: PillarScores | null;
  planningFit: number | null;
  deliveryRaw: number | null;
  evidenceScore: number;
  evidenceGrade: EvidenceGrade;
  valid: boolean;
  invalidReasonCodes: string[];
  mode: PlanMode;
  contextReason: string | null;
  contextRankScore: number | null;
  estimateFingerprint: string | null;
};

export type PlanningResult = {
  brief: Brief;
  recommended: PackageCandidate;
  internalReplacements: PackageCandidate[];
  selectedZoneIds: string[];
  measurement: import("@/contracts/metrics").EstimatePackageResult | null;
  objectiveDelivery: import("@/planning/objectiveDelivery").ObjectiveDelivery;
  replay: import("@/contracts/metrics").ReplayEnvelope | null;
  planFingerprint: string;
  dataRevision: string;
  contextRevision: PlanContextRevision | null;
};
~~~

- [ ] **Step 2: Write failing Planning Fit tests**

Create `tests/unit/planning/planningFit.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { objectiveWeights, planningFit } from "@/planning/planningFit";

describe("Planning Fit", () => {
  it("uses the approved objective weights", () => {
    expect(objectiveWeights.broad_reach).toEqual({ A: 20, D: 35, C: 15, P: 20, E: 10 });
    expect(objectiveWeights.influential_core).toEqual({ A: 25, D: 35, C: 20, P: 10, E: 10 });
    expect(objectiveWeights.near_conversion).toEqual({ A: 25, D: 15, C: 35, P: 10, E: 15 });
  });

  it("keeps Economics inside Planning Fit and evidence outside it", () => {
    expect(planningFit(
      { A: 80, D: 70, C: 60, P: 50, E: 40 },
      "broad_reach",
    )).toBe(63.5);
  });
});
~~~

- [ ] **Step 3: Run the score test and verify it fails**

Run:

~~~bash
pnpm test -- tests/unit/planning/planningFit.test.ts
~~~

Expected: FAIL because the Planning Fit module does not exist.

- [ ] **Step 4: Implement the fixed presets and normalization**

Create `src/planning/planningFit.ts`:

~~~ts
import type { Objective, PillarScores } from "@/contracts/domain";

export const objectiveWeights: Record<Objective, PillarScores> = {
  broad_reach: { A: 20, D: 35, C: 15, P: 20, E: 10 },
  influential_core: { A: 25, D: 35, C: 20, P: 10, E: 10 },
  near_conversion: { A: 25, D: 15, C: 35, P: 10, E: 15 },
};

export function percentileRank(value: number, cohort: number[]): number {
  if (cohort.length === 0) throw new Error("EMPTY_NORMALIZATION_COHORT");
  const below = cohort.filter((candidate) => candidate < value).length;
  const equal = cohort.filter((candidate) => candidate === value).length;
  return 100 * (below + 0.5 * equal) / cohort.length;
}

export function percentileRanks(values: number[]): number[] {
  return values.map((value) => percentileRank(value, values));
}

export function planningFit(scores: PillarScores, objective: Objective): number {
  const weights = objectiveWeights[objective];
  return (
    weights.A * scores.A +
    weights.D * scores.D +
    weights.C * scores.C +
    weights.P * scores.P +
    weights.E * scores.E
  ) / 100;
}
~~~

- [ ] **Step 5: Write failing optimiser tests**

Create `tests/unit/planning/optimizerProperties.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import {
  comparePackageCandidates,
  optimizePackage,
} from "@/planning/packageOptimizer";
import { evidenceScore } from "@/planning/evidence";

const brief = {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg" as const,
  objective: "broad_reach" as const,
  daypart: "pm" as const,
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("optimizePackage", () => {
  it("returns one package across exactly three selected zones", () => {
    const result = optimizePackage(frozenLagosBundle, brief);
    expect(result.recommended.zoneIds).toHaveLength(3);
    expect(result.internalReplacements).toHaveLength(2);
    expect(result.recommended.costNgn).toBeLessThanOrEqual(brief.budgetNgn);
    expect(result.recommended.evidenceScore).toBe(
      evidenceScore(frozenLagosBundle.evidenceProfiles.recommendation),
    );
    expect(result.recommended.evidenceScore).toBe(40);
    expect(result.recommended.evidenceScore).not.toBe(54);
    expect(result.recommended.evidenceGrade).toBe("D");
  });

  it("returns a repairable invalid result instead of throwing below minimum cost", () => {
    const result = optimizePackage(frozenLagosBundle, { ...brief, budgetNgn: 1 });
    expect(result.recommended.valid).toBe(false);
    expect(result.recommended.invalidReasonCodes).toContain("BUDGET_EXCEEDED");
    expect(result.recommended.siteIds.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the best objective score non-decreasing for nested budget sets", () => {
    fc.assert(fc.property(
      fc.integer({ min: 15, max: 18 }),
      fc.integer({ min: 0, max: 4 }),
      (lowerMillions, deltaMillions) => {
        const smaller = optimizePackage(frozenLagosBundle, {
          ...brief,
          budgetNgn: lowerMillions * 1_000_000,
        });
        const larger = optimizePackage(frozenLagosBundle, {
          ...brief,
          budgetNgn: (lowerMillions + deltaMillions) * 1_000_000,
        });
        expect(larger.recommended.planningFit!)
          .toBeGreaterThanOrEqual(smaller.recommended.planningFit!);
      },
    ), { seed: 260803, numRuns: 30 });
  });

  it("uses influence mass as the one Delivery input for Influential core", () => {
    const result = optimizePackage(frozenLagosBundle, {
      ...brief,
      objective: "influential_core",
    });
    expect(result.recommended.deliveryRaw).toBe(
      result.measurement.scenarios[1].influenceMass,
    );
  });

  it("accepts an individual zero qi when compatible influence mass remains", () => {
    const candidate = structuredClone(frozenLagosBundle);
    candidate.panel.find((member) => member.sector === "fmcg")!.qi = 0;
    const result = optimizePackage(candidate, {
      ...brief,
      objective: "influential_core",
    });
    expect(result.recommended.mode).toBe("planning_fit");
    expect(result.measurement.influence).not.toBeNull();
  });

  it("breaks exact score ties by evidence, cost, then stable ID", () => {
    const template = optimizePackage(frozenLagosBundle, brief).recommended;
    const tied = [
      { ...template, id: "b", evidenceScore: 60, costNgn: 11_000_000 },
      { ...template, id: "a", evidenceScore: 60, costNgn: 11_000_000 },
      { ...template, id: "c", evidenceScore: 61, costNgn: 12_000_000 },
      { ...template, id: "d", evidenceScore: 60, costNgn: 10_000_000 },
    ].sort(comparePackageCandidates);
    expect(tied.map((candidate) => candidate.id)).toEqual(["c", "d", "a", "b"]);
  });
});
~~~

- [ ] **Step 6: Run optimiser tests and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/planning/optimizerProperties.test.ts
~~~

Expected: FAIL because the optimiser does not exist.

- [ ] **Step 7: Implement one objective-delivery gate and bounded deterministic enumeration**

Create `src/planning/objectiveDelivery.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { Brief } from "@/contracts/domain";
import type { EstimatePackageResult } from "@/contracts/metrics";
import { objectiveDeliveryComparabilityKey } from "@/planning/fingerprint";
import {
  influenceInputsCompatible,
  reachInputsCompatible,
  serviceabilityInputsCompatible,
  targetProfileSourceIds,
} from "@/planning/sourceEligibility";

type ObjectiveDeliveryBase = {
  objective: Brief["objective"];
  metric: "target_reach" | "influence_weighted_reached_mass" | "serviceable_target_reach";
  label: string;
  unit: "people" | "influence_weighted_people";
  sourceIds: string[];
};

export type ObjectiveDelivery = ObjectiveDeliveryBase & ({
  status: "eligible";
  range: { low: number; base: number; high: number };
  value: number;
  evidence: NonNullable<EstimatePackageResult["evidence"]["uniqueReach"]>;
  comparabilityKey: string;
  reasonCode: null;
  recoveryAction: null;
} | {
  status: "unavailable";
  range: null;
  value: null;
  evidence: null;
  comparabilityKey: null;
  reasonCode: string;
  recoveryAction: string;
});

export function resolveObjectiveDelivery(
  bundle: FrozenBundle,
  brief: Brief,
  measurement: EstimatePackageResult,
): ObjectiveDelivery {
  const label = brief.objective === "influential_core"
    ? "Influence-weighted reached mass"
    : brief.objective === "near_conversion"
      ? "Serviceable target reach"
      : "Target reach";
  const unit = brief.objective === "influential_core"
    ? "influence_weighted_people" as const
    : "people" as const;
  const metric = brief.objective === "influential_core"
    ? "influence_weighted_reached_mass" as const
    : brief.objective === "near_conversion"
      ? "serviceable_target_reach" as const
      : "target_reach" as const;
  const unavailable = (
    reasonCode: string,
    recoveryAction: string,
  ): ObjectiveDelivery => ({
    status: "unavailable",
    objective: brief.objective,
    metric,
    label,
    unit,
    range: null,
    value: null,
    evidence: null,
    sourceIds: [],
    comparabilityKey: null,
    reasonCode,
    recoveryAction,
  });
  if (!reachInputsCompatible(bundle, brief)) {
    return unavailable(
      "TARGET_BASIS_INCOMPATIBLE",
      "Provide current compatible target-universe and allocation sources",
    );
  }
  if (
    !["scenario_target_reach", "calibrated_target_reach"].includes(
      measurement.claim.kind,
    ) ||
    measurement.evidence.uniqueReach === null
  ) {
    return unavailable(
      "UNIQUE_REACH_UNAVAILABLE",
      measurement.stages.find((stage) => stage.id === "unique")?.recoveryAction ??
        "Restore an eligible unique-reach basis",
    );
  }
  const profileSourceIds = brief.objective === "influential_core"
    ? targetProfileSourceIds(bundle, brief.sector, "qiSourceId")
    : brief.objective === "near_conversion"
      ? targetProfileSourceIds(bundle, brief.sector, "serviceabilitySourceId")
      : [];
  const assumptionIds = brief.objective === "influential_core"
    ? [
        bundle.manifest.influenceLinkageAssumptionId,
        bundle.manifest.influenceSensitivityId,
      ]
    : [];
  const valueFor = (id: "low" | "base" | "high") => {
    const scenario = measurement.scenarios.find((item) => item.id === id);
    return brief.objective === "influential_core"
      ? scenario?.influenceMass ?? null
      : brief.objective === "near_conversion"
        ? scenario?.serviceableReach ?? null
        : scenario?.reach ?? null;
  };
  const values = [valueFor("low"), valueFor("base"), valueFor("high")];
  if (brief.objective === "broad_reach") {
    // Reach eligibility above is sufficient.
  } else if (
    brief.objective === "influential_core" &&
    (!influenceInputsCompatible(bundle, brief) ||
      measurement.influence === null ||
      measurement.evidence.influence === null)
  ) {
    return unavailable(
      measurement.availability.influence.reasonCode ?? "INFLUENCE_PROFILE_INCOMPATIBLE",
      measurement.availability.influence.recoveryAction ??
        "Provide a current governed influence profile",
    );
  } else if (
    brief.objective === "near_conversion" &&
    (!serviceabilityInputsCompatible(bundle, brief) ||
      measurement.evidence.serviceability === null)
  ) {
    return unavailable(
      measurement.availability.serviceability.reasonCode ??
        "SERVICEABILITY_PROFILE_INCOMPATIBLE",
      measurement.availability.serviceability.recoveryAction ??
        "Provide a current governed serviceability profile",
    );
  }
  if (values.some((value) => value === null)) {
    return unavailable(
      "OBJECTIVE_DELIVERY_UNAVAILABLE",
      "Repair the failed causal stage and recompute the plan",
    );
  }
  const range = { low: values[0]!, base: values[1]!, high: values[2]! };
  const evidence = brief.objective === "influential_core"
    ? measurement.evidence.influence
    : brief.objective === "near_conversion"
      ? measurement.evidence.serviceability
      : measurement.evidence.uniqueReach;
  if (!(range.low <= range.base && range.base <= range.high)) {
    return unavailable(
      "INCOHERENT_OBJECTIVE_RANGE",
      "Correct the scenario definition before presenting or comparing delivery",
    );
  }
  return {
    status: "eligible",
    objective: brief.objective,
    metric,
    label,
    unit,
    range,
    value: range.base,
    evidence,
    sourceIds: [...evidence!.sourceIds],
    comparabilityKey: objectiveDeliveryComparabilityKey({
      reachComparabilityKey: measurement.comparabilityKey,
      objective: brief.objective,
      profileSourceIds,
      assumptionIds,
    }),
    reasonCode: null,
    recoveryAction: null,
  };
}
~~~

Zero is a valid serviceability value and an individual zero `qi` is valid. Missing, mismatched, or out-of-period source metadata is what makes the profile unavailable; influential delivery additionally requires a positive influence denominator and the registered linkage sensitivity.

Create `src/planning/packageOptimizer.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type {
  Brief,
  PackageCandidate,
  PillarScores,
  PlanningResult,
} from "@/contracts/domain";
import { estimatePackage } from "@/planning/engine";
import { evaluateEvidence } from "@/planning/evidence";
import { siteDeliveryCompatible } from "@/planning/movement";
import { resolveObjectiveDelivery } from "@/planning/objectiveDelivery";
import { percentileRank, planningFit } from "@/planning/planningFit";

function combinations<T>(items: T[], minimum: number, maximum: number): T[][] {
  const output: T[][] = [];
  const visit = (start: number, selected: T[]) => {
    if (selected.length >= minimum) output.push([...selected]);
    if (selected.length === maximum) return;
    for (let index = start; index < items.length; index += 1) {
      selected.push(items[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return output;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function canonicalPackageId(siteIds: string[]): string {
  return [...siteIds].sort().join("|");
}

export function comparePackageCandidates(
  left: PackageCandidate,
  right: PackageCandidate,
): number {
  return (left.mode === right.mode ? 0 : left.mode === "planning_fit" ? -1 : 1) ||
    ((right.planningFit ?? -1) - (left.planningFit ?? -1)) ||
    ((right.contextRankScore ?? -1) - (left.contextRankScore ?? -1)) ||
    (right.evidenceScore - left.evidenceScore) ||
    (left.costNgn - right.costNgn) ||
    left.id.localeCompare(right.id);
}

function contextRankScore(
  sites: FrozenBundle["sites"],
  sector: Brief["sector"],
): number {
  const scores = sites.map((site) => site.planningScoresBySector[sector]);
  return mean(scores.flatMap((score) => [score.A, score.C, score.P, score.E]));
}

export function optimizePackage(
  bundle: FrozenBundle,
  brief: Brief,
  selectedSiteIds?: string[],
): PlanningResult {
  const allNormalizationSets = combinations(
    bundle.sites,
    3,
    6,
  ).filter((sites) => {
    const zones = new Set(sites.map((site) => site.zoneId));
    const cost = sites.reduce((sum, site) => sum + site.rateNgn, 0);
    return zones.size === 3 && cost <= brief.normalizationBudgetNgn;
  });
  const flightCompatibleSets = allNormalizationSets.filter((sites) =>
    sites.every((site) => siteDeliveryCompatible(
      site,
      brief.flightStart,
      brief.flightEnd,
    )),
  );
  // A fully unavailable bundle still returns the best deterministic repair
  // candidate, which carries typed invalid reasons instead of throwing.
  const siteSets = flightCompatibleSets.length > 0
    ? flightCompatibleSets
    : allNormalizationSets;

  const recommendationEvidence = evaluateEvidence(bundle.evidenceProfiles.recommendation);

  function evaluate(sites: FrozenBundle["sites"]) {
    const measurement = estimatePackage(bundle, {
      sector: brief.sector,
      daypart: brief.daypart,
      siteIds: sites.map((site) => site.id),
      flightStart: brief.flightStart,
      flightEnd: brief.flightEnd,
    });
    const delivery = resolveObjectiveDelivery(bundle, brief, measurement);
    return {
      sites,
      measurement,
      objectiveDelivery: delivery,
      deliveryRaw: delivery.value,
      deliveryReason: delivery.reasonCode,
    };
  }

  const evaluated = siteSets.map(evaluate);
  const deliveryCohort = evaluated.flatMap((item) =>
    item.deliveryRaw === null ? [] : [item.deliveryRaw],
  );

  function toCandidate(item: ReturnType<typeof evaluate>): PackageCandidate {
    const sectorScores = item.sites.map(
      (site) => site.planningScoresBySector[brief.sector],
    );
    const siteIds = item.sites.map((site) => site.id).sort();
    const zoneIds = [...new Set(item.sites.map((site) => site.zoneId))].sort();
    const costNgn = item.sites.reduce((sum, site) => sum + site.rateNgn, 0);
    const invalidReasonCodes = [
      ...(new Set(siteIds).size !== siteIds.length ? ["DUPLICATE_SITE"] : []),
      ...(siteIds.length < 3 || siteIds.length > 6 ? ["SITE_COUNT_OUTSIDE_3_TO_6"] : []),
      ...(zoneIds.length !== 3 ? ["EXACTLY_THREE_ZONES_REQUIRED"] : []),
      ...(costNgn > brief.budgetNgn ? ["BUDGET_EXCEEDED"] : []),
      ...(costNgn > brief.normalizationBudgetNgn
        ? ["NORMALIZATION_ENVELOPE_EXCEEDED"]
        : []),
      ...(item.sites.some((site) => !site.available) ? ["SITE_UNAVAILABLE"] : []),
      ...(item.sites.some((site) => !siteDeliveryCompatible(
        site,
        brief.flightStart,
        brief.flightEnd,
      )) ? ["SITE_UNAVAILABLE_FOR_FLIGHT"] : []),
    ];
    const pillars: PillarScores | null =
      item.deliveryRaw === null || recommendationEvidence.grade === "unavailable"
      ? null
      : {
          A: mean(sectorScores.map((score) => score.A)),
          D: percentileRank(item.deliveryRaw, deliveryCohort),
          C: mean(sectorScores.map((score) => score.C)),
          P: mean(sectorScores.map((score) => score.P)),
          E: mean(sectorScores.map((score) => score.E)),
        };
    return {
      id: canonicalPackageId(siteIds),
      siteIds,
      zoneIds,
      costNgn,
      pillars,
      planningFit: pillars ? planningFit(pillars, brief.objective) : null,
      deliveryRaw: item.deliveryRaw,
      evidenceScore: recommendationEvidence.score,
      evidenceGrade: recommendationEvidence.grade,
      valid: invalidReasonCodes.length === 0,
      invalidReasonCodes,
      mode: pillars ? "planning_fit" : "context_shortlist",
      contextReason: item.deliveryReason ?? (
        recommendationEvidence.grade === "unavailable"
          ? "RECOMMENDATION_EVIDENCE_UNAVAILABLE"
          : null
      ),
      contextRankScore: pillars ? null : contextRankScore(item.sites, brief.sector),
      estimateFingerprint: item.measurement.fingerprint,
    };
  }

  const candidates = evaluated.map(toCandidate);

  const validRanked = candidates
    .filter((candidate) => candidate.valid)
    .sort(comparePackageCandidates);
  const recoveryRanked = candidates
    .filter((candidate) => !candidate.valid)
    .sort((left, right) =>
      (left.invalidReasonCodes.length - right.invalidReasonCodes.length) ||
      (Math.max(0, left.costNgn - brief.budgetNgn) -
        Math.max(0, right.costNgn - brief.budgetNgn)) ||
      comparePackageCandidates(left, right),
    );
  const ranked = [...validRanked, ...recoveryRanked];
  if (ranked.length === 0) {
    throw new Error("BUNDLE_HAS_NO_THREE_ZONE_NORMALIZATION_CANDIDATE");
  }

  let chosenEvaluation = evaluated.find(
    (item) => canonicalPackageId(item.sites.map((site) => site.id)) === ranked[0].id,
  )!;
  let recommended = ranked[0];
  if (selectedSiteIds) {
    const selectedSites = selectedSiteIds.map((siteId) => {
      const site = bundle.sites.find((candidate) => candidate.id === siteId);
      if (!site) throw new Error("UNKNOWN_SITE_OVERRIDE:" + siteId);
      return site;
    });
    chosenEvaluation = evaluate(selectedSites);
    recommended = toCandidate(chosenEvaluation);
  }

  return {
    brief,
    recommended,
    internalReplacements: ranked
      .filter((candidate) => candidate.id !== recommended.id)
      .slice(0, 2),
    selectedZoneIds: recommended.zoneIds,
    measurement: chosenEvaluation.measurement,
    objectiveDelivery: chosenEvaluation.objectiveDelivery,
    replay: chosenEvaluation.measurement.replay,
    planFingerprint: chosenEvaluation.measurement.fingerprint,
    dataRevision: chosenEvaluation.measurement.replay.dataRevision,
    contextRevision: null,
  };
}
~~~

- [ ] **Step 8: Add explicit objective failure cases**

The implementation above must return a typed `context_shortlist`, rather than a false Planning Fit, when the objective's delivery input is unavailable. Add these tests:

~~~ts
it("does not label a qi-ineligible shortlist as Planning Fit", () => {
  const noQi = structuredClone(frozenLagosBundle);
  for (const member of noQi.panel.filter((item) => item.sector === "fmcg")) {
    member.qi = 0;
  }
  const result = optimizePackage(noQi, { ...brief, objective: "influential_core" });
  expect(result.recommended.mode).toBe("context_shortlist");
  expect(result.recommended.planningFit).toBeNull();
  expect(result.recommended.contextReason).toBe("INFLUENCE_PROFILE_INCOMPATIBLE");
});

it("treats a compatible all-zero serviceability profile as a valid zero", () => {
  const zeroServiceability = structuredClone(frozenLagosBundle);
  for (const member of zeroServiceability.panel.filter((item) => item.sector === "fmcg")) {
    member.serviceability = 0;
  }
  const result = optimizePackage(zeroServiceability, { ...brief, objective: "near_conversion" });
  expect(result.recommended.mode).toBe("planning_fit");
  expect(result.recommended.deliveryRaw).toBe(0);
});

it("rejects a missing influence source even when qi values are positive", () => {
  const missingSource = structuredClone(frozenLagosBundle);
  missingSource.sourceManifest = missingSource.sourceManifest.filter(
    (source) => source.id !== "synthetic-fmcg-influence-v1",
  );
  const result = optimizePackage(missingSource, { ...brief, objective: "influential_core" });
  expect(result.recommended.mode).toBe("context_shortlist");
  expect(result.recommended.contextReason).toBe("INFLUENCE_PROFILE_INCOMPATIBLE");
});

it("rejects serviceability whose product period does not cover the flight", () => {
  const expired = structuredClone(frozenLagosBundle);
  const source = expired.sourceManifest.find(
    (item) => item.id === "synthetic-fmcg-serviceability-v1",
  )!;
  source.periodEnd = "2026-08-31";
  const result = optimizePackage(expired, { ...brief, objective: "near_conversion" });
  expect(result.recommended.mode).toBe("context_shortlist");
  expect(result.recommended.planningFit).toBeNull();
  expect(result.recommended.contextReason).toBe("SERVICEABILITY_PROFILE_INCOMPATIBLE");
});

it("returns a target-basis context shortlist when allocation provenance is incompatible", () => {
  const incompatible = structuredClone(frozenLagosBundle);
  const source = incompatible.sourceManifest.find(
    (item) => item.id === incompatible.targetAllocationSourceIds.fmcg,
  )!;
  source.periodEnd = "2026-08-31";
  const result = optimizePackage(incompatible, brief);
  expect(result.measurement.claim.kind).toBe("general_ots");
  expect(result.recommended.mode).toBe("context_shortlist");
  expect(result.recommended.contextReason).toBe("TARGET_BASIS_INCOMPATIBLE");
});

it("filters out an unavailable face and types an explicit selected override", () => {
  const candidate = structuredClone(frozenLagosBundle);
  const unavailable = candidate.sites.at(-1)!;
  unavailable.deliverySchedule.availabilityEnd = "2026-08-31";
  const ranked = optimizePackage(candidate, brief);
  expect(ranked.recommended.siteIds).not.toContain(unavailable.id);

  const selected = [
    unavailable.id,
    ...ranked.recommended.siteIds.filter((siteId) => siteId !== unavailable.id).slice(0, 2),
  ];
  const override = optimizePackage(candidate, brief, selected);
  expect(override.recommended.valid).toBe(false);
  expect(override.recommended.invalidReasonCodes)
    .toContain("SITE_UNAVAILABLE_FOR_FLIGHT");
  expect(override.measurement.claim.kind).toBe("movement");
});

it("returns a repairable invalid candidate when every face is outside the flight", () => {
  const candidate = structuredClone(frozenLagosBundle);
  for (const site of candidate.sites) {
    site.deliverySchedule.availabilityEnd = "2026-08-31";
  }
  const result = optimizePackage(candidate, brief);
  expect(result.recommended.valid).toBe(false);
  expect(result.recommended.invalidReasonCodes)
    .toContain("SITE_UNAVAILABLE_FOR_FLIGHT");
  expect(result.measurement.claim.kind).toBe("movement");
});

it("suppresses Planning Fit when Recommendation Evidence is unavailable", () => {
  const candidate = structuredClone(frozenLagosBundle);
  candidate.evidenceProfiles.recommendation.hasZeroCritical = true;
  const result = optimizePackage(candidate, brief);
  expect(result.recommended.mode).toBe("context_shortlist");
  expect(result.recommended.planningFit).toBeNull();
  expect(result.recommended.evidenceScore).toBe(0);
  expect(result.recommended.evidenceGrade).toBe("unavailable");
  expect(result.recommended.contextReason)
    .toBe("RECOMMENDATION_EVIDENCE_UNAVAILABLE");
});
~~~

Do not substitute Activity Potential into D. Uploaded-only results use this same `context_shortlist` contract with `planningFit: null`.

- [ ] **Step 9: Run the score and optimiser suites**

Run:

~~~bash
pnpm test -- tests/unit/planning/planningFit.test.ts tests/unit/planning/optimizerProperties.test.ts
pnpm typecheck
~~~

Expected: all tests PASS. The same brief produces the same package ID on repeated runs.

- [ ] **Step 10: Commit**

~~~bash
git add src/contracts/domain.ts src/planning/planningFit.ts src/planning/objectiveDelivery.ts src/planning/packageOptimizer.ts src/planning/engine.ts tests/unit/planning
git commit -m "feat: add objective package optimiser"
~~~

## Task 6: Implement the applied-plan and dirty-draft lifecycle

**Files:**

- Create: `src/application/plannerService.ts`
- Create: `src/application/plannerReducer.ts`
- Create: `src/application/plannerSelectors.ts`
- Test: `tests/unit/application/plannerReducer.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Create `tests/unit/application/plannerReducer.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import { estimatePackage } from "@/planning/engine";
import {
  applyUploadContextToPlan,
  buildPlan,
  promoteAlternativeZone,
  recalculatePlan,
  recalculateSelectedSites,
} from "@/application/plannerService";
import { initialPlannerState, plannerReducer } from "@/application/plannerReducer";
import {
  selectPlanDeltas,
  selectZoneCards,
} from "@/application/plannerSelectors";

const brief = {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg" as const,
  objective: "broad_reach" as const,
  daypart: "pm" as const,
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

describe("plannerReducer", () => {
  it("keeps the RFQ basis on the applied plan until Apply", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: applied });
    const draft = recalculatePlan(frozenLagosBundle, applied, { budgetNgn: 20_000_000 });
    const dirty = plannerReducer(loaded, { type: "drafted", plan: draft });
    expect(dirty.appliedPlan?.recommended.id).toBe(applied.recommended.id);
    expect(dirty.draftPlan?.brief.budgetNgn).toBe(20_000_000);
    const committed = plannerReducer(dirty, { type: "applied" });
    expect(committed.appliedPlan?.brief.budgetNgn).toBe(20_000_000);
    expect(committed.draftPlan).toBeNull();
  });

  it("routes uploaded context through the same draft, Undo, and Apply lifecycle", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
    const uploaded = applyUploadContextToPlan(frozenLagosBundle, original, {
      mode: "context_shortlist",
      selectedRowIds: ["UP-001"],
      enrichmentSnapshotId: "snapshot-upload-1",
      dataRevision: "upload-context-v1",
      claimResolution: {
        highest: "context",
        influenceEligible: false,
        evidenceCap: "D",
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
        recoveryAction: "Provide a feature-compatible calibration bundle",
      },
      planningFit: null,
    });
    const dirty = plannerReducer(loaded, {
      type: "drafted",
      plan: uploaded,
      reason: "Apply uploaded context · upload-context-v1",
    });
    expect(dirty.appliedPlan).toBe(original);
    expect(dirty.draftPlan?.contextRevision?.dataRevision).toBe("upload-context-v1");
    expect(plannerReducer(dirty, { type: "undo" }).draftPlan).toBeNull();
    const applied = plannerReducer(dirty, { type: "applied" });
    expect(applied.originalPlan).toBe(original);
    expect(applied.appliedPlan?.contextRevision?.enrichmentSnapshotId)
      .toBe("snapshot-upload-1");
  });

  it("allows a commercially valid claim-degraded draft to apply", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const degraded = {
      ...applied,
      recommended: {
        ...applied.recommended,
        planningFit: null,
        pillars: null,
        mode: "context_shortlist" as const,
        valid: true,
      },
    };
    const state = {
      ...initialPlannerState,
      appliedPlan: applied,
      draftPlan: degraded,
    };
    expect(plannerReducer(state, { type: "applied" }).appliedPlan?.recommended.mode)
      .toBe("context_shortlist");
  });

  it("blocks a package-invalid draft", () => {
    const applied = buildPlan(frozenLagosBundle, brief);
    const invalid = {
      ...applied,
      recommended: { ...applied.recommended, valid: false },
    };
    const state = {
      ...initialPlannerState,
      appliedPlan: applied,
      draftPlan: invalid,
    };
    expect(() => plannerReducer(state, { type: "applied" }))
      .toThrow("PACKAGE_INVALID");
  });

  it("preserves the immutable original and resets back to it after Apply", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
    const changed = recalculatePlan(frozenLagosBundle, original, { budgetNgn: 20_000_000 });
    const applied = plannerReducer(
      plannerReducer(loaded, { type: "drafted", plan: changed }),
      { type: "applied" },
    );
    const reset = plannerReducer(applied, { type: "reset" });
    expect(reset.originalPlan).toBe(original);
    expect(reset.appliedPlan).toBe(changed);
    expect(reset.draftPlan).toBe(original);
    expect(plannerReducer(reset, { type: "applied" }).appliedPlan).toBe(original);
  });

  it.each([
    ["broad_reach", "Target reach"],
    ["influential_core", "Influence-weighted reached mass"],
    ["near_conversion", "Serviceable target reach"],
  ] as const)("reports objective-specific comparable deltas for %s", (objective, label) => {
    const original = buildPlan(frozenLagosBundle, { ...brief, objective });
    const draft = recalculatePlan(frozenLagosBundle, original, { budgetNgn: 20_000_000 });
    const deltas = selectPlanDeltas({
      ...initialPlannerState,
      originalPlan: original,
      appliedPlan: original,
      draftPlan: draft,
      status: "dirty",
    })!;
    expect(deltas.currentToDraft.deliveryLabel).toBe(label);
    expect(deltas.currentToDraft.reasonCode).toBeNull();
    expect(deltas.currentToDraft.eligibleDelivery).toBe(
      draft.recommended.deliveryRaw! - original.recommended.deliveryRaw!,
    );
  });

  it("refuses a numeric delta across objective or comparability changes", () => {
    const original = buildPlan(frozenLagosBundle, brief);
    const changedObjective = recalculatePlan(frozenLagosBundle, original, {
      objective: "influential_core",
    });
    const deltas = selectPlanDeltas({
      ...initialPlannerState,
      originalPlan: original,
      appliedPlan: original,
      draftPlan: changedObjective,
      status: "dirty",
    })!;
    expect(deltas.currentToDraft.eligibleDelivery).toBeNull();
    expect(deltas.currentToDraft.reasonCode).toBe("INCOMPARABLE_DELIVERY_BASIS");
  });

  it("uses influence mass, not Capture percentage points, for influential zone delivery", () => {
    const plan = buildPlan(frozenLagosBundle, {
      ...brief,
      objective: "influential_core",
    });
    const state = plannerReducer(initialPlannerState, { type: "loaded", plan });
    const first = selectZoneCards(frozenLagosBundle, state)[0];
    const reduced = estimatePackage(frozenLagosBundle, {
      sector: plan.brief.sector,
      daypart: plan.brief.daypart,
      flightStart: plan.brief.flightStart,
      flightEnd: plan.brief.flightEnd,
      siteIds: plan.recommended.siteIds.filter((siteId) =>
        frozenLagosBundle.sites.find((site) => site.id === siteId)?.zoneId !== first.zoneId
      ),
    });
    const base = plan.measurement.scenarios.find((item) => item.id === "base")!;
    const reducedBase = reduced.scenarios.find((item) => item.id === "base")!;
    expect(first.marginalInfluenceMass).toBeCloseTo(
      base.influenceMass! - reducedBase.influenceMass!,
      8,
    );
  });
});
~~~

- [ ] **Step 2: Run reducer tests and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/application/plannerReducer.test.ts
~~~

Expected: FAIL because the service and reducer do not exist.

- [ ] **Step 3: Implement the pure planner service**

Create `src/application/plannerService.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type {
  Brief,
  PlanContextRevision,
  PlanningResult,
} from "@/contracts/domain";
import { estimatePackage } from "@/planning/engine";
import { siteDeliveryCompatible } from "@/planning/movement";
import {
  comparePackageCandidates,
  optimizePackage,
} from "@/planning/packageOptimizer";

export function buildPlan(bundle: FrozenBundle, brief: Brief): PlanningResult {
  return optimizePackage(bundle, brief);
}

export function applyUploadContextToPlan(
  bundle: FrozenBundle,
  basis: PlanningResult,
  contextRevision: PlanContextRevision,
): PlanningResult {
  const measurement = estimatePackage(bundle, {
    sector: basis.brief.sector,
    daypart: basis.brief.daypart,
    siteIds: basis.recommended.siteIds,
    flightStart: basis.brief.flightStart,
    flightEnd: basis.brief.flightEnd,
    enrichmentSnapshotId: contextRevision.enrichmentSnapshotId,
    dataRevision: contextRevision.dataRevision,
  });
  return {
    ...basis,
    recommended: {
      ...basis.recommended,
      estimateFingerprint: measurement.fingerprint,
    },
    measurement,
    replay: measurement.replay,
    dataRevision: contextRevision.dataRevision,
    contextRevision,
  };
}

export function recalculatePlan(
  bundle: FrozenBundle,
  basis: PlanningResult,
  change: Partial<Brief>,
): PlanningResult {
  const next = optimizePackage(bundle, { ...basis.brief, ...change });
  return basis.contextRevision
    ? applyUploadContextToPlan(bundle, next, basis.contextRevision)
    : next;
}

export function recalculateSelectedSites(
  bundle: FrozenBundle,
  basis: PlanningResult,
  selectedSiteIds: string[],
): PlanningResult {
  const next = optimizePackage(bundle, basis.brief, selectedSiteIds);
  return basis.contextRevision
    ? applyUploadContextToPlan(bundle, next, basis.contextRevision)
    : next;
}

export function promoteAlternativeZone(
  bundle: FrozenBundle,
  basis: PlanningResult,
  excludedZoneId: string,
): PlanningResult {
  if (!basis.selectedZoneIds.includes(excludedZoneId)) {
    throw new Error("ZONE_NOT_IN_PACKAGE");
  }
  const keptSiteIds = basis.recommended.siteIds.filter((siteId) =>
    bundle.sites.find((site) => site.id === siteId)?.zoneId !== excludedZoneId
  );
  const outsideSites = bundle.sites
    .filter((site) =>
      siteDeliveryCompatible(site, basis.brief.flightStart, basis.brief.flightEnd) &&
      !basis.selectedZoneIds.includes(site.zoneId)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  if (outsideSites.length === 0) throw new Error("NO_ALTERNATIVE_ZONE");
  return outsideSites
    .map((site) => recalculateSelectedSites(bundle, basis, [...keptSiteIds, site.id]))
    .sort((left, right) =>
      Number(right.recommended.valid) - Number(left.recommended.valid) ||
      comparePackageCandidates(left.recommended, right.recommended)
    )[0];
}
~~~

- [ ] **Step 4: Implement reducer actions, Undo, Reset, and Apply**

Create `src/application/plannerReducer.ts`:

~~~ts
import type { PlanningResult } from "@/contracts/domain";

export type PlannerState = {
  originalPlan: PlanningResult | null;
  appliedPlan: PlanningResult | null;
  draftPlan: PlanningResult | null;
  draftHistory: PlanningResult[];
  lastAction: string | null;
  status: "brief" | "loaded" | "dirty" | "rfq";
};

export const initialPlannerState: PlannerState = {
  originalPlan: null,
  appliedPlan: null,
  draftPlan: null,
  draftHistory: [],
  lastAction: null,
  status: "brief",
};

export type PlannerAction =
  | { type: "loaded"; plan: PlanningResult }
  | { type: "drafted"; plan: PlanningResult; reason?: string }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "applied" }
  | { type: "review-rfq" };

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction,
): PlannerState {
  switch (action.type) {
    case "loaded":
      return {
        originalPlan: action.plan,
        appliedPlan: action.plan,
        draftPlan: null,
        draftHistory: [],
        lastAction: null,
        status: "loaded",
      };
    case "drafted":
      return {
        ...state,
        draftHistory: state.draftPlan
          ? [...state.draftHistory, state.draftPlan]
          : state.draftHistory,
        draftPlan: action.plan,
        lastAction: action.reason ?? "Plan adjustment",
        status: "dirty",
      };
    case "undo": {
      const previous = state.draftHistory.at(-1) ?? null;
      return {
        ...state,
        draftPlan: previous,
        draftHistory: previous ? state.draftHistory.slice(0, -1) : [],
        lastAction: previous ? "Undo adjustment" : null,
        status: previous ? "dirty" : "loaded",
      };
    }
    case "reset": {
      if (!state.originalPlan || !state.appliedPlan) return state;
      const appliedIsOriginal = state.appliedPlan === state.originalPlan;
      return {
        ...state,
        draftPlan: appliedIsOriginal ? null : state.originalPlan,
        draftHistory: [],
        lastAction: appliedIsOriginal ? null : "Reset to original recommendation",
        status: appliedIsOriginal ? "loaded" : "dirty",
      };
    }
    case "applied":
      if (!state.draftPlan) return state;
      if (!state.draftPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
      return {
        ...state,
        appliedPlan: state.draftPlan,
        draftPlan: null,
        draftHistory: [],
        lastAction: null,
        status: "loaded",
      };
    case "review-rfq":
      if (!state.appliedPlan) throw new Error("NO_APPLIED_PLAN");
      return { ...state, status: "rfq" };
  }
}
~~~

- [ ] **Step 5: Add one selector as the source of all visible planning values**

Create `src/application/plannerSelectors.ts`:

~~~ts
import type { PlannerState } from "@/application/plannerReducer";

export function selectVisiblePlan(state: PlannerState) {
  return state.draftPlan ?? state.appliedPlan;
}

export function selectRfqBasis(state: PlannerState) {
  return state.appliedPlan;
}

export function selectIsDirty(state: PlannerState): boolean {
  return state.draftPlan !== null;
}

type Plan = NonNullable<PlannerState["appliedPlan"]>;

function objectiveDeliveryDefinition(plan: Plan) {
  if (plan.brief.objective === "influential_core") {
    return {
      label: "Influence-weighted reached mass",
      unit: "influence_weighted_people" as const,
      value: (scenario: Plan["measurement"]["scenarios"][number]) => scenario.influenceMass,
    };
  }
  if (plan.brief.objective === "near_conversion") {
    return {
      label: "Serviceable target reach",
      unit: "people" as const,
      value: (scenario: Plan["measurement"]["scenarios"][number]) => scenario.serviceableReach,
    };
  }
  return {
    label: "Target reach",
    unit: "people" as const,
    value: (scenario: Plan["measurement"]["scenarios"][number]) => scenario.reach,
  };
}

function deliveryRange(plan: Plan) {
  const definition = objectiveDeliveryDefinition(plan);
  const low = plan.measurement.scenarios.find((item) => item.id === "low");
  const base = plan.measurement.scenarios.find((item) => item.id === "base");
  const high = plan.measurement.scenarios.find((item) => item.id === "high");
  if (!low || !base || !high) return null;
  const values = [definition.value(low), definition.value(base), definition.value(high)];
  return values.some((value) => value === null)
    ? null
    : { low: values[0]!, base: values[1]!, high: values[2]! };
}

function changedIds(left: string[], right: string[]): string[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [...new Set([
    ...left.filter((id) => !rightSet.has(id)),
    ...right.filter((id) => !leftSet.has(id)),
  ])].sort();
}

function planSummary(plan: Plan) {
  const delivery = objectiveDeliveryDefinition(plan);
  return {
    planningFit: plan.recommended.planningFit,
    evidenceScore: plan.recommended.evidenceScore,
    evidenceGrade: plan.recommended.evidenceGrade,
    costNgn: plan.recommended.costNgn,
    siteIds: [...plan.recommended.siteIds],
    zoneIds: [...plan.selectedZoneIds],
    deliveryLabel: delivery.label,
    deliveryUnit: delivery.unit,
    deliveryRange: deliveryRange(plan),
    dataRevision: plan.dataRevision,
    fingerprint: plan.measurement.fingerprint,
    comparabilityKey: plan.measurement.comparabilityKey,
  };
}

function direction(value: number): string {
  return value > 0 ? "increases" : value < 0 ? "decreases" : "is unchanged";
}

function delta(from: Plan, to: Plan, action: string) {
  const definition = objectiveDeliveryDefinition(to);
  const comparable = from.brief.objective === to.brief.objective &&
    from.measurement.comparabilityKey === to.measurement.comparabilityKey;
  const fromRange = deliveryRange(from);
  const toRange = deliveryRange(to);
  const reasonCode = !comparable
    ? "INCOMPARABLE_DELIVERY_BASIS"
    : !fromRange || !toRange
      ? "OBJECTIVE_DELIVERY_UNAVAILABLE"
      : null;
  const pillarKeys = ["A", "D", "C", "P", "E"] as const;
  const affectedPillars = pillarKeys.filter((pillar) =>
    from.recommended.pillars?.[pillar] !== to.recommended.pillars?.[pillar]
  );
  const costNgn = to.recommended.costNgn - from.recommended.costNgn;
  const eligibleDelivery = reasonCode === null
    ? toRange!.base - fromRange!.base
    : null;
  return {
    action,
    comparable,
    reasonCode,
    deliveryLabel: definition.label,
    deliveryUnit: definition.unit,
    from: planSummary(from),
    to: planSummary(to),
    costNgn,
    planningFit: from.recommended.planningFit === null || to.recommended.planningFit === null
      ? null
      : to.recommended.planningFit - from.recommended.planningFit,
    evidenceScore: to.recommended.evidenceScore - from.recommended.evidenceScore,
    eligibleDelivery,
    changedSiteIds: changedIds(from.recommended.siteIds, to.recommended.siteIds),
    changedZoneIds: changedIds(from.selectedZoneIds, to.selectedZoneIds),
    affectedPillars,
    tradeOff: reasonCode
      ? "Delivery is shown side by side and not subtracted because the basis changed."
      : "Base delivery " + direction(eligibleDelivery!) +
        " while cost " + direction(costNgn) + ".",
  };
}

export function selectPlanDeltas(state: PlannerState) {
  const visible = selectVisiblePlan(state);
  if (!visible || !state.appliedPlan || !state.originalPlan) return null;
  const action = state.lastAction ?? "Plan adjustment";
  return {
    currentToDraft: delta(state.appliedPlan, visible, action),
    originalToDraft: delta(state.originalPlan, visible, action),
  };
}
~~~

- [ ] **Step 6: Add objective, time, budget, include, remove, and swap service tests**

Extend `plannerReducer.test.ts` with a table-driven test that calls `recalculatePlan` for:

~~~ts
const changes = [
  { objective: "influential_core" as const },
  { daypart: "evening" as const },
  { budgetNgn: 20_000_000 },
];

for (const change of changes) {
  const applied = buildPlan(frozenLagosBundle, brief);
  const draft = recalculatePlan(frozenLagosBundle, applied, change);
  expect(draft.brief).toMatchObject(change);
  expect(draft.measurement.fingerprint).toBeTruthy();
}
~~~

Add the exact selected-site cases below. They exercise valid and invalid drafts; every result is recalculated by `optimizePackage`, which calls `estimatePackage` for the selected IDs.

~~~ts
it("recomputes include, remove, and same-zone swap from selected site IDs", () => {
  const applied = buildPlan(frozenLagosBundle, brief);
  const selected = applied.recommended.siteIds;
  const first = frozenLagosBundle.sites.find((site) => site.id === selected[0])!;
  const sameZoneAlternative = frozenLagosBundle.sites.find(
    (site) => site.zoneId === first.zoneId && !selected.includes(site.id),
  )!;
  const outside = frozenLagosBundle.sites.find(
    (site) => !selected.includes(site.id) &&
      applied.selectedZoneIds.includes(site.zoneId),
  )!;

  const cases = [
    [...selected, outside.id],
    selected.slice(0, -1),
    [sameZoneAlternative.id, ...selected.slice(1)],
  ];

  for (const siteIds of cases) {
    const draft = recalculateSelectedSites(frozenLagosBundle, applied, siteIds);
    expect(draft.recommended.siteIds).toEqual([...siteIds].sort());
    expect(draft.measurement.fingerprint).not.toBe(applied.measurement.fingerprint);
    expect(draft.recommended.estimateFingerprint).toBe(draft.measurement.fingerprint);
  }
});

it("excludes a zone and promotes a deterministic alternative zone", () => {
  const applied = buildPlan(frozenLagosBundle, brief);
  const excluded = applied.selectedZoneIds[0];
  const draft = promoteAlternativeZone(frozenLagosBundle, applied, excluded);
  expect(draft.selectedZoneIds).toHaveLength(3);
  expect(draft.selectedZoneIds).not.toContain(excluded);
  expect(draft.measurement.fingerprint).not.toBe(applied.measurement.fingerprint);
});
~~~

Never patch an old reach value. A remove action that leaves fewer than three zones returns a recomputed draft with `valid: false` and `EXACTLY_THREE_ZONES_REQUIRED`; the UI may explain and repair it, but Apply remains blocked. `originalPlan` is assigned only by `loaded`, survives every Apply, and powers “Reset to original.” `selectPlanDeltas` supplies both current-to-draft and original-to-draft comparisons.

- [ ] **Step 7: Run the application-state suite**

Run:

~~~bash
pnpm test -- tests/unit/application/plannerReducer.test.ts
pnpm typecheck
~~~

Expected: all tests PASS. Draft changes never alter the RFQ basis before Apply.

- [ ] **Step 8: Commit**

~~~bash
git add src/application tests/unit/application
git commit -m "feat: add reversible planning session"
~~~

## Task 7: Implement local CSV, TSV, and XLSX import

**Files:**

- Create: `src/import/readLocalSpreadsheet.ts`
- Create: `src/import/mapHeaders.ts`
- Create: `src/import/validateRows.ts`
- Create: `tests/fixtures/messy-inventory.csv`
- Create: `tests/fixtures/inventory.tsv`
- Generate: `tests/fixtures/multi-sheet-inventory.xlsx`
- Test: `tests/unit/import/readLocalSpreadsheet.test.ts`
- Test: `tests/unit/import/validateRows.test.ts`

- [ ] **Step 1: Create deterministic text fixtures**

Create `tests/fixtures/messy-inventory.csv`:

~~~csv
Billboard ID,Location Address,Latitude,Longitude,Owner,Format,Rate,Coordinate Source,Person Name
YB-001,Herbert Macaulay Way Yaba,6.5158,3.3792,Demo Media,Static,3200000,customer_captured,
IK-002,Allen Avenue Ikeja,,,City Screens,DOOH,4400000,unknown,
PR-003,Private home,,,,Static,2000000,unknown,Ada Example
~~~

Create `tests/fixtures/inventory.tsv`:

~~~text
asset_id	address	supplier	format	rate
VI-001	Ahmadu Bello Way Victoria Island	Harbour Media	static	3900000
~~~

- [ ] **Step 2: Write failing parser and validation tests**

Create `tests/unit/import/readLocalSpreadsheet.test.ts`:

~~~ts
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { readLocalSpreadsheet } from "@/import/readLocalSpreadsheet";

describe("readLocalSpreadsheet", () => {
  it("parses CSV and TSV locally", async () => {
    const csv = new File(
      [await readFile("tests/fixtures/messy-inventory.csv")],
      "inventory.csv",
    );
    const tsv = new File(
      [await readFile("tests/fixtures/inventory.tsv")],
      "inventory.tsv",
    );
    expect((await readLocalSpreadsheet(csv)).sheets[0].rows).toHaveLength(4);
    expect((await readLocalSpreadsheet(tsv)).sheets[0].rows).toHaveLength(2);
  });

  it("rejects legacy XLS explicitly", async () => {
    const file = new File(["binary"], "legacy.xls");
    await expect(readLocalSpreadsheet(file)).rejects.toThrow("UNSUPPORTED_XLS");
  });

  it("never calls the network while selecting or parsing a file", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const csv = new File(
      [await readFile("tests/fixtures/messy-inventory.csv")],
      "inventory.csv",
    );
    await readLocalSpreadsheet(csv);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
~~~

Create `tests/unit/import/validateRows.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import {
  selectRowsForEnrichment,
  validateMappedRows,
} from "@/import/validateRows";

describe("validateMappedRows", () => {
  it("quarantines apparent personal data before transmission", () => {
    const result = validateMappedRows([{
      assetId: "P-1",
      address: "Private home",
      personName: "Ada Example",
      spatialRights: "unknown",
    }]);
    expect(result.quarantined[0].reasonCodes).toContain("APPARENT_PERSONAL_DATA");
  });

  it("keeps unknown-provenance coordinates context-only", () => {
    const result = validateMappedRows([{
      assetId: "P-2",
      latitude: 6.5,
      longitude: 3.4,
      spatialRights: "unknown",
    }]);
    expect(result.accepted[0].modelEligible).toBe(false);
    expect(result.accepted[0].mapLibreEligible).toBe(false);
  });

  it("requires a license or attestation ID for MapLibre and never auto-promotes model use", () => {
    const withoutId = validateMappedRows([{
      assetId: "P-3",
      latitude: 6.5,
      longitude: 3.4,
      spatialRights: "customer_captured",
    }]).accepted[0];
    expect(withoutId.mapLibreEligible).toBe(false);
    expect(withoutId.modelEligible).toBe(false);
    expect(withoutId.warningCodes)
      .toContain("SPATIAL_LICENSE_OR_ATTESTATION_REQUIRED");

    const attested = validateMappedRows([{
      assetId: "P-4",
      latitude: 6.5,
      longitude: 3.4,
      spatialRights: "customer_captured",
      spatialLicenseId: "customer-coordinate-attestation-1",
      sourceArtifactId: "upload-fixture-1",
      coordinateAccuracyM: 25,
    }]).accepted[0];
    expect(attested.mapLibreEligible).toBe(true);
    expect(attested.modelEligible).toBe(false);
  });

  it("parses larger files locally but refuses a selection above 50", () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      assetId: "A-" + index,
      address: "Media address " + index,
      spatialRights: "customer_captured" as const,
    }));
    const accepted = validateMappedRows(rows).accepted;
    expect(accepted).toHaveLength(51);
    expect(() => selectRowsForEnrichment(
      accepted,
      accepted.map((row) => row.assetId),
    )).toThrow("MAX_50_SELECTED_ROWS");
  });
});
~~~

- [ ] **Step 3: Run import tests and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/import
~~~

Expected: FAIL because the importer does not exist.

- [ ] **Step 4: Implement local parsing**

Create `src/import/readLocalSpreadsheet.ts`:

~~~ts
import Papa from "papaparse";
import readXlsxFile, { readSheetNames } from "read-excel-file/browser";

export type LocalSheet = {
  name: string;
  rows: unknown[][];
};

export type LocalWorkbook = {
  fileName: string;
  sheets: LocalSheet[];
};

function delimiterFor(fileName: string): "," | "\t" {
  return fileName.toLowerCase().endsWith(".tsv") ? "\t" : ",";
}

export async function readLocalSpreadsheet(file: File): Promise<LocalWorkbook> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xls")) throw new Error("UNSUPPORTED_XLS");
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const parsed = Papa.parse<string[]>(await file.text(), {
      delimiter: delimiterFor(lower),
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length > 0) throw new Error("INVALID_DELIMITED_FILE");
    return {
      fileName: file.name,
      sheets: [{ name: "Sheet1", rows: parsed.data }],
    };
  }
  if (lower.endsWith(".xlsx")) {
    const names = await readSheetNames(file);
    const sheets = await Promise.all(
      names.map(async (name) => ({ name, rows: await readXlsxFile(file, { sheet: name }) })),
    );
    return { fileName: file.name, sheets };
  }
  throw new Error("UNSUPPORTED_SPREADSHEET");
}
~~~

- [ ] **Step 5: Implement deterministic header mapping**

Create `src/import/mapHeaders.ts`:

~~~ts
export type CanonicalHeader =
  | "assetId"
  | "address"
  | "latitude"
  | "longitude"
  | "coordinateAccuracyM"
  | "supplier"
  | "format"
  | "rate"
  | "orientation"
  | "spatialRights"
  | "spatialLicenseId"
  | "sourceArtifactId"
  | "personName";

const aliases: Record<CanonicalHeader, string[]> = {
  assetId: ["asset id", "billboard id", "site id", "face id"],
  address: ["address", "location address", "site address"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon"],
  coordinateAccuracyM: ["coordinate accuracy m", "coordinate accuracy metres", "location accuracy m"],
  supplier: ["supplier", "owner", "media owner"],
  format: ["format", "media format"],
  rate: ["rate", "price", "cost"],
  orientation: ["orientation", "travel direction", "facing"],
  spatialRights: ["coordinate source", "spatial rights", "location source"],
  spatialLicenseId: ["spatial license id", "coordinate attestation id", "location license id"],
  sourceArtifactId: ["source artifact id", "source file id", "location source id"],
  personName: ["person name", "contact name", "resident name"],
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalize(left).split(" "));
  const rightTokens = new Set(normalize(right).split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function mapHeaders(headers: string[]) {
  return headers.map((header) => {
    const normalized = normalize(header);
    const exact = (Object.entries(aliases) as [CanonicalHeader, string[]][])
      .find(([, values]) => values.includes(normalized));
    if (exact) return { source: header, target: exact[0], confidence: 1, confirmed: true };
    const approximate = (Object.entries(aliases) as [CanonicalHeader, string[]][])
      .flatMap(([target, values]) => values.map((value) => ({
        target,
        confidence: tokenSimilarity(header, value),
      })))
      .sort((left, right) => right.confidence - left.confidence)[0];
    return approximate?.confidence >= 0.6
      ? { source: header, target: approximate.target, confidence: approximate.confidence, confirmed: false }
      : { source: header, target: null, confidence: 0, confirmed: false };
  });
}
~~~

Add `tests/unit/import/mapHeaders.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import { mapHeaders } from "@/import/mapHeaders";

describe("mapHeaders", () => {
  it("maps exact aliases and requires confirmation for approximate matches", () => {
    const result = mapHeaders(["Billboard ID", "Site Location Address", "Unexpected Metric"]);
    expect(result[0]).toMatchObject({ target: "assetId", confidence: 1, confirmed: true });
    expect(result[1]).toMatchObject({ target: "address", confirmed: false });
    expect(result[2]).toMatchObject({ target: null, confirmed: false });
  });
});
~~~

- [ ] **Step 6: Implement row validation, provenance, and quarantine**

Create `src/import/validateRows.ts`:

~~~ts
export type SpatialRights =
  | "customer_captured"
  | "open_licensed"
  | "provider_derived"
  | "unknown";

export type MappedInventoryRow = {
  assetId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  coordinateAccuracyM?: number;
  supplier?: string;
  format?: string;
  rate?: number;
  orientation?: string;
  spatialRights?: SpatialRights;
  spatialLicenseId?: string;
  sourceArtifactId?: string;
  personName?: string;
  extras?: Record<string, unknown>;
};

export type ValidatedInventoryRow = MappedInventoryRow & {
  assetId: string;
  spatialRights: SpatialRights;
  modelEligible: boolean;
  mapLibreEligible: boolean;
  warningCodes: string[];
};

export function validateMappedRows(rows: MappedInventoryRow[]) {
  const accepted: ValidatedInventoryRow[] = [];
  const rejected: { row: MappedInventoryRow; reasonCodes: string[] }[] = [];
  const quarantined: { row: MappedInventoryRow; reasonCodes: string[] }[] = [];

  for (const row of rows) {
    const sensitiveExtra = Object.keys(row.extras ?? {}).some((key) =>
      /religion|health|ethnicity|political|biometric|national.?id|phone|email/i.test(key),
    );
    const privateResidentialAddress = /\b(private home|residential apartment|residential flat)\b/i
      .test(row.address ?? "");
    if (row.personName?.trim() || sensitiveExtra || privateResidentialAddress) {
      quarantined.push({ row, reasonCodes: ["APPARENT_PERSONAL_DATA"] });
      continue;
    }
    const hasCoordinate =
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude);
    const hasAddress = Boolean(row.address?.trim());
    const reasons: string[] = [];
    if (!row.assetId?.trim()) reasons.push("MISSING_ASSET_ID");
    if (!hasCoordinate && !hasAddress) reasons.push("MISSING_LOCATION");
    if (reasons.length > 0) {
      rejected.push({ row, reasonCodes: reasons });
      continue;
    }
    const spatialRights = row.spatialRights ?? "unknown";
    const eligibleCustomerSpatial =
      spatialRights === "customer_captured" ||
      spatialRights === "open_licensed";
    const spatialLicenseId = row.spatialLicenseId?.trim();
    const sourceArtifactId = row.sourceArtifactId?.trim();
    accepted.push({
      ...row,
      assetId: row.assetId!.trim(),
      spatialRights,
      spatialLicenseId,
      sourceArtifactId,
      // A self-declared spreadsheet field can support context display, but it
      // never qualifies a coordinate as a calibrated model input.
      modelEligible: false,
      mapLibreEligible: eligibleCustomerSpatial && hasCoordinate &&
        Boolean(spatialLicenseId) && Boolean(sourceArtifactId),
      warningCodes: [
        ...(spatialRights === "unknown" ? ["UNKNOWN_SPATIAL_PROVENANCE"] : []),
        ...(eligibleCustomerSpatial && hasCoordinate && !spatialLicenseId
          ? ["SPATIAL_LICENSE_OR_ATTESTATION_REQUIRED"]
          : []),
        ...(eligibleCustomerSpatial && hasCoordinate && !sourceArtifactId
          ? ["SOURCE_ARTIFACT_ID_REQUIRED"]
          : []),
        ...(hasCoordinate && !Number.isFinite(row.coordinateAccuracyM)
          ? ["COORDINATE_ACCURACY_UNDECLARED"]
          : []),
      ],
    });
  }
  return { accepted, rejected, quarantined };
}

export function selectRowsForEnrichment(
  accepted: ValidatedInventoryRow[],
  selectedAssetIds: string[],
): ValidatedInventoryRow[] {
  if (selectedAssetIds.length > 50) throw new Error("MAX_50_SELECTED_ROWS");
  const selected = new Set(selectedAssetIds);
  const rows = accepted.filter((row) => selected.has(row.assetId));
  if (rows.length !== selected.size) throw new Error("UNKNOWN_SELECTED_ASSET");
  return rows;
}
~~~

- [ ] **Step 7: Generate and test a two-sheet XLSX fixture**

Install ExcelJS as a development-only fixture generator:

~~~bash
pnpm add -D exceljs
~~~

Create `tests/fixtures/build-multi-sheet.ts`:

~~~ts
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
const inventory = workbook.addWorksheet("Inventory");
inventory.addRows([
  ["Asset ID", "Location Address", "Coordinate Source"],
  ["OS-001", "Oshodi Transport Interchange", "customer_captured"],
]);
const notes = workbook.addWorksheet("Notes");
notes.addRows([
  ["Key", "Value"],
  ["Revision", "fixture-v1"],
]);
await workbook.xlsx.writeFile("tests/fixtures/multi-sheet-inventory.xlsx");
~~~

Extend `readLocalSpreadsheet.test.ts`:

~~~ts
it("lists and reads every XLSX worksheet", async () => {
  const bytes = await readFile("tests/fixtures/multi-sheet-inventory.xlsx");
  const workbook = await readLocalSpreadsheet(
    new File([bytes], "multi-sheet-inventory.xlsx"),
  );
  expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["Inventory", "Notes"]);
  expect(workbook.sheets.map((sheet) => sheet.rows.length)).toEqual([2, 2]);
});
~~~

Then run:

~~~bash
pnpm tsx tests/fixtures/build-multi-sheet.ts
pnpm test -- tests/unit/import
~~~

Expected: CSV, TSV, and both XLSX sheet names parse; all validation tests PASS. The test spies on `global.fetch` and confirms zero calls.

- [ ] **Step 8: Commit**

~~~bash
git add package.json pnpm-lock.yaml src/import tests/fixtures tests/unit/import
git commit -m "feat: add local inventory spreadsheet import"
~~~

## Task 8: Implement the provider-neutral enrichment gateway

**Files:**

- Create: `.env.example`
- Create: `src/contracts/enrichment.ts`
- Create: `src/server/enrichment/adapter.ts`
- Create: `src/server/enrichment/policy.ts`
- Create: `src/server/enrichment/gateway.ts`
- Create: `src/server/enrichment/runtime.ts`
- Create: `src/server/enrichment/requestSchemas.ts`
- Create: `src/server/enrichment/providers/disabledProvider.ts`
- Create: `src/server/enrichment/providers/googleGeocodingProvider.ts`
- Create: `src/app/api/enrichment/preflight/route.ts`
- Create: `src/app/api/enrichment/run/route.ts`
- Create: `src/enrichment/enrichmentClient.ts`
- Create: `src/enrichment/enrichmentSnapshot.ts`
- Create: `src/enrichment/policyRules.ts`
- Test: `tests/unit/enrichment/gateway.test.ts`
- Test: `tests/unit/enrichment/googleGeocodingProvider.test.ts`
- Test: `tests/unit/enrichment/enrichmentSnapshot.test.ts`

- [ ] **Step 1: Define fail-closed environment defaults**

Create `.env.example`:

~~~dotenv
LIVE_ENRICHMENT_ENABLED=false
GOOGLE_GEOCODING_V4_ENABLED=false
GOOGLE_GEOCODING_AUTH_MODE=api_key
GOOGLE_GEOCODING_API_KEY=
GOOGLE_MAPS_BROWSER_KEY=
GOOGLE_MAPS_BROWSER_ENABLED=false
GOOGLE_PLACES_AGGREGATE_ENABLED=false
GOOGLE_PLACES_AGGREGATE_CUSTOMER_VALUE_APPROVAL_ID=
GOOGLE_PLACES_AGGREGATE_MAPLIBRE_APPROVAL_ID=
GOOGLE_ROUTES_ENABLED=false
ENRICHMENT_MAX_ROWS=50
ENRICHMENT_MAX_CALLS_PER_RUN=50
ENRICHMENT_REQUEST_TIMEOUT_MS=5000
ENRICHMENT_PREFLIGHT_SECRET=
ENRICHMENT_POLICY_VERSION=2026-08-03
GOOGLE_MAPS_TERMS_REVIEWED_AT=
~~~

All flags default false in code even if the variable is missing. Places Insights has no flag, endpoint, package, or provider registration.

- [ ] **Step 2: Write failing gateway tests**

Create `tests/unit/enrichment/gateway.test.ts`:

~~~ts
import { describe, expect, it, vi } from "vitest";
import { createEnrichmentGateway } from "@/server/enrichment/gateway";

const row = {
  rowId: "row-1",
  address: "Herbert Macaulay Way Yaba Lagos",
  spatialRights: "customer_captured" as const,
};

describe("enrichment gateway", () => {
  it("makes no provider call during preflight", async () => {
    const geocode = vi.fn();
    const gateway = createEnrichmentGateway({
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: { geocode },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    });
    const preflight = gateway.preflight({ rows: [row] });
    expect(preflight.maximumCalls).toBe(1);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("requires explicit authorization and a matching preflight", async () => {
    const gateway = createEnrichmentGateway({
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: { geocode: vi.fn().mockResolvedValue({ status: "NO_RESULTS", candidates: [] }) },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    });
    const preflight = gateway.preflight({ rows: [row] });
    await expect(gateway.run({
      preflightId: preflight.id,
      rows: [row],
      authorized: false,
      idempotencyKey: "run-1",
    })).rejects.toThrow("AUTHORIZATION_REQUIRED");
  });

  it("accepts a signed preflight in a fresh route instance", async () => {
    const dependencies = {
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: {
        geocode: vi.fn().mockResolvedValue({ status: "NO_RESULTS", candidates: [] }),
      },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    };
    const issued = createEnrichmentGateway(dependencies).preflight({ rows: [row] });
    const freshRouteInstance = createEnrichmentGateway(dependencies);
    await expect(freshRouteInstance.run({
      preflightId: issued.id,
      rows: [row],
      authorized: true,
      idempotencyKey: "fresh-route-1",
    })).resolves.toEqual([{ status: "NO_RESULTS", candidates: [] }]);
  });

  it("refuses more than 50 rows", () => {
    const gateway = createEnrichmentGateway({
      now: () => new Date("2026-08-03T12:00:00Z"),
      geocoder: { geocode: vi.fn() },
      enabled: true,
      maxRows: 50,
      maxCalls: 50,
      signingSecret: "test-preflight-secret-at-least-32-bytes",
    });
    expect(() => gateway.preflight({
      rows: Array.from({ length: 51 }, (_, index) => ({ ...row, rowId: String(index) })),
    })).toThrow("MAX_ROWS");
  });
});
~~~

- [ ] **Step 3: Define normalized field-level policy contracts**

Create `src/contracts/enrichment.ts`:

~~~ts
export type DisplaySurface = "GOOGLE_MAP" | "NO_MAP_WITH_ATTRIBUTION" | "MAPLIBRE";
export type AllowedPurpose =
  | "LIVE_DISPLAY_CONTEXT"
  | "GEOCODE_REVIEW"
  | "CUSTOMER_VALUE_INPUT"
  | "CALIBRATION_INPUT";

export type EnrichedFieldPolicy = {
  sourceProduct:
    | "google.geocoding.v4"
    | "google.places-aggregate.v1"
    | "customer"
    | "open"
    | "synthetic";
  sourceField: string;
  contentClass:
    | "GOOGLE_MAPS_CONTENT"
    | "GOOGLE_POI_COUNT"
    | "CUSTOMER_VALUE"
    | "CUSTOMER_INPUT";
  allowedPurposes: AllowedPurpose[];
  displaySurfaces: DisplaySurface[];
  persistence:
    | { kind: "NEVER" }
    | { kind: "DELETE_AT"; expiresAt: string }
    | { kind: "INDEFINITE_PLACE_ID"; refreshDueAt?: string }
    | { kind: "CUSTOMER_POLICY"; policyId: string }
    | { kind: "APPROVED_DERIVED_VALUE"; approvalId: string };
  attributionId?: "google-maps";
  legalApprovalId?: string;
  policyVersion: string;
  receivedAt: string;
};

export type EnrichedField<T> = { value: T; policy: EnrichedFieldPolicy };

export type EnrichmentRow = {
  rowId: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  coordinateAccuracyM?: number;
  spatialLicenseId?: string;
  sourceArtifactId?: string;
  spatialRights:
    | "customer_captured"
    | "open_licensed"
    | "provider_derived"
    | "unknown";
};

export type GeocodeCandidate = {
  candidateToken: string;
  providerPlaceId: EnrichedField<string>;
  coordinate: EnrichedField<{ latitude: number; longitude: number }>;
  granularity: EnrichedField<
    "ROOFTOP" |
    "RANGE_INTERPOLATED" |
    "GEOMETRIC_CENTER" |
    "APPROXIMATE" |
    "GRANULARITY_UNSPECIFIED"
  >;
  formattedAddress: EnrichedField<string>;
  resultTypes: EnrichedField<string[]>;
  quality: {
    resultOrdinal: number;
    resultCount: number;
    countryMatches: boolean;
    localityMatches: boolean | "NOT_CHECKED";
    viewportAmbiguous: boolean;
    partialMatch: "UNAVAILABLE_IN_V4";
  };
};

export type GeocodeResponse = {
  status: "NO_RESULTS" | "REVIEW_REQUIRED" | "PROVIDER_ERROR";
  candidates: GeocodeCandidate[];
};

export type EnrichmentSnapshotRow = {
  row: EnrichmentRow;
  candidates: GeocodeCandidate[];
  selectedCandidateToken: string | null;
  identityConfirmed: boolean;
  uploadedCoordinate: EnrichedField<{
    latitude: number;
    longitude: number;
  }> | null;
  customerCorrection: EnrichedField<{
    latitude: number;
    longitude: number;
  }> | null;
  modelEligible: false;
};

export type EnrichmentSnapshot = {
  id: string;
  dataRevision: string;
  createdAt: string;
  rows: EnrichmentSnapshotRow[];
};
~~~

- [ ] **Step 4: Implement the adapter seam and shared policy guard**

Create `src/server/enrichment/adapter.ts`:

~~~ts
import "server-only";
import type { GeocodeResponse } from "@/contracts/enrichment";

export type GeocodeRequest = {
  assetId: string;
  address: string;
  expectedCountryCode: "NG";
  expectedLocality?: string;
  languageCode: "en";
};

export interface GeocodingProvider {
  geocode(request: GeocodeRequest): Promise<GeocodeResponse>;
}
~~~

Create `src/enrichment/policyRules.ts` without `server-only`; renderer projection must be able to call the same pure rules:

~~~ts
import type {
  AllowedPurpose,
  DisplaySurface,
  EnrichedField,
  EnrichedFieldPolicy,
} from "@/contracts/enrichment";
import type { PlanContextRevision } from "@/contracts/domain";

export function isExpired<T>(field: EnrichedField<T>, now: Date): boolean {
  return field.policy.persistence.kind === "DELETE_AT" &&
    new Date(field.policy.persistence.expiresAt).getTime() <= now.getTime();
}

function isApprovedGoogleDerivedValue(policy: EnrichedFieldPolicy): boolean {
  return policy.sourceProduct === "google.places-aggregate.v1" &&
    policy.contentClass === "GOOGLE_POI_COUNT" &&
    policy.persistence.kind === "APPROVED_DERIVED_VALUE" &&
    Boolean(policy.legalApprovalId) &&
    policy.persistence.approvalId === policy.legalApprovalId;
}

export function isRendererEligible<T>(
  field: EnrichedField<T>,
  surface: DisplaySurface,
  now: Date,
): boolean {
  const policy = field.policy;
  if (isExpired(field, now) || !policy.displaySurfaces.includes(surface)) return false;
  if (surface === "MAPLIBRE" && policy.sourceProduct.startsWith("google.")) {
    return isApprovedGoogleDerivedValue(policy);
  }
  if (surface === "MAPLIBRE" && policy.contentClass === "GOOGLE_MAPS_CONTENT") {
    return false;
  }
  if (policy.contentClass === "GOOGLE_MAPS_CONTENT" && !policy.attributionId) {
    return false;
  }
  return true;
}

export function canProjectField<T>(
  field: EnrichedField<T>,
  surface: DisplaySurface,
  purpose: AllowedPurpose,
  now: Date,
): boolean {
  const policy = field.policy;
  if (!isRendererEligible(field, surface, now)) return false;
  if (!policy.allowedPurposes.includes(purpose)) return false;
  return true;
}
~~~

Create `src/server/enrichment/policy.ts`:

~~~ts
import "server-only";
import type {
  AllowedPurpose,
  DisplaySurface,
  EnrichedField,
} from "@/contracts/enrichment";
import {
  isExpired,
  isRendererEligible,
} from "@/enrichment/policyRules";

export function assertReadable<T>(field: EnrichedField<T>, now: Date): void {
  if (isExpired(field, now)) throw new Error("FIELD_EXPIRED");
}

export function assertRendererEligible<T>(
  field: EnrichedField<T>,
  surface: DisplaySurface,
  now: Date,
): void {
  assertReadable(field, now);
  if (!isRendererEligible(field, surface, now)) {
    throw new Error("RENDERER_NOT_ELIGIBLE");
  }
}

export function assertPurposeEligible<T>(
  field: EnrichedField<T>,
  purpose: AllowedPurpose,
  now: Date,
): void {
  assertReadable(field, now);
  if (!field.policy.allowedPurposes.includes(purpose)) {
    throw new Error("PURPOSE_NOT_ELIGIBLE");
  }
}

export function assertPersistable<T>(field: EnrichedField<T>): void {
  if (field.policy.persistence.kind === "NEVER") {
    throw new Error("FIELD_NOT_PERSISTABLE");
  }
}

export function assertModelEligible<T>(field: EnrichedField<T>, now: Date): void {
  assertPurposeEligible(field, "CALIBRATION_INPUT", now);
}

~~~

- [ ] **Step 5: Implement preflight and explicit run authorization**

Create `src/server/enrichment/gateway.ts`:

~~~ts
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { EnrichmentRow, GeocodeResponse } from "@/contracts/enrichment";
import type { GeocodingProvider } from "@/server/enrichment/adapter";
import { canonicalJson } from "@/shared/canonicalJson";

type Dependencies = {
  now(): Date;
  geocoder: GeocodingProvider;
  enabled: boolean;
  maxRows: number;
  maxCalls: number;
  signingSecret: string;
};

type Preflight = {
  id: string;
  expiresAt: string;
  rowHash: string;
  maximumCalls: number;
  providerProducts: string[];
  transmittedFields: string[];
};

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type SignedPreflight = Omit<Preflight, "id">;

function signPreflight(payload: SignedPreflight, secret: string): string {
  const encoded = Buffer.from(canonicalJson(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

function verifyPreflight(token: string, secret: string): SignedPreflight {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("PREFLIGHT_TOKEN_INVALID");
  const [encoded, suppliedSignature] = parts;
  const expectedSignature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("PREFLIGHT_TOKEN_INVALID");
  }
  const parsed = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Partial<SignedPreflight>;
  if (
    typeof parsed.rowHash !== "string" ||
    typeof parsed.expiresAt !== "string" ||
    typeof parsed.maximumCalls !== "number" ||
    !Array.isArray(parsed.providerProducts) ||
    !Array.isArray(parsed.transmittedFields)
  ) {
    throw new Error("PREFLIGHT_TOKEN_INVALID");
  }
  return parsed as SignedPreflight;
}

export function createEnrichmentGateway(dependencies: Dependencies) {
  const completed = new Map<string, {
    rowHash: string;
    expiresAt: number;
    result: GeocodeResponse[];
  }>();

  function preflight(input: { rows: EnrichmentRow[] }): Preflight {
    if (!dependencies.enabled) throw new Error("LIVE_ENRICHMENT_DISABLED");
    if (dependencies.signingSecret.length < 32) throw new Error("PREFLIGHT_SECRET_MISSING");
    if (input.rows.length > dependencies.maxRows) throw new Error("MAX_ROWS");
    if (input.rows.some((row) => row.spatialRights === "unknown")) {
      throw new Error("SPATIAL_RIGHTS_REQUIRED");
    }
    const maximumCalls = input.rows.filter((row) => Boolean(row.address)).length;
    if (maximumCalls > dependencies.maxCalls) throw new Error("MAX_CALLS");
    const rowHash = contentHash(canonicalJson(input.rows));
    const unsigned: SignedPreflight = {
      rowHash,
      expiresAt: new Date(dependencies.now().getTime() + 5 * 60_000).toISOString(),
      maximumCalls,
      providerProducts: ["Google Geocoding API v4"],
      transmittedFields: ["address", "Accept-Language: en"],
    };
    return { ...unsigned, id: signPreflight(unsigned, dependencies.signingSecret) };
  }

  async function run(input: {
    preflightId: string;
    rows: EnrichmentRow[];
    authorized: boolean;
    idempotencyKey: string;
  }): Promise<GeocodeResponse[]> {
    if (!input.authorized) throw new Error("AUTHORIZATION_REQUIRED");
    const approved = verifyPreflight(input.preflightId, dependencies.signingSecret);
    if (new Date(approved.expiresAt) <= dependencies.now()) throw new Error("PREFLIGHT_EXPIRED");
    const rowHash = contentHash(canonicalJson(input.rows));
    if (approved.rowHash !== rowHash) {
      throw new Error("PREFLIGHT_MISMATCH");
    }
    const prior = completed.get(input.idempotencyKey);
    if (prior && prior.expiresAt <= dependencies.now().getTime()) {
      completed.delete(input.idempotencyKey);
    }
    const current = completed.get(input.idempotencyKey);
    if (current && current.rowHash !== rowHash) throw new Error("IDEMPOTENCY_MISMATCH");
    if (current) return current.result;
    const results = await Promise.all(input.rows.map((row) => {
      if (!row.address) return Promise.resolve({ status: "NO_RESULTS", candidates: [] } as const);
      return dependencies.geocoder.geocode({
        assetId: row.rowId,
        address: row.address,
        expectedCountryCode: "NG",
        languageCode: "en",
      });
    }));
    completed.set(input.idempotencyKey, {
      rowHash,
      result: results,
      expiresAt: dependencies.now().getTime() + 5 * 60_000,
    });
    return results;
  }

  return { preflight, run };
}
~~~

- [ ] **Step 6: Write failing Geocoding v4 mapping tests**

Create `tests/unit/enrichment/googleGeocodingProvider.test.ts` with a recording transport and assert:

~~~ts
expect(recorded.url).toBe(
  "https://geocode.googleapis.com/v4/geocode/address/Herbert%20Macaulay%20Way%20Yaba",
);
expect(recorded.headers["X-Goog-Api-Key"]).toBe("server-key");
expect(recorded.headers["X-Goog-FieldMask"]).toContain("results.granularity");
expect(JSON.stringify(recorded)).not.toContain("asset-123");
expect(result.candidates[0].quality.partialMatch).toBe("UNAVAILABLE_IN_V4");
expect(result.candidates[0].coordinate.policy.displaySurfaces)
  .not.toContain("MAPLIBRE");
~~~

Run:

~~~bash
pnpm test -- tests/unit/enrichment/googleGeocodingProvider.test.ts
~~~

Expected: FAIL because the provider does not exist.

- [ ] **Step 7: Implement the feature-gated Geocoding v4 adapter**

Create `src/server/enrichment/providers/googleGeocodingProvider.ts`. Use:

~~~ts
import "server-only";
import type {
  EnrichedField,
  EnrichedFieldPolicy,
  GeocodeCandidate,
  GeocodeResponse,
} from "@/contracts/enrichment";
import type { GeocodeRequest, GeocodingProvider } from "@/server/enrichment/adapter";

const endpoint = "https://geocode.googleapis.com/v4/geocode/address/";
const fieldMask = [
  "results.placeId",
  "results.location",
  "results.granularity",
  "results.formattedAddress",
  "results.postalAddress",
  "results.addressComponents",
  "results.types",
  "results.viewport",
  "results.bounds",
].join(",");

type Transport = (input: {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal;
}) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

type GoogleResult = {
  placeId?: string;
  location?: { latitude?: number; longitude?: number };
  granularity?: string;
  formattedAddress?: string;
  postalAddress?: { regionCode?: string; locality?: string };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  types?: string[];
  viewport?: unknown;
  bounds?: unknown;
};

const granularities = new Set<GeocodeCandidate["granularity"]["value"]>([
  "ROOFTOP",
  "RANGE_INTERPOLATED",
  "GEOMETRIC_CENTER",
  "APPROXIMATE",
  "GRANULARITY_UNSPECIFIED",
]);

function component(result: GoogleResult, type: string) {
  return result.addressComponents?.find((item) => item.types?.includes(type));
}

function normalized(value: string | undefined): string | undefined {
  return value?.trim().toLocaleLowerCase("en");
}

export function createGoogleGeocodingProvider(input: {
  apiKey: string;
  now(): Date;
  timeoutMs: number;
  transport?: Transport;
}): GeocodingProvider {
  if (!input.apiKey.trim()) throw new Error("GOOGLE_GEOCODING_KEY_MISSING");
  const transport: Transport = input.transport ?? (async (request) => fetch(request.url, {
    headers: request.headers,
    signal: request.signal,
  }));

  return {
    async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const response = await transport({
          url: endpoint + encodeURIComponent(request.address),
          headers: {
            "X-Goog-Api-Key": input.apiKey,
            "X-Goog-FieldMask": fieldMask,
            "Accept-Language": request.languageCode,
          },
          signal: controller.signal,
        });
        if (!response.ok) return { status: "PROVIDER_ERROR", candidates: [] };
        const payload = await response.json() as { results?: GoogleResult[] };
        const results = Array.isArray(payload.results) ? payload.results : [];
        const usable = results.filter((result): result is GoogleResult & {
          placeId: string;
          location: { latitude: number; longitude: number };
        } => Boolean(
          result.placeId &&
          Number.isFinite(result.location?.latitude) &&
          Number.isFinite(result.location?.longitude),
        ));
        if (results.length > 0 && usable.length === 0) {
          return { status: "PROVIDER_ERROR", candidates: [] };
        }
        const now = input.now();
        const receivedAt = now.toISOString();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000)
          .toISOString();
        const contentPolicy = (sourceField: string): EnrichedFieldPolicy => ({
          sourceProduct: "google.geocoding.v4",
          sourceField,
          contentClass: "GOOGLE_MAPS_CONTENT",
          allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
          displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
          persistence: { kind: "DELETE_AT", expiresAt },
          attributionId: "google-maps",
          policyVersion: process.env.ENRICHMENT_POLICY_VERSION ?? "2026-08-03",
          receivedAt,
        });
        const wrap = <T,>(value: T, sourceField: string): EnrichedField<T> => ({
          value,
          policy: contentPolicy(sourceField),
        });
        return {
          status: usable.length === 0 ? "NO_RESULTS" : "REVIEW_REQUIRED",
          candidates: usable.map((result, index) => {
            const rawGranularity = result.granularity ?? "GRANULARITY_UNSPECIFIED";
            const granularity = granularities.has(
              rawGranularity as GeocodeCandidate["granularity"]["value"],
            )
              ? rawGranularity as GeocodeCandidate["granularity"]["value"]
              : "GRANULARITY_UNSPECIFIED";
            const countryCode = result.postalAddress?.regionCode ??
              component(result, "country")?.shortText;
            const locality = result.postalAddress?.locality ??
              component(result, "locality")?.longText;
            return {
            candidateToken: "candidate-" + index,
            providerPlaceId: {
              value: result.placeId,
              policy: {
                ...contentPolicy("results.placeId"),
                persistence: { kind: "INDEFINITE_PLACE_ID" },
              },
            },
            coordinate: wrap({
              latitude: result.location.latitude,
              longitude: result.location.longitude,
            }, "results.location"),
            granularity: wrap(granularity, "results.granularity"),
            formattedAddress: wrap(
              result.formattedAddress ?? "",
              "results.formattedAddress",
            ),
            resultTypes: wrap(result.types ?? [], "results.types"),
            quality: {
              resultOrdinal: index,
              resultCount: usable.length,
              countryMatches: countryCode === request.expectedCountryCode,
              localityMatches: request.expectedLocality
                ? normalized(locality) === normalized(request.expectedLocality)
                : "NOT_CHECKED",
              viewportAmbiguous: !result.bounds && Boolean(result.viewport),
              partialMatch: "UNAVAILABLE_IN_V4",
            },
          };}),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
~~~

`countryMatches` is computed after the response because region bias is not a country restriction. `ROOFTOP` remains address-level and never becomes an exact asset-face coordinate.

- [ ] **Step 8: Add disabled provider capabilities**

Create `src/server/enrichment/providers/disabledProvider.ts`:

~~~ts
export const disabledCapabilities = {
  placesAggregate: {
    enabled: false,
    reason: "LEGAL_AND_COMMERCIAL_APPROVAL_REQUIRED",
  },
  routes: {
    enabled: false,
    reason: "DISPLAY_CONTEXT_APPROVAL_REQUIRED",
  },
} as const;
~~~

Places Insights is not registered as a disabled runtime capability: it has no MVP flag, package, endpoint, or adapter. No disabled capability silently substitutes another Google product.

- [ ] **Step 9: Add thin route handlers and client**

Create `src/server/enrichment/requestSchemas.ts`:

~~~ts
import { z } from "zod";

export const EnrichmentRowSchema = z.object({
  rowId: z.string().min(1),
  address: z.string().trim().min(1).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  coordinateAccuracyM: z.number().finite().positive().optional(),
  spatialLicenseId: z.string().trim().min(1).optional(),
  sourceArtifactId: z.string().trim().min(1).optional(),
  spatialRights: z.enum([
    "customer_captured",
    "open_licensed",
    "provider_derived",
    "unknown",
  ]),
}).superRefine((row, context) => {
  const hasPair = row.latitude !== undefined && row.longitude !== undefined;
  if (!row.address && !hasPair) {
    context.addIssue({ code: "custom", message: "ADDRESS_OR_COORDINATE_REQUIRED" });
  }
  if ((row.latitude === undefined) !== (row.longitude === undefined)) {
    context.addIssue({ code: "custom", message: "COORDINATE_PAIR_REQUIRED" });
  }
});

export const PreflightBodySchema = z.object({
  rows: z.array(EnrichmentRowSchema).min(1).max(50),
});

export const RunBodySchema = PreflightBodySchema.extend({
  preflightId: z.string().min(1),
  authorized: z.literal(true),
  idempotencyKey: z.string().min(8).max(100),
});
~~~

Create `src/server/enrichment/runtime.ts`:

~~~ts
import "server-only";
import type { GeocodingProvider } from "@/server/enrichment/adapter";
import { createEnrichmentGateway } from "@/server/enrichment/gateway";
import { createGoogleGeocodingProvider } from "@/server/enrichment/providers/googleGeocodingProvider";

function boundedInteger(value: string | undefined, fallback: number, ceiling: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, ceiling) : fallback;
}

const liveEnabled = process.env.LIVE_ENRICHMENT_ENABLED === "true";
const geocodingEnabled = process.env.GOOGLE_GEOCODING_V4_ENABLED === "true";
const apiKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim() ?? "";
const preflightSecret = process.env.ENRICHMENT_PREFLIGHT_SECRET?.trim() ?? "";
const enabled = liveEnabled && geocodingEnabled && apiKey.length > 0 && preflightSecret.length >= 32;
const disabledGeocoder: GeocodingProvider = {
  geocode: async () => ({ status: "PROVIDER_ERROR", candidates: [] }),
};
const geocoder = enabled
  ? createGoogleGeocodingProvider({
      apiKey,
      now: () => new Date(),
      timeoutMs: boundedInteger(process.env.ENRICHMENT_REQUEST_TIMEOUT_MS, 5_000, 30_000),
    })
  : disabledGeocoder;

export const runtimeEnrichmentGateway = createEnrichmentGateway({
  now: () => new Date(),
  geocoder,
  enabled,
  maxRows: boundedInteger(process.env.ENRICHMENT_MAX_ROWS, 50, 50),
  maxCalls: boundedInteger(process.env.ENRICHMENT_MAX_CALLS_PER_RUN, 50, 50),
  signingSecret: preflightSecret,
});
~~~

Create `src/app/api/enrichment/preflight/route.ts`:

~~~ts
import { NextResponse } from "next/server";
import { disabledCapabilities } from "@/server/enrichment/providers/disabledProvider";
import { PreflightBodySchema } from "@/server/enrichment/requestSchemas";
import { runtimeEnrichmentGateway } from "@/server/enrichment/runtime";

export async function POST(request: Request) {
  try {
    const body = PreflightBodySchema.parse(await request.json());
    const preflight = runtimeEnrichmentGateway.preflight(body);
    return NextResponse.json({
      ...preflight,
      retention: "Geocoding content expires within 30 consecutive days; place IDs are separate",
      attribution: "Google Maps",
      eligibility: "Geocodes are review/context only; not calibration or MapLibre inputs",
      costEstimate: "Cost unavailable — rate card not configured",
      pricingRevision: null,
      disabledCapabilities,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_PREFLIGHT";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
~~~

Create `src/app/api/enrichment/run/route.ts`:

~~~ts
import { NextResponse } from "next/server";
import { RunBodySchema } from "@/server/enrichment/requestSchemas";
import { runtimeEnrichmentGateway } from "@/server/enrichment/runtime";

export async function POST(request: Request) {
  try {
    const body = RunBodySchema.parse(await request.json());
    return NextResponse.json(await runtimeEnrichmentGateway.run(body));
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_ENRICHMENT_RUN";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
~~~

The preflight route returns the explicit provider, actual transmitted fields, call ceiling, retention summary, eligibility, attribution, and disabled capabilities. Its HMAC-signed, five-minute token is stateless, so a run handled by a fresh route bundle can verify the exact row hash without shared process memory. The run schema makes `authorized: true`, `preflightId`, and `idempotencyKey` mandatory. In-memory result replay is only a same-instance optimization; the signed authorization token is the correctness boundary.

Create `src/enrichment/enrichmentClient.ts` with two separate functions:

~~~ts
export async function requestPreflight(body: unknown) {
  const response = await fetch("/api/enrichment/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("PREFLIGHT_FAILED");
  return response.json();
}

export async function runEnrichment(body: unknown) {
  const response = await fetch("/api/enrichment/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("ENRICHMENT_FAILED");
  return response.json();
}
~~~

Selecting or parsing a file must not import or call either function.

- [ ] **Step 10: Normalize enrichment into a versioned, claim-gated upload draft**

Create `src/enrichment/enrichmentSnapshot.ts`:

~~~ts
import type { PlanContextRevision } from "@/contracts/domain";
import type {
  EnrichedField,
  EnrichmentRow,
  EnrichmentSnapshot,
  EnrichmentSnapshotRow,
  GeocodeResponse,
} from "@/contracts/enrichment";
import { canProjectField } from "@/enrichment/policyRules";
import {
  resolveClaimLadder,
} from "@/planning/claimLadder";
import { canonicalJson } from "@/shared/canonicalJson";

function stableId(value: unknown): string {
  let hash = 0x811c9dc5;
  for (const character of canonicalJson(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function versionSnapshot(
  createdAt: string,
  rows: EnrichmentSnapshotRow[],
): EnrichmentSnapshot {
  const digest = stableId({ createdAt, rows });
  return {
    id: "enrichment-" + digest,
    dataRevision: "upload-" + digest,
    createdAt,
    rows,
  };
}

export function createLocalEnrichmentSnapshot(
  rows: EnrichmentRow[],
  createdAt: string,
): EnrichmentSnapshot {
  return versionSnapshot(createdAt, rows.map((row) => {
    const hasCoordinate =
      Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
    const eligibleRights =
      (row.spatialRights === "customer_captured" ||
        row.spatialRights === "open_licensed") &&
      Boolean(row.spatialLicenseId) &&
      Boolean(row.sourceArtifactId);
    const uploadedCoordinate: EnrichmentSnapshotRow["uploadedCoordinate"] =
      hasCoordinate && eligibleRights
        ? {
            value: { latitude: row.latitude!, longitude: row.longitude! },
            policy: {
              sourceProduct: row.spatialRights === "open_licensed" ? "open" : "customer",
              sourceField: "uploadedCoordinate/" + row.sourceArtifactId,
              contentClass: row.spatialRights === "open_licensed"
                ? "CUSTOMER_VALUE"
                : "CUSTOMER_INPUT",
              allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
              displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION", "MAPLIBRE"],
              persistence: {
                kind: "CUSTOMER_POLICY",
                policyId: row.spatialLicenseId!,
              },
              legalApprovalId: row.spatialLicenseId,
              policyVersion: "2026-08-03",
              receivedAt: createdAt,
            },
          }
        : null;
    return {
      row,
      candidates: [],
      selectedCandidateToken: null,
      identityConfirmed: false,
      uploadedCoordinate,
      customerCorrection: null,
      modelEligible: false as const,
    };
  }));
}

export function mergeProviderResponses(
  localSnapshot: EnrichmentSnapshot,
  responses: GeocodeResponse[],
  createdAt: string,
): EnrichmentSnapshot {
  if (localSnapshot.rows.length !== responses.length) {
    throw new Error("ENRICHMENT_ROW_COUNT_MISMATCH");
  }
  return versionSnapshot(createdAt, localSnapshot.rows.map((item, index) => ({
    ...item,
    candidates: responses[index].candidates,
    selectedCandidateToken: null,
    identityConfirmed: false,
    modelEligible: false as const,
  })));
}

export function normalizeEnrichmentSnapshot(
  rows: EnrichmentRow[],
  responses: GeocodeResponse[],
  createdAt: string,
): EnrichmentSnapshot {
  return mergeProviderResponses(
    createLocalEnrichmentSnapshot(rows, createdAt),
    responses,
    createdAt,
  );
}

export function confirmGeocodeIdentity(
  snapshot: EnrichmentSnapshot,
  rowId: string,
  candidateToken: string,
): EnrichmentSnapshot {
  return versionSnapshot(snapshot.createdAt, snapshot.rows.map((item) => {
    if (item.row.rowId !== rowId) return item;
    if (!item.candidates.some((candidate) => candidate.candidateToken === candidateToken)) {
      throw new Error("UNKNOWN_GEOCODE_CANDIDATE");
    }
    return {
      ...item,
      selectedCandidateToken: candidateToken,
      identityConfirmed: true,
      modelEligible: false as const,
    };
  }));
}

export function correctCoordinate(
  snapshot: EnrichmentSnapshot,
  rowId: string,
  coordinate: { latitude: number; longitude: number },
  correctionSourceId: string,
): EnrichmentSnapshot {
  const correction: EnrichedField<typeof coordinate> = {
    value: coordinate,
    policy: {
      sourceProduct: "customer",
      sourceField: "userCoordinateCorrection",
      contentClass: "CUSTOMER_INPUT",
      allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
      displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION", "MAPLIBRE"],
      persistence: { kind: "CUSTOMER_POLICY", policyId: correctionSourceId },
      legalApprovalId: correctionSourceId,
      policyVersion: "2026-08-03",
      receivedAt: snapshot.createdAt,
    },
  };
  return versionSnapshot(snapshot.createdAt, snapshot.rows.map((item) =>
    item.row.rowId === rowId
      ? { ...item, customerCorrection: correction, modelEligible: false as const }
      : item,
  ));
}

export type UploadPlanningDraft = PlanContextRevision;

function selectedContextCoordinate(
  item: EnrichmentSnapshotRow,
): PlanContextRevision["selectedRows"][number]["coordinate"] {
  const confirmedCandidate = item.identityConfirmed
    ? item.candidates.find((candidate) =>
        candidate.candidateToken === item.selectedCandidateToken
      ) ?? null
    : null;
  const field = item.customerCorrection ?? item.uploadedCoordinate ??
    confirmedCandidate?.coordinate ?? null;
  if (!field) return null;
  const provider = field.policy.sourceProduct.startsWith("google")
    ? "google" as const
    : field.policy.sourceProduct.startsWith("mapbox")
      ? "mapbox" as const
      : "customer" as const;
  const surface = provider === "google" ? "GOOGLE_MAP" : "MAPLIBRE";
  if (!canProjectField(field, surface, new Date(field.policy.receivedAt))) {
    return null;
  }
  const license = field.policy.legalApprovalId ??
    (field.policy.persistence.kind === "CUSTOMER_POLICY"
      ? field.policy.persistence.policyId
      : field.policy.attributionId) ??
    "display-only/" + field.policy.policyVersion;
  return {
    value: [field.value.longitude, field.value.latitude],
    provider,
    accuracy: confirmedCandidate?.granularity.value ??
      (item.row.coordinateAccuracyM
        ? "customer-accuracy-" + item.row.coordinateAccuracyM + "m"
        : "customer-supplied"),
    license,
    sourceArtifactId: item.row.sourceArtifactId ?? field.policy.sourceField,
  };
}

export function applyUploadToDraft(
  snapshot: EnrichmentSnapshot,
  selectedRowIds: string[],
): UploadPlanningDraft {
  if (selectedRowIds.length === 0 || selectedRowIds.length > 50) {
    throw new Error("SELECT_1_TO_50_ROWS");
  }
  const known = new Set(snapshot.rows.map((item) => item.row.rowId));
  if (selectedRowIds.some((rowId) => !known.has(rowId))) {
    throw new Error("UNKNOWN_SELECTED_ROW");
  }
  const selectedRows = snapshot.rows.filter((item) => selectedRowIds.includes(item.row.rowId));
  const geocode = selectedRows.every((item) =>
    item.customerCorrection || item.uploadedCoordinate
  )
    ? "precise"
    : selectedRows.some((item) => item.candidates.length > 0)
      ? "low_precision"
      : "unknown";
  const claimResolution = resolveClaimLadder({
    geocode,
    fallbackFacts: "uploaded",
    runtimeFailure: "none",
    calibration: "bundle_mismatch",
    activityPotentialAvailable: false,
    movementAvailable: false,
    movementUnit: null,
    personConversionAvailable: false,
    orientationAvailable: false,
    viewZoneAvailable: false,
    schedule: "missing",
    visibilityAndDeliveryAvailable: false,
    targetUniverseAvailable: false,
    targetAllocationAvailable: false,
    overlap: "missing",
    qiAvailable: false,
  });
  const selectedContextRows = selectedRows.map((item) => ({
    rowId: item.row.rowId,
    assetId: item.row.assetId ?? item.row.rowId,
    supplier: item.row.supplier ?? null,
    address: item.row.address ?? null,
    format: item.row.format ?? null,
    rateNgn: item.row.rateNgn ?? null,
    coordinate: selectedContextCoordinate(item),
  })).sort((left, right) => left.rowId.localeCompare(right.rowId));
  const fingerprint = "context-selection-v1|" + canonicalJson({
    snapshotId: snapshot.id,
    dataRevision: snapshot.dataRevision,
    selectedRows: selectedContextRows,
  });
  return {
    mode: "context_shortlist",
    decisionUse: "context_only",
    selectedRowIds: [...selectedRowIds].sort(),
    selectedRows: selectedContextRows,
    enrichmentSnapshotId: snapshot.id,
    dataRevision: snapshot.dataRevision,
    fingerprint,
    claimResolution,
    planningFit: null,
  };
}
~~~

Create `tests/unit/enrichment/enrichmentSnapshot.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import type {
  EnrichedField,
  EnrichedFieldPolicy,
  EnrichmentRow,
  GeocodeResponse,
} from "@/contracts/enrichment";
import {
  applyUploadToDraft,
  confirmGeocodeIdentity,
  correctCoordinate,
  createLocalEnrichmentSnapshot,
  mergeProviderResponses,
  normalizeEnrichmentSnapshot,
} from "@/enrichment/enrichmentSnapshot";

const nowIso = "2026-08-03T12:00:00.000Z";
const policy: EnrichedFieldPolicy = {
  sourceProduct: "google.geocoding.v4",
  sourceField: "fixture",
  contentClass: "GOOGLE_MAPS_CONTENT",
  allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
  displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
  persistence: { kind: "DELETE_AT", expiresAt: "2026-09-02T12:00:00.000Z" },
  attributionId: "google-maps",
  policyVersion: "2026-08-03",
  receivedAt: nowIso,
};
const wrap = <T,>(value: T, sourceField: string): EnrichedField<T> => ({
  value,
  policy: { ...policy, sourceField },
});
const row: EnrichmentRow = {
  rowId: "asset-1",
  address: "Herbert Macaulay Way Yaba",
  spatialRights: "customer_captured",
};
const response: GeocodeResponse = {
  status: "REVIEW_REQUIRED",
  candidates: [{
    candidateToken: "candidate-0",
    providerPlaceId: wrap("place-1", "results.placeId"),
    coordinate: wrap({ latitude: 6.5158, longitude: 3.3792 }, "results.location"),
    granularity: wrap("APPROXIMATE" as const, "results.granularity"),
    formattedAddress: wrap("Yaba, Lagos, Nigeria", "results.formattedAddress"),
    resultTypes: wrap(["locality"], "results.types"),
    quality: {
      resultOrdinal: 0,
      resultCount: 1,
      countryMatches: true,
      localityMatches: true,
      viewportAmbiguous: true,
      partialMatch: "UNAVAILABLE_IN_V4",
    },
  }],
};

describe("versioned enrichment snapshots", () => {
  it("keeps provider precision immutable when identity is confirmed", () => {
    const snapshot = normalizeEnrichmentSnapshot([row], [response], nowIso);
    const before = snapshot.rows[0].candidates[0].granularity;
    const confirmed = confirmGeocodeIdentity(snapshot, row.rowId, "candidate-0");
    expect(confirmed.rows[0].candidates[0].granularity).toEqual(before);
    expect(confirmed.rows[0].identityConfirmed).toBe(true);
    expect(confirmed.rows[0].modelEligible).toBe(false);
  });

  it("records a moved marker as a separate customer correction", () => {
    const snapshot = normalizeEnrichmentSnapshot([row], [response], nowIso);
    const corrected = correctCoordinate(
      snapshot,
      row.rowId,
      { latitude: 6.5159, longitude: 3.3794 },
      "customer-coordinate-attestation-1",
    );
    expect(corrected.rows[0].candidates).toEqual(snapshot.rows[0].candidates);
    expect(corrected.rows[0].customerCorrection?.policy.sourceProduct).toBe("customer");
    expect(corrected.id).not.toBe(snapshot.id);
  });

  it("creates a context revision with a new data revision, never false reach", () => {
    const snapshot = normalizeEnrichmentSnapshot([row], [response], nowIso);
    const draft = applyUploadToDraft(snapshot, [row.rowId]);
    expect(draft).toMatchObject({
      mode: "context_shortlist",
      enrichmentSnapshotId: snapshot.id,
      dataRevision: snapshot.dataRevision,
      planningFit: null,
    });
    expect(draft.claimResolution.highest).toBe("context");
    expect(draft.claimResolution.recoveryAction).toBeTruthy();
  });

  it("creates a usable local snapshot before any provider response", () => {
    const localRow = {
      ...row,
      latitude: 6.5158,
      longitude: 3.3792,
      spatialRights: "customer_captured" as const,
      spatialLicenseId: "customer-coordinate-attestation-1",
      sourceArtifactId: "upload-fixture-1",
      coordinateAccuracyM: 25,
    };
    const local = createLocalEnrichmentSnapshot([localRow], nowIso);
    expect(local.rows[0].uploadedCoordinate?.policy.displaySurfaces)
      .toContain("MAPLIBRE");
    expect(local.rows[0].customerCorrection).toBeNull();
    const merged = mergeProviderResponses(local, [response], "2026-08-03T12:01:00.000Z");
    expect(merged.rows[0].uploadedCoordinate).toEqual(local.rows[0].uploadedCoordinate);
    expect(merged.rows[0].candidates).toHaveLength(1);
    expect(merged.id).not.toBe(local.id);
  });
});
~~~

The fixture is synthetic; never copy a live Google payload into source control. The upload vignette can map and shortlist these rows immediately, but calibrated Planning Fit remains unavailable until the snapshot matches a passing bundle.

- [ ] **Step 11: Run gateway verification**

Run:

~~~bash
pnpm test -- tests/unit/enrichment
pnpm typecheck
pnpm build
~~~

Expected: all tests PASS; live-disabled tests record zero network calls; no server API key string appears under `.next/static`.

- [ ] **Step 12: Commit**

~~~bash
git add .env.example src/contracts/enrichment.ts src/server/enrichment src/app/api/enrichment src/enrichment tests/unit/enrichment
git commit -m "feat: add explicit enrichment gateway"
~~~

## Task 9: Enforce renderer-safe scene projection

**Files:**

- Create: `src/contracts/renderer.ts`
- Create: `src/maps/projectScene.ts`
- Create: `src/maps/mapLibreStyle.ts`
- Create: `src/maps/MapLibreRenderer.tsx`
- Create: `src/maps/GoogleRenderer.tsx`
- Create: `src/maps/MapCanvas.tsx`
- Create: `public/map/lagos-open-context.geojson`
- Create: `src/app/api/maps/google-config/route.ts`
- Test: `tests/unit/maps/projectScene.test.ts`
- Test: `tests/component/MapCanvas.test.tsx`
- Test: `tests/component/GoogleRenderer.test.tsx`

- [ ] **Step 1: Write failing allowlist-projection tests**

Create `tests/unit/maps/projectScene.test.ts`:

~~~ts
import { describe, expect, it } from "vitest";
import type { EnrichedFieldPolicy } from "@/contracts/enrichment";
import type { SpatialFeature } from "@/contracts/renderer";
import { projectGoogleScene, projectMapLibreScene } from "@/maps/projectScene";

const syntheticPolicy: EnrichedFieldPolicy = {
  sourceProduct: "synthetic",
  sourceField: "zone.center",
  contentClass: "CUSTOMER_VALUE",
  allowedPurposes: ["LIVE_DISPLAY_CONTEXT"],
  displaySurfaces: ["MAPLIBRE"],
  persistence: { kind: "NEVER" },
  policyVersion: "2026-08-03",
  receivedAt: "2026-08-03T12:00:00.000Z",
};
const googlePolicy: EnrichedFieldPolicy = {
  sourceProduct: "google.geocoding.v4",
  sourceField: "results.location",
  contentClass: "GOOGLE_MAPS_CONTENT",
  allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
  displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
  persistence: { kind: "DELETE_AT", expiresAt: "2026-09-02T12:00:00.000Z" },
  attributionId: "google-maps",
  policyVersion: "2026-08-03",
  receivedAt: "2026-08-03T12:00:00.000Z",
};

const features = [
  {
    id: "synthetic-zone",
    coordinateField: {
      value: { longitude: 3.37, latitude: 6.51 },
      policy: syntheticPolicy,
    },
  },
  {
    id: "google-geocode",
    coordinateField: {
      value: { longitude: 3.38, latitude: 6.52 },
      policy: googlePolicy,
    },
  },
  {
    id: "spoofed-google-maplibre",
    coordinateField: {
      value: { longitude: 3.39, latitude: 6.53 },
      policy: {
        ...googlePolicy,
        displaySurfaces: ["MAPLIBRE"] as EnrichedFieldPolicy["displaySurfaces"],
      },
    },
  },
  {
    id: "customer-correction",
    coordinateField: {
      value: { longitude: 3.40, latitude: 6.54 },
      policy: {
        ...syntheticPolicy,
        sourceProduct: "customer" as const,
        sourceField: "userCoordinateCorrection",
        contentClass: "CUSTOMER_INPUT" as const,
        allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
        displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION", "MAPLIBRE"],
        persistence: { kind: "CUSTOMER_POLICY" as const, policyId: "fixture-attestation" },
      },
    },
  },
  {
    id: "spoofed-google-places-maplibre",
    coordinateField: {
      value: { longitude: 3.41, latitude: 6.55 },
      policy: {
        ...syntheticPolicy,
        sourceProduct: "google.places-aggregate.v1" as const,
        sourceField: "aggregate.count",
        contentClass: "GOOGLE_POI_COUNT" as const,
        displaySurfaces: ["MAPLIBRE"],
      },
    },
  },
  {
    id: "approved-google-derived-maplibre",
    coordinateField: {
      value: { longitude: 3.42, latitude: 6.56 },
      policy: {
        ...syntheticPolicy,
        sourceProduct: "google.places-aggregate.v1" as const,
        sourceField: "aggregate.approvedCount",
        contentClass: "GOOGLE_POI_COUNT" as const,
        displaySurfaces: ["MAPLIBRE"],
        persistence: {
          kind: "APPROVED_DERIVED_VALUE" as const,
          approvalId: "places-maplibre-approval-1",
        },
        legalApprovalId: "places-maplibre-approval-1",
      },
    },
  },
] satisfies SpatialFeature[];

describe("scene projection", () => {
  it("uses explicit allowlists for MapLibre", () => {
    expect(projectMapLibreScene(features, new Date("2026-08-04T00:00:00Z")).features.map((item) => item.id))
      .toEqual([
        "synthetic-zone",
        "customer-correction",
        "approved-google-derived-maplibre",
      ]);
  });

  it("keeps Google content and attribution in the Google scene", () => {
    const scene = projectGoogleScene(features, new Date("2026-08-04T00:00:00Z"));
    expect(scene.features.map((item) => item.id)).toEqual([
      "google-geocode",
      "customer-correction",
    ]);
    expect(scene.attributionIds).toEqual(["google-maps"]);
  });

  it("removes an expired field even when the caller asks for its surface", () => {
    expect(projectGoogleScene(
      features,
      new Date("2026-09-03T00:00:00Z"),
    ).features.map((item) => item.id)).toEqual(["customer-correction"]);
  });
});
~~~

Create `tests/component/GoogleRenderer.test.tsx` to assert the real renderer's adjacent attribution while mocking only Google's canvas wrapper:

~~~tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleRenderer } from "@/maps/GoogleRenderer";

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => vi.unstubAllGlobals());

describe("GoogleRenderer", () => {
  it("renders Google Maps attribution in the same visual container", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ enabled: true, browserKey: "restricted-browser-fixture" }),
    }));
    render(<GoogleRenderer scene={{
      kind: "google",
      features: [{
        id: "google-geocode",
        coordinate: [3.38, 6.52],
        sourceProduct: "google.geocoding.v4",
        attributionId: "google-maps",
      }],
      attributionIds: ["google-maps"],
      noMapFallback: {
        features: [{
          id: "google-geocode",
          coordinate: [3.38, 6.52],
          sourceProduct: "google.geocoding.v4",
          attributionId: "google-maps",
        }],
        attributionIds: ["google-maps"],
      },
    }} />);
    expect(await screen.findByText("Google Maps")).toBeInTheDocument();
    expect(screen.getByText("Google Maps").closest("[data-testid='google-renderer']"))
      .not.toBeNull();
  });
});
~~~

- [ ] **Step 2: Run the scene test and verify the red state**

Run:

~~~bash
pnpm test -- tests/unit/maps/projectScene.test.ts
~~~

Expected: FAIL because the renderer contract does not exist.

- [ ] **Step 3: Define mutually exclusive scene types and projectors**

Create `src/contracts/renderer.ts`:

~~~ts
import type { EnrichedField } from "@/contracts/enrichment";

export type MapLens = "plan" | "activity" | "reach" | "influence";
export type DrawerTarget =
  | { kind: "package"; metric: "reach" | "influence" }
  | { kind: "pillar"; id: "A" | "D" | "C" | "P" | "E"; metric: "reach" | "influence" }
  | { kind: "zone"; id: string; metric: "reach" | "influence" }
  | { kind: "site"; id: string; metric: "reach" | "influence" }
  | {
      kind: "evidence";
      id: string;
      siteId: string;
      metric: "reach" | "influence";
    };

export type SpatialFeature = {
  id: string;
  coordinateField: EnrichedField<{ longitude: number; latitude: number }>;
  visual?: {
    label: string;
    metricLabel: string;
    value: number | null;
    unit: "rank" | "index_0_100" | "people" | "percentage_points" | "none";
    range?: { low: number; base: number; high: number };
    evidenceLabel: string;
  };
};

export type RenderedSpatialFeature = Omit<SpatialFeature, "coordinateField"> & {
  coordinate: [number, number];
  sourceProduct: string;
  attributionId?: string;
};

export type MapLibreScene = {
  kind: "maplibre";
  features: RenderedSpatialFeature[];
  attributionIds: string[];
};

export type GoogleScene = {
  kind: "google";
  features: RenderedSpatialFeature[];
  attributionIds: string[];
  noMapFallback: {
    features: RenderedSpatialFeature[];
    attributionIds: string[];
  };
};
~~~

Create `src/maps/projectScene.ts`:

~~~ts
import type {
  GoogleScene,
  MapLibreScene,
  RenderedSpatialFeature,
  SpatialFeature,
} from "@/contracts/renderer";
import { canProjectField } from "@/enrichment/policyRules";

function attributions(features: RenderedSpatialFeature[]): string[] {
  return [...new Set(
    features.map((item) => item.attributionId).filter((value): value is string => Boolean(value)),
  )].sort();
}

function flatten(
  features: SpatialFeature[],
  surface: "MAPLIBRE" | "GOOGLE_MAP" | "NO_MAP_WITH_ATTRIBUTION",
  purpose: "LIVE_DISPLAY_CONTEXT" | "GEOCODE_REVIEW",
  now: Date,
): RenderedSpatialFeature[] {
  return features.flatMap((item) => {
    if (!canProjectField(item.coordinateField, surface, purpose, now)) return [];
    const { longitude, latitude } = item.coordinateField.value;
    return [{
      id: item.id,
      coordinate: [longitude, latitude] as [number, number],
      sourceProduct: item.coordinateField.policy.sourceProduct,
      attributionId: item.coordinateField.policy.attributionId,
      visual: item.visual,
    }];
  });
}

export function projectMapLibreScene(
  features: SpatialFeature[],
  now = new Date(),
): MapLibreScene {
  const eligible = flatten(features, "MAPLIBRE", "LIVE_DISPLAY_CONTEXT", now);
  return { kind: "maplibre", features: eligible, attributionIds: attributions(eligible) };
}

export function projectGoogleScene(
  features: SpatialFeature[],
  now = new Date(),
): GoogleScene {
  const eligible = flatten(features, "GOOGLE_MAP", "GEOCODE_REVIEW", now);
  const noMap = flatten(features, "NO_MAP_WITH_ATTRIBUTION", "GEOCODE_REVIEW", now);
  return {
    kind: "google",
    features: eligible,
    attributionIds: attributions(eligible),
    noMapFallback: {
      features: noMap,
      attributionIds: attributions(noMap),
    },
  };
}
~~~

- [ ] **Step 4: Add renderer-switch destruction tests**

Create `tests/component/MapCanvas.test.tsx`. Mock the heavy map canvases, not the scene projectors:

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapCanvas } from "@/maps/MapCanvas";

vi.mock("@/maps/GoogleRenderer", async () => {
  const { useState } = await vi.importActual<typeof import("react")>("react");
  return { GoogleRenderer: ({ scene }: { scene: { features: Array<{ id: string }> } }) => {
    const [selected, setSelected] = useState<string | null>(null);
    return <div data-testid="google-renderer">
      {scene.features.map((feature) => <button key={feature.id} onClick={() => setSelected(feature.id)}>{feature.id}</button>)}
      {selected && <span>selected:{selected}</span>}
      <span>Google Maps</span>
    </div>;
  }};
});
vi.mock("@/maps/MapLibreRenderer", () => ({
  MapLibreRenderer: ({ scene }: { scene: { features: Array<{ id: string }> } }) =>
    <div data-testid="maplibre-renderer">{scene.features.map((feature) => <span key={feature.id}>{feature.id}</span>)}</div>,
}));

describe("MapCanvas", () => {
  it("destroys Google markers, attribution and selection on a MapLibre switch", async () => {
    const google = {
      kind: "google" as const,
      features: [{ id: "google-geocode", coordinate: [3.38, 6.52] as [number, number], sourceProduct: "google.geocoding.v4", attributionId: "google-maps" }],
      attributionIds: ["google-maps"],
      noMapFallback: { features: [], attributionIds: [] },
    };
    const maplibre = {
      kind: "maplibre" as const,
      features: [{ id: "synthetic-zone", coordinate: [3.37, 6.51] as [number, number], sourceProduct: "synthetic" }],
      attributionIds: [],
    };
    const view = render(<MapCanvas scene={google} />);
    await userEvent.click(screen.getByRole("button", { name: "google-geocode" }));
    expect(screen.getByText("selected:google-geocode")).toBeInTheDocument();
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
    view.rerender(<MapCanvas scene={maplibre} />);
    expect(screen.queryByTestId("google-renderer")).not.toBeInTheDocument();
    expect(screen.getByTestId("maplibre-renderer")).toBeInTheDocument();
    expect(screen.queryByText(/google-geocode|Google Maps/)).not.toBeInTheDocument();
  });
});
~~~

- [ ] **Step 5: Implement the minimal renderers**

Create `public/map/lagos-open-context.geojson` as a deliberately schematic, synthetic context boundary:

~~~json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": { "name": "Lagos demo context", "source": "synthetic" },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[3.20, 6.35], [3.65, 6.35], [3.65, 6.75], [3.20, 6.75], [3.20, 6.35]]]
    }
  }]
}
~~~

Create `src/maps/mapLibreStyle.ts`:

~~~ts
import type { StyleSpecification } from "maplibre-gl";

export const mapLibreStyle: StyleSpecification = {
  version: 8,
  sources: {
    context: {
      type: "geojson",
      data: "/map/lagos-open-context.geojson",
    },
  },
  layers: [{
    id: "context-fill",
    type: "fill",
    source: "context",
    paint: { "fill-color": "#dce6e2", "fill-opacity": 0.65 },
  }],
};
~~~

Create `src/maps/MapLibreRenderer.tsx`:

~~~tsx
"use client";

import { useEffect, useState } from "react";
import MapView, { Marker } from "@vis.gl/react-maplibre";
import type { MapLibreScene } from "@/contracts/renderer";
import { mapLibreStyle } from "@/maps/mapLibreStyle";

function markerScale(scene: MapLibreScene, value: number | null | undefined): number {
  const values = scene.features.flatMap((feature) =>
    feature.visual?.value === null || feature.visual?.value === undefined
      ? []
      : [feature.visual.value],
  );
  if (value === null || value === undefined || values.length === 0) return 0.5;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return maximum === minimum ? 0.72 : (value - minimum) / (maximum - minimum);
}

export function MapLibreRenderer({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: MapLibreScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
}) {
  const [camera, setCamera] = useState({
    longitude: 3.39,
    latitude: 6.53,
    zoom: 10.5,
  });
  useEffect(() => {
    const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
    if (selected) {
      setCamera({
        longitude: selected.coordinate[0],
        latitude: selected.coordinate[1],
        zoom: 12.5,
      });
    }
  }, [scene, selectedFeatureId]);
  return (
    <div data-testid="maplibre-renderer" className="map-surface">
      <MapView
        {...camera}
        onMove={(event) => setCamera(event.viewState)}
        mapStyle={mapLibreStyle}
        reuseMaps={false}
      >
        {scene.features.map((feature) => (
          <Marker
            key={feature.id}
            longitude={feature.coordinate[0]}
            latitude={feature.coordinate[1]}
          >
            <button
              type="button"
              className={selectedFeatureId === feature.id ? "map-marker selected" : "map-marker"}
              aria-pressed={selectedFeatureId === feature.id}
              style={{ "--marker-scale": markerScale(scene, feature.visual?.value) } as React.CSSProperties}
              aria-label={feature.visual
                ? `${feature.visual.label}. ${feature.visual.metricLabel}: ${feature.visual.value ?? "unavailable"} ${feature.visual.unit}. ${feature.visual.evidenceLabel}`
                : feature.id}
              onClick={() => onFeatureSelect?.(feature.id)}
            >
              <span>{feature.visual?.value === null || feature.visual?.value === undefined
                ? "—"
                : Math.round(feature.visual.value).toLocaleString("en")}</span>
            </button>
          </Marker>
        ))}
      </MapView>
    </div>
  );
}
~~~

Create `src/maps/GoogleRenderer.tsx`:

~~~tsx
"use client";

import { useEffect, useState } from "react";
import { AdvancedMarker, APIProvider, Map as GoogleMap } from "@vis.gl/react-google-maps";
import type { GoogleScene } from "@/contracts/renderer";

type GoogleConfig =
  | { enabled: false }
  | { enabled: true; browserKey: string };

function markerScale(scene: GoogleScene, value: number | null | undefined): number {
  const values = scene.features.flatMap((feature) =>
    feature.visual?.value === null || feature.visual?.value === undefined
      ? []
      : [feature.visual.value],
  );
  if (value === null || value === undefined || values.length === 0) return 0.5;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return maximum === minimum ? 0.72 : (value - minimum) / (maximum - minimum);
}

export function GoogleRenderer({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: GoogleScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
}) {
  const [config, setConfig] = useState<GoogleConfig | null>(null);
  const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
  const center = selected
    ? { lng: selected.coordinate[0], lat: selected.coordinate[1] }
    : { lng: 3.39, lat: 6.53 };
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/maps/google-config", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<GoogleConfig>)
      .then(setConfig)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConfig({ enabled: false });
        }
      });
    return () => controller.abort();
  }, []);

  if (!config) return <div data-testid="google-renderer">Loading Google map…</div>;
  if (!config.enabled) {
    return <div data-testid="google-renderer" aria-label="No-map geocode review">
      <p>Google map is disabled; review the eligible values below.</p>
      {scene.noMapFallback.features.map((feature) => (
        <button key={feature.id} type="button" onClick={() => onFeatureSelect?.(feature.id)}>
          {feature.visual?.label ?? feature.id}
        </button>
      ))}
      {scene.noMapFallback.attributionIds.includes("google-maps") && (
        <span className="map-attribution">Google Maps</span>
      )}
    </div>;
  }
  return (
    <div data-testid="google-renderer" className="map-surface">
      <APIProvider apiKey={config.browserKey}>
        <GoogleMap
          center={center}
          zoom={selected ? 12.5 : 10.5}
          mapId="DEMO_MAP_ID"
          disableDefaultUI
        >
          {scene.features.map((feature) => (
            <AdvancedMarker
              key={feature.id}
              position={{ lng: feature.coordinate[0], lat: feature.coordinate[1] }}
              title={feature.id}
              onClick={() => onFeatureSelect?.(feature.id)}
            >
              <button type="button" className={selectedFeatureId === feature.id ? "map-marker selected" : "map-marker"} aria-pressed={selectedFeatureId === feature.id} style={{ "--marker-scale": markerScale(scene, feature.visual?.value) } as React.CSSProperties} aria-label={feature.visual
                ? `${feature.visual.label}. ${feature.visual.metricLabel}: ${feature.visual.value ?? "unavailable"} ${feature.visual.unit}. ${feature.visual.evidenceLabel}`
                : feature.id}>
                {feature.visual?.value === null || feature.visual?.value === undefined
                  ? "—"
                  : Math.round(feature.visual.value).toLocaleString("en")}
              </button>
            </AdvancedMarker>
          ))}
        </GoogleMap>
      </APIProvider>
      {scene.attributionIds.includes("google-maps") && (
        <span className="map-attribution">Google Maps</span>
      )}
    </div>
  );
}
~~~

`MapLibreRenderer` accepts only `MapLibreScene`; `GoogleRenderer` accepts only `GoogleScene` and mounts the provider only after `/api/maps/google-config` reports an enabled restricted browser key. If the Google canvas is disabled, it renders only the separately projected `NO_MAP_WITH_ATTRIBUTION` fallback and keeps required attribution adjacent; it never reuses a Google coordinate on MapLibre.

Implement `MapCanvas.tsx` with a renderer-specific key so switching destroys prior state:

~~~tsx
"use client";

import type { GoogleScene, MapLibreScene } from "@/contracts/renderer";
import { GoogleRenderer } from "@/maps/GoogleRenderer";
import { MapLibreRenderer } from "@/maps/MapLibreRenderer";

export function MapCanvas({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: GoogleScene | MapLibreScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
}) {
  return scene.kind === "google"
    ? <GoogleRenderer key="google" scene={scene} selectedFeatureId={selectedFeatureId} onFeatureSelect={onFeatureSelect} />
    : <MapLibreRenderer key="maplibre" scene={scene} selectedFeatureId={selectedFeatureId} onFeatureSelect={onFeatureSelect} />;
}
~~~

The Google renderer never transfers provider-derived selection, route, camera target, marker, or coordinate state into MapLibre. Customer-owned selection state may be reconstructed separately from planning IDs.

- [ ] **Step 6: Implement the restricted browser-key route**

Create `src/app/api/maps/google-config/route.ts`:

~~~ts
import { NextResponse } from "next/server";

export function GET() {
  const enabled = process.env.GOOGLE_MAPS_BROWSER_ENABLED === "true";
  const key = process.env.GOOGLE_MAPS_BROWSER_KEY;
  if (!enabled || !key) {
    return NextResponse.json({ enabled: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return NextResponse.json({ enabled: true, browserKey: key }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
~~~

This key is intentionally browser-visible and must be separately restricted by referrer and API. It is never the server Geocoding key.

- [ ] **Step 7: Run scene and component verification**

Run:

~~~bash
pnpm test -- tests/unit/maps tests/component/MapCanvas.test.tsx tests/component/GoogleRenderer.test.tsx
pnpm typecheck
~~~

Expected: all tests PASS. MapLibre never receives Google or unknown-provenance coordinates.

- [ ] **Step 8: Commit**

~~~bash
git add src/contracts/renderer.ts src/maps src/app/api/maps tests/unit/maps tests/component/MapCanvas.test.tsx tests/component/GoogleRenderer.test.tsx public/map
git commit -m "feat: enforce map renderer separation"
~~~

## Task 10: Build the sparse map-first experience and causal drawer

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Create: `src/features/PlannerPage.tsx`
- Create: `src/application/permittedDeliveryView.ts`
- Modify: `src/application/plannerSelectors.ts`
- Create: `src/features/BriefPanel.tsx`
- Create: `src/features/RecommendationCards.tsx`
- Create: `src/features/PackageStrip.tsx`
- Create: `src/features/LensTabs.tsx`
- Create: `src/features/CausalDrawer.tsx`
- Create: `src/features/AdjustmentsPanel.tsx`
- Test: `tests/component/PackageStrip.test.tsx`
- Test: `tests/component/CausalDrawer.test.tsx`
- Test: `tests/component/PlannerPage.test.tsx`

- [ ] **Step 1: Write the failing sparse-result test**

Create `tests/component/PlannerPage.test.tsx`:

~~~tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "@/features/PlannerPage";

vi.mock("@/maps/MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

describe("PlannerPage", () => {
  it("shows three zone cards and one compact package strip", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    expect(screen.getAllByTestId("zone-card")).toHaveLength(3);
    expect(screen.getAllByTestId("package-strip")).toHaveLength(1);
    expect(screen.getByText(/Scenario target reach/)).toBeInTheDocument();
    expect(screen.getAllByText(/Evidence D/).length).toBeGreaterThan(0);
  });

  it("keeps all four lenses visible and explains an unavailable lens", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    for (const name of ["Plan", "Activity", "Reach", "Influence"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("changes card delivery copy when the objective changes", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    expect(screen.getAllByText(/Marginal target reach/)).toHaveLength(3);
    await userEvent.selectOptions(
      screen.getByLabelText("Objective"),
      "influential_core",
    );
    expect(screen.getAllByText(/Marginal influence/)).toHaveLength(3);
    expect(screen.getByText("Unapplied changes")).toBeInTheDocument();
    const changes = screen.getByRole("region", { name: "What changed" });
    await userEvent.click(within(changes).getByText("Compare with original recommendation"));
    expect(within(changes).getAllByText(/Not comparable/)).toHaveLength(2);
    expect(within(changes).getAllByText(/Low \/ Base \/ High/)).toHaveLength(4);
    expect(within(changes).getAllByText(/Planning Fit/).length).toBeGreaterThan(0);
    expect(within(changes).getAllByText(/Evidence/).length).toBeGreaterThan(0);
    expect(within(changes).getAllByText(/Affected pillars/)).toHaveLength(2);
    expect(within(changes).getAllByText(/Action:/)).toHaveLength(2);
    expect(within(changes).getAllByText("Calculation basis")).toHaveLength(4);
  });

  it("keeps a below-minimum budget repairable and blocks RFQ review", async () => {
    render(<PlannerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Build campaign" }));
    const budget = screen.getByLabelText("Budget (NGN)");
    await userEvent.clear(budget);
    await userEvent.type(budget, "1");
    expect(screen.getByText("BUDGET_EXCEEDED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply & review RFQ" })).toBeDisabled();
  });
});
~~~

- [ ] **Step 2: Run the component test and verify the red state**

Run:

~~~bash
pnpm test -- tests/component/PlannerPage.test.tsx
~~~

Expected: FAIL because the planner page does not exist.

- [ ] **Step 3: Build the compact package strip**

Create `src/application/permittedDeliveryView.ts`:

~~~ts
import type { MetricClaim } from "@/contracts/metrics";

function compact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

export type PermittedDeliveryView = {
  label: string;
  valueText: string;
  unitLabel: string;
  evidenceLabel: string;
  stateLabel: string;
  caveats: string[];
  recoveryAction: string | null;
};

export function selectPermittedDeliveryView(
  claim: MetricClaim,
  recoveryAction: string | null = null,
): PermittedDeliveryView {
  let valueText: string;
  let unitLabel: string = claim.unit;
  if (claim.kind === "scenario_target_reach") {
    valueText = [claim.range.low, claim.range.base, claim.range.high].map(compact).join(" / ");
    unitLabel = "people · Low / Base / High scenario";
  } else if (claim.kind === "calibrated_target_reach") {
    valueText = [claim.range.p10, claim.range.p50, claim.range.p90].map(compact).join(" / ");
    unitLabel = "people · P10 / P50 / P90";
  } else if (
    claim.kind === "influence_capture" ||
    claim.kind === "influence_weighted_coverage"
  ) {
    const values = claim.range.type === "scenario"
      ? [claim.range.low, claim.range.base, claim.range.high]
      : [claim.range.p10, claim.range.p50, claim.range.p90];
    valueText = values.map((value) => Math.round(value) + "%").join(" / ");
    unitLabel = claim.range.type === "scenario"
      ? "percent · Low / Base / High scenario"
      : "percent · P10 / P50 / P90";
  } else if ("value" in claim) {
    valueText = compact(claim.value);
  } else {
    valueText = "Unavailable";
    unitLabel = "none";
  }
  return {
    label: claim.label,
    valueText,
    unitLabel,
    evidenceLabel: "Evidence " + claim.evidence,
    stateLabel: claim.state,
    caveats: claim.caveats,
    recoveryAction,
  };
}
~~~

Create `src/features/PackageStrip.tsx`:

~~~tsx
import type { MetricClaim } from "@/contracts/metrics";
import type { PlanningResult } from "@/contracts/domain";
import { selectPermittedDeliveryView } from "@/application/permittedDeliveryView";

function compact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

export function PackageStrip({
  plan,
  isDirty,
  canReviewRfq,
  onExplain,
  onReviewRfq,
}: {
  plan: PlanningResult;
  isDirty: boolean;
  canReviewRfq: boolean;
  onExplain(metric: "reach" | "influence"): void;
  onReviewRfq(): void;
}) {
  const claim = plan.measurement.claim;
  const influence = plan.measurement.influence;
  const reachRecovery = plan.measurement.stages
    .find((stage) => stage.id === "unique")?.recoveryAction ?? null;
  const delivery = selectPermittedDeliveryView(claim, reachRecovery);
  const influenceClaim: MetricClaim = influence ?? {
    id: "influence-unavailable",
    kind: "unavailable",
    label: "Influence Capture",
    state: "unavailable",
    evidence: "unavailable",
    unit: "none",
    reasonCode: "QI_UNAVAILABLE",
    sourceIds: [],
    caveats: ["A named category-specific influence propensity source is required"],
    applicability: "outside",
  };
  const influenceDelivery = selectPermittedDeliveryView(
    influenceClaim,
    influence ? null : "Attach a named category-specific influence propensity source",
  );

  return (
    <section className="package-strip" data-testid="package-strip">
      <div>
        <strong>Recommended package</strong>
        <span>{plan.recommended.siteIds.length} sites · ₦{compact(plan.recommended.costNgn)}</span>
      </div>
      <button type="button" onClick={() => onExplain("reach")}>
        <span>{delivery.label} · {delivery.unitLabel} · {delivery.evidenceLabel} {Math.round(plan.measurement.evidenceScores.reach)}/100</span>
        <strong>{delivery.valueText}</strong>
        {delivery.recoveryAction && <small>{delivery.recoveryAction}</small>}
      </button>
      <button type="button" onClick={() => onExplain("influence")}>
        <span>{influenceDelivery.label} · {influenceDelivery.evidenceLabel}{plan.measurement.evidenceScores.influence === null
          ? ""
          : " " + Math.round(plan.measurement.evidenceScores.influence) + "/100"}</span>
        <strong>{influenceDelivery.valueText}</strong>
        {influenceDelivery.recoveryAction && <small>{influenceDelivery.recoveryAction}</small>}
      </button>
      <div>
        <span>Planning Fit</span>
        <strong>{plan.recommended.planningFit === null
          ? "Unavailable"
          : plan.recommended.planningFit.toFixed(0) + "/100"}</strong>
        <span>Recommendation evidence {plan.recommended.evidenceGrade} · {Math.round(plan.recommended.evidenceScore)}/100</span>
      </div>
      <button
        type="button"
        className="primary"
        disabled={!canReviewRfq}
        onClick={onReviewRfq}
      >
        {isDirty ? "Apply & review RFQ" : "Review RFQ"}
      </button>
    </section>
  );
}
~~~

- [ ] **Step 4: Add exact zone marginals to the selector**

Extend `src/application/plannerSelectors.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { DrawerTarget, MapLens, SpatialFeature } from "@/contracts/renderer";
import { activityPotential } from "@/planning/activityPotential";
import { estimatePackage } from "@/planning/engine";

export function selectZoneCards(bundle: FrozenBundle, state: PlannerState) {
  const plan = selectVisiblePlan(state);
  if (!plan) return [];
  const baseScenario = plan.measurement.scenarios.find((item) => item.id === "base")!;
  const reachEligible = ["scenario_target_reach", "calibrated_target_reach"]
    .includes(plan.measurement.claim.kind);
  const influenceEligible = plan.measurement.influence !== null;
  return plan.selectedZoneIds.map((zoneId, index) => {
    const withoutZone = plan.recommended.siteIds.filter((siteId) => {
      return bundle.sites.find((site) => site.id === siteId)?.zoneId !== zoneId;
    });
    const reduced = estimatePackage(bundle, {
      sector: plan.brief.sector,
      daypart: plan.brief.daypart,
      siteIds: withoutZone,
      flightStart: plan.brief.flightStart,
      flightEnd: plan.brief.flightEnd,
    });
    const reducedBase = reduced.scenarios.find((item) => item.id === "base")!;
    const zoneSites = bundle.sites.filter((site) =>
      site.zoneId === zoneId && plan.recommended.siteIds.includes(site.id),
    );
    const zoneMovement = zoneSites.reduce(
      (sum, site) => sum + site.baseMovement[plan.brief.daypart],
      0,
    ) / zoneSites.length;
    return {
      rank: index + 1,
      zoneId,
      label: bundle.zones.find((zone) => zone.id === zoneId)!.label,
      siteIds: plan.recommended.siteIds.filter(
        (siteId) => bundle.sites.find((site) => site.id === siteId)?.zoneId === zoneId,
      ),
      sites: plan.recommended.siteIds
        .map((siteId) => bundle.sites.find((site) => site.id === siteId)!)
        .filter((site) => site.zoneId === zoneId)
        .map((site) => ({ id: site.id, label: site.label })),
      activityPotential: activityPotential(
        zoneMovement,
        bundle.activityCohort.map((location) => location.value),
      ),
      marginalReach: !reachEligible || baseScenario.reach === null || reducedBase.reach === null
        ? null
        : Math.max(0, baseScenario.reach - reducedBase.reach),
      marginalInfluencePoints:
        !influenceEligible ||
        baseScenario.influenceCapture === null || reducedBase.influenceCapture === null
          ? null
          : Math.max(0, baseScenario.influenceCapture - reducedBase.influenceCapture),
      marginalInfluenceMass:
        !influenceEligible ||
        baseScenario.influenceMass === null || reducedBase.influenceMass === null
          ? null
          : Math.max(0, baseScenario.influenceMass - reducedBase.influenceMass),
      marginalServiceableReach:
        !reachEligible ||
        baseScenario.serviceableReach === null || reducedBase.serviceableReach === null
          ? null
          : Math.max(0, baseScenario.serviceableReach - reducedBase.serviceableReach),
      role: index === 0 ? "Lead delivery zone" : index === 1 ? "Complementary audience zone" : "Coverage balance zone",
    };
  });
}

export function selectLensFeatures(
  bundle: FrozenBundle,
  state: PlannerState,
  lens: MapLens,
): SpatialFeature[] {
  const plan = selectVisiblePlan(state);
  if (!plan) return [];
  return selectZoneCards(bundle, state).map((card) => {
    const zone = bundle.zones.find((item) => item.id === card.zoneId)!;
    const metric = lens === "plan"
      ? { label: "Recommendation rank", value: card.rank, unit: "rank" as const }
      : lens === "activity"
        ? { label: "Activity Potential", value: card.activityPotential, unit: "index_0_100" as const }
        : lens === "influence"
          ? { label: "Marginal influence-weighted reach", value: card.marginalInfluenceMass, unit: "people" as const }
          : plan.brief.objective === "near_conversion"
            ? { label: "Marginal serviceable reach", value: card.marginalServiceableReach, unit: "people" as const }
            : { label: "Marginal target reach", value: card.marginalReach, unit: "people" as const };
    return {
      id: card.zoneId,
      coordinateField: {
        value: { longitude: zone.center[0], latitude: zone.center[1] },
        policy: {
          sourceProduct: "synthetic" as const,
          sourceField: "zones.center",
          contentClass: "CUSTOMER_VALUE" as const,
          allowedPurposes: ["LIVE_DISPLAY_CONTEXT" as const],
          displaySurfaces: ["MAPLIBRE" as const],
          persistence: { kind: "NEVER" as const },
          policyVersion: "2026-08-03",
          receivedAt: bundle.manifest.createdAt,
        },
      },
      visual: {
        label: card.label,
        metricLabel: metric.label,
        value: metric.value,
        unit: metric.unit,
        evidenceLabel: "Evidence " + plan.measurement.claim.evidence,
      },
    };
  });
}

export function selectCausalDrawerViewModel(
  bundle: FrozenBundle,
  plan: NonNullable<PlannerState["appliedPlan"]>,
  target: DrawerTarget,
) {
  if (target.kind === "site" && !plan.recommended.siteIds.includes(target.id)) {
    throw new Error("DRAWER_SITE_OUTSIDE_VISIBLE_PLAN");
  }
  if (target.kind === "zone" && !plan.selectedZoneIds.includes(target.id)) {
    throw new Error("DRAWER_ZONE_OUTSIDE_VISIBLE_PLAN");
  }
  if (
    target.kind === "evidence" &&
    !plan.recommended.siteIds.includes(target.siteId)
  ) {
    throw new Error("DRAWER_EVIDENCE_SITE_OUTSIDE_VISIBLE_PLAN");
  }
  const siteIds = target.kind === "package" || target.kind === "pillar"
    ? plan.recommended.siteIds
    : target.kind === "zone"
      ? plan.recommended.siteIds.filter((siteId) =>
          bundle.sites.find((site) => site.id === siteId)?.zoneId === target.id
        )
      : target.kind === "site"
        ? [target.id]
        : [target.siteId];
  const measurement = target.kind === "package" || target.kind === "pillar"
    ? plan.measurement
    : estimatePackage(bundle, {
        sector: plan.brief.sector,
        daypart: plan.brief.daypart,
        siteIds,
        flightStart: plan.brief.flightStart,
        flightEnd: plan.brief.flightEnd,
      });
  const label = target.kind === "package"
    ? "Recommended package"
    : target.kind === "pillar"
      ? target.id + " pillar"
    : target.kind === "zone"
      ? bundle.zones.find((zone) => zone.id === target.id)?.label ?? target.id
      : target.kind === "site"
        ? bundle.sites.find((site) => site.id === target.id)?.label ?? target.id
        : "Evidence · " + target.id;
  const sourceIds = [...new Set([
    ...measurement.claim.sourceIds,
    ...(measurement.influence?.sourceIds ?? []),
  ])].sort();
  const nextTargets: DrawerTarget[] = target.kind === "package"
    ? (["A", "D", "C", "P", "E"] as const).map((id) => ({
        kind: "pillar" as const,
        id,
        metric: target.metric,
      }))
    : target.kind === "pillar"
      ? plan.selectedZoneIds.map((id) => ({
          kind: "zone" as const,
          id,
          metric: target.metric,
        }))
      : target.kind === "zone"
        ? siteIds.map((id) => ({
            kind: "site" as const,
            id,
            metric: target.metric,
          }))
        : target.kind === "site"
          ? sourceIds.map((id) => ({
              kind: "evidence" as const,
              id,
              siteId: target.id,
              metric: target.metric,
            }))
          : [];
  return {
    target,
    label,
    measurement,
    siteIds,
    nextTargets,
    sourceRecord: target.kind === "evidence"
      ? bundle.sourceManifest.find((source) => source.id === target.id) ?? null
      : null,
    scopeNote: target.kind === "package"
      ? "Package-level causal estimate"
      : target.kind === "pillar"
        ? "Registered Planning Fit pillar; Delivery is counted once"
        : target.kind === "evidence"
          ? "Terminal source record for the selected site rerun"
          : "Entity-specific rerun using the same schedule, panel, and causal primitives",
  };
}
~~~

Create `src/features/RecommendationCards.tsx`:

~~~tsx
import type { selectZoneCards } from "@/application/plannerSelectors";

type ZoneCard = ReturnType<typeof selectZoneCards>[number];

export function RecommendationCards({
  cards,
  objective,
  selectedZoneId,
  onZone,
  onSite,
}: {
  cards: ZoneCard[];
  objective: "broad_reach" | "influential_core" | "near_conversion";
  selectedZoneId: string | null;
  onZone(zoneId: string): void;
  onSite(siteId: string): void;
}) {
  if (cards.length > 3) throw new Error("MORE_THAN_THREE_ZONE_CARDS");
  return (
    <ol className="zone-cards" aria-label="Recommended zones">
      {cards.map((card) => {
        const delivery = objective === "influential_core"
          ? { label: "Marginal influence-weighted reach", value: card.marginalInfluenceMass, suffix: " weighted people" }
          : objective === "near_conversion"
            ? { label: "Marginal serviceable reach", value: card.marginalServiceableReach, suffix: " people" }
            : { label: "Marginal target reach", value: card.marginalReach, suffix: " people" };
        return (
          <li key={card.zoneId} data-testid="zone-card">
            <button type="button" onClick={() => onZone(card.zoneId)}>
              <span>#{card.rank} · {card.role}</span>
              <strong>{card.label}</strong>
              <span>Activity Potential {card.activityPotential?.toFixed(0) ?? "Unavailable"}/100</span>
              <span>{delivery.label}: {delivery.value?.toLocaleString() ?? "Unavailable"}{delivery.value === null ? "" : delivery.suffix}</span>
            </button>
            {selectedZoneId === card.zoneId && <div aria-label={card.label + " sites"}>
              {card.sites.map((site) => (
                <button key={site.id} type="button" onClick={() => onSite(site.id)}>
                  {site.label}
                </button>
              ))}
            </div>}
          </li>
        );
      })}
    </ol>
  );
}
~~~

A zone click synchronizes map selection, reveals only that zone’s sites, and opens its causal record; a site click drills into the face-specific rerun. The list values are the numerical alternative to every map encoding.

- [ ] **Step 5: Implement the four lenses and six-stage navigation**

Create `src/features/LensTabs.tsx`:

~~~tsx
import type { MapLens } from "@/contracts/renderer";

export function LensTabs({
  active,
  onChange,
  influenceAvailable,
}: {
  active: MapLens;
  onChange(value: MapLens): void;
  influenceAvailable: boolean;
}) {
  const lenses: { id: MapLens; label: string; disabled: boolean; reason?: string }[] = [
    { id: "plan", label: "Plan", disabled: false },
    { id: "activity", label: "Activity", disabled: false },
    { id: "reach", label: "Reach", disabled: false },
    {
      id: "influence",
      label: "Influence",
      disabled: !influenceAvailable,
      reason: influenceAvailable ? undefined : "Influence profile not configured",
    },
  ];
  return (
    <div role="tablist" aria-label="Map lens">
      {lenses.map((lens) => (
        <button
          key={lens.id}
          role="tab"
          aria-selected={active === lens.id}
          aria-describedby={lens.reason ? lens.id + "-reason" : undefined}
          disabled={lens.disabled}
          onClick={() => onChange(lens.id)}
        >
          {lens.label}
          {lens.reason && <span id={lens.id + "-reason"} className="sr-only">{lens.reason}</span>}
        </button>
      ))}
    </div>
  );
}
~~~

Create `src/features/CausalDrawer.tsx`:

~~~tsx
import { useEffect, useRef } from "react";
import type { EstimatePackageResult } from "@/contracts/metrics";
import type { DrawerTarget } from "@/contracts/renderer";

const labels = {
  location: "Location",
  places: "Places",
  movement: "Movement",
  ots: "OTS",
  target: "Target",
  unique: "Unique",
} as const;

export function CausalDrawer({
  measurement,
  target,
  entityLabel,
  scopeNote,
  activeStage,
  ancestors,
  nextTargets,
  sourceRecord,
  onStage,
  onNavigate,
  onAncestor,
  onBack,
  onClose,
}: {
  measurement: EstimatePackageResult;
  target: DrawerTarget;
  entityLabel: string;
  scopeNote: string;
  activeStage: keyof typeof labels;
  ancestors: DrawerTarget[];
  nextTargets: DrawerTarget[];
  sourceRecord: {
    id: string;
    kind: string;
    sector: string | null;
    geographyId: string;
    productScope: string;
    periodStart: string;
    periodEnd: string;
    provenance: string;
    modelUse: string;
  } | null;
  onStage(value: keyof typeof labels): void;
  onNavigate(target: DrawerTarget): void;
  onAncestor(index: number): void;
  onBack(): void;
  onClose(): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);
  const stage = measurement.stages.find((item) => item.id === activeStage)!;
  return (
    <aside role="dialog" aria-modal="true" aria-label="How delivery was estimated">
      <button ref={closeRef} type="button" onClick={onClose}>Close</button>
      <nav aria-label="Explanation breadcrumb">
        {ancestors.map((ancestor, index) => (
          <button key={ancestor.kind + "/" + ("id" in ancestor ? ancestor.id : "package")} type="button" onClick={() => onAncestor(index)}>
            {ancestor.kind === "package"
              ? "Recommended package"
              : ancestor.kind + " " + ("id" in ancestor ? ancestor.id : "")}
          </button>
        ))}
        <span aria-current="page">{entityLabel}</span>
        {ancestors.length > 0 && (
          <button type="button" onClick={onBack}>Back</button>
        )}
      </nav>
      <h1>{target.metric === "influence" ? "Influence" : "Reach"} · {entityLabel}</h1>
      <p>{scopeNote}</p>
      <nav aria-label="Causal stages">
        {measurement.stages.map((stage) => (
          <button
            key={stage.id}
            aria-current={activeStage === stage.id ? "step" : undefined}
            onClick={() => onStage(stage.id as keyof typeof labels)}
          >
            {labels[stage.id as keyof typeof labels]}
          </button>
        ))}
      </nav>
      <section>
        <h2>{labels[activeStage]}</h2>
        <strong>{stage.valueText}</strong>
        <dl>
          <div><dt>Entity</dt><dd>{target.kind} · {"id" in target ? target.id : "package"}</dd></div>
          <div><dt>Evidence state</dt><dd>{stage.state}</dd></div>
          <div><dt>Source</dt><dd>{stage.sourceLabel}</dd></div>
          <div><dt>Freshness / revision</dt><dd>{stage.freshnessLabel}</dd></div>
          <div><dt>Transformation</dt><dd>{stage.transformation}</dd></div>
          <div><dt>Next mapping</dt><dd>{stage.nextMapping}</dd></div>
        </dl>
        {stage.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
        {stage.recoveryAction && <p>Recovery: {stage.recoveryAction}</p>}
        <details>
          <summary>Source IDs</summary>
          <ul>{[...new Set([
            ...measurement.claim.sourceIds,
            ...(measurement.influence?.sourceIds ?? []),
          ])].sort().map((sourceId) => <li key={sourceId}>{sourceId}</li>)}</ul>
        </details>
        {target.kind === "evidence" && sourceRecord && <section>
          <h3>Source record</h3>
          <dl>
            <div><dt>ID</dt><dd>{sourceRecord.id}</dd></div>
            <div><dt>Kind</dt><dd>{sourceRecord.kind}</dd></div>
            <div><dt>Sector / product</dt><dd>{sourceRecord.sector ?? "all"} / {sourceRecord.productScope}</dd></div>
            <div><dt>Geography</dt><dd>{sourceRecord.geographyId}</dd></div>
            <div><dt>Effective period</dt><dd>{sourceRecord.periodStart} → {sourceRecord.periodEnd}</dd></div>
            <div><dt>Provenance / use</dt><dd>{sourceRecord.provenance} / {sourceRecord.modelUse}</dd></div>
          </dl>
        </section>}
        {activeStage === "unique" && target.metric === "influence" && measurement.influence && (
          <section>
            <h3>Influence</h3>
            <p>Influence-weighted exposure coverage; not persuasion or perception.</p>
          </section>
        )}
        {nextTargets.length > 0 && <section aria-label="Drill deeper">
          <h3>View supporting detail</h3>
          {nextTargets.map((next) => (
            <button
              key={next.kind + "/" + ("id" in next ? next.id : "package")}
              type="button"
              onClick={() => onNavigate(next)}
            >
              {next.kind === "pillar"
                ? next.id + " pillar"
                : next.kind === "zone"
                  ? "Zone " + next.id
                  : next.kind === "site"
                    ? "Site " + next.id
                    : next.kind === "evidence"
                      ? "Evidence " + next.id
                      : "Recommended package"}
            </button>
          ))}
        </section>}
      </section>
    </aside>
  );
}
~~~

Create `tests/component/CausalDrawer.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildPlan } from "@/application/plannerService";
import { selectCausalDrawerViewModel } from "@/application/plannerSelectors";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { DrawerTarget } from "@/contracts/renderer";
import { CausalDrawer } from "@/features/CausalDrawer";

const plan = buildPlan(bundle, {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
});

describe("CausalDrawer", () => {
  it("exposes a complete package → pillar → zone → site → evidence route", () => {
    const packageView = selectCausalDrawerViewModel(bundle, plan, {
      kind: "package", metric: "reach",
    });
    const pillar = packageView.nextTargets.find(
      (target) => target.kind === "pillar" && target.id === "D",
    )!;
    const pillarView = selectCausalDrawerViewModel(bundle, plan, pillar);
    const zone = pillarView.nextTargets.find((target) => target.kind === "zone")!;
    const zoneView = selectCausalDrawerViewModel(bundle, plan, zone);
    const site = zoneView.nextTargets.find((target) => target.kind === "site")!;
    const siteView = selectCausalDrawerViewModel(bundle, plan, site);
    const evidence = siteView.nextTargets.find(
      (target) => target.kind === "evidence",
    )!;
    expect([packageView.target.kind, pillar.kind, zone.kind, site.kind, evidence.kind])
      .toEqual(["package", "pillar", "zone", "site", "evidence"]);
  });

  it("keeps two site identities and causal reruns distinct", () => {
    const [firstId, secondId] = plan.recommended.siteIds.filter((siteId, index, ids) =>
      index === ids.findIndex((candidate) =>
        bundle.sites.find((site) => site.id === candidate)?.zoneId ===
        bundle.sites.find((site) => site.id === siteId)?.zoneId
      )
    ).slice(0, 2);
    const first = selectCausalDrawerViewModel(bundle, plan, {
      kind: "site", id: firstId, metric: "reach",
    });
    const second = selectCausalDrawerViewModel(bundle, plan, {
      kind: "site", id: secondId, metric: "reach",
    });
    expect(first.target).not.toEqual(second.target);
    expect(first.measurement.fingerprint).not.toBe(second.measurement.fingerprint);
  });

  it("renders entity identity, a back action, sources, and distinct metric focus", async () => {
    const siteId = plan.recommended.siteIds[0];
    const target: DrawerTarget = { kind: "site", id: siteId, metric: "reach" };
    const view = selectCausalDrawerViewModel(bundle, plan, target);
    const onBack = vi.fn();
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const rendered = render(<CausalDrawer
      measurement={view.measurement}
      target={target}
      entityLabel={view.label}
      scopeNote={view.scopeNote}
      activeStage="location"
      ancestors={[{
        kind: "zone",
        id: bundle.sites.find((site) => site.id === siteId)!.zoneId,
        metric: "reach",
      }]}
      nextTargets={view.nextTargets}
      sourceRecord={view.sourceRecord}
      onStage={() => undefined}
      onNavigate={() => undefined}
      onAncestor={() => undefined}
      onBack={onBack}
      onClose={onClose}
    />);
    expect(screen.getByRole("heading", { name: /Reach ·/ })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(siteId))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByText("Source IDs"));
    expect(screen.getByText("lagos-demo-synthetic-v1")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
~~~

- [ ] **Step 6: Implement the planner shell and dirty-draft controls**

Create `src/features/BriefPanel.tsx`:

~~~tsx
import type { Brief } from "@/contracts/domain";

export function BriefPanel({
  brief,
  onChange,
  onBuild,
  onUpload,
}: {
  brief: Brief;
  onChange(change: Partial<Brief>): void;
  onBuild(): void;
  onUpload(): void;
}) {
  return (
    <form className="brief-panel" onSubmit={(event) => {
      event.preventDefault();
      onBuild();
    }}>
      <h1>Promotion wizard</h1>
      <label>Product name<input value={brief.productName} onChange={(event) => onChange({ productName: event.target.value })} /></label>
      <label>Product information<textarea value={brief.productDescription} onChange={(event) => onChange({ productDescription: event.target.value })} /></label>
      <label>Target audience<textarea value={brief.targetAudience} onChange={(event) => onChange({ targetAudience: event.target.value })} /></label>
      <label>Sector<select value={brief.sector} onChange={(event) => onChange({ sector: event.target.value as Brief["sector"] })}>
        <option value="fmcg">FMCG</option>
        <option value="real_estate">Real Estate</option>
        <option value="bank_fintech">Bank / Fintech</option>
      </select></label>
      <label>Objective<select value={brief.objective} onChange={(event) => onChange({ objective: event.target.value as Brief["objective"] })}>
        <option value="broad_reach">Broad reach</option>
        <option value="influential_core">Influential core</option>
        <option value="near_conversion">Near conversion</option>
      </select></label>
      <label>Campaign time<select value={brief.daypart} onChange={(event) => onChange({ daypart: event.target.value as Brief["daypart"] })}>
        <option value="all_day">All day</option><option value="am">AM</option>
        <option value="midday">Midday</option><option value="pm">PM</option>
        <option value="evening">Evening</option>
      </select></label>
      <label>Budget (NGN)<input type="number" min={1} value={brief.budgetNgn} onChange={(event) => onChange({ budgetNgn: Number(event.target.value) })} /></label>
      <button type="submit">Build campaign</button>
      <button type="button" onClick={onUpload}>Upload spreadsheet</button>
    </form>
  );
}
~~~

Create `src/features/AdjustmentsPanel.tsx`:

~~~tsx
import type { selectPlanDeltas } from "@/application/plannerSelectors";

type PlanDeltas = NonNullable<ReturnType<typeof selectPlanDeltas>>;
type PlanDelta = PlanDeltas["currentToDraft"];

function number(value: number | null): string {
  return value === null ? "Unavailable" : Math.round(value).toLocaleString("en");
}

function signed(value: number | null): string {
  if (value === null) return "Unavailable";
  return (value > 0 ? "+" : "") + Number(value.toFixed(1)).toLocaleString("en");
}

function rangeText(range: PlanDelta["from"]["deliveryRange"]): string {
  return range
    ? [range.low, range.base, range.high].map(number).join(" / ")
    : "Unavailable";
}

function Comparison({ label, delta }: { label: string; delta: PlanDelta }) {
  return <section aria-label={label + " comparison"}>
    <h3>{label}</h3>
    <p><strong>Action:</strong> {delta.action}</p>
    <p><strong>Trade-off:</strong> {delta.tradeOff}</p>
    {!delta.comparable && (
      <p role="status">Not comparable · {delta.reasonCode}</p>
    )}
    <div className="comparison-pair">
      <section aria-label={label + " previous"}>
        <h4>Previous</h4>
        <dl>
          <div><dt>Cost</dt><dd>NGN {number(delta.from.costNgn)}</dd></div>
          <div><dt>Planning Fit</dt><dd>{number(delta.from.planningFit)}</dd></div>
          <div><dt>Evidence</dt><dd>{number(delta.from.evidenceScore)} · {delta.from.evidenceGrade}</dd></div>
          <div><dt>{delta.from.deliveryLabel} · Low / Base / High</dt><dd>{rangeText(delta.from.deliveryRange)} {delta.from.deliveryUnit}</dd></div>
          <div><dt>Selected zones</dt><dd>{delta.from.zoneIds.join(", ") || "None"}</dd></div>
          <div><dt>Selected sites</dt><dd>{delta.from.siteIds.join(", ") || "None"}</dd></div>
          <div><dt>Data revision</dt><dd>{delta.from.dataRevision}</dd></div>
        </dl>
        <details>
          <summary>Calculation basis</summary>
          <p>Fingerprint <code>{delta.from.fingerprint}</code></p>
          <p>Comparability <code>{delta.from.comparabilityKey}</code></p>
        </details>
      </section>
      <section aria-label={label + " proposed"}>
        <h4>Proposed</h4>
        <dl>
          <div><dt>Cost</dt><dd>NGN {number(delta.to.costNgn)}</dd></div>
          <div><dt>Planning Fit</dt><dd>{number(delta.to.planningFit)}</dd></div>
          <div><dt>Evidence</dt><dd>{number(delta.to.evidenceScore)} · {delta.to.evidenceGrade}</dd></div>
          <div><dt>{delta.to.deliveryLabel} · Low / Base / High</dt><dd>{rangeText(delta.to.deliveryRange)} {delta.to.deliveryUnit}</dd></div>
          <div><dt>Selected zones</dt><dd>{delta.to.zoneIds.join(", ") || "None"}</dd></div>
          <div><dt>Selected sites</dt><dd>{delta.to.siteIds.join(", ") || "None"}</dd></div>
          <div><dt>Data revision</dt><dd>{delta.to.dataRevision}</dd></div>
        </dl>
        <details>
          <summary>Calculation basis</summary>
          <p>Fingerprint <code>{delta.to.fingerprint}</code></p>
          <p>Comparability <code>{delta.to.comparabilityKey}</code></p>
        </details>
      </section>
    </div>
    <dl>
      <div><dt>Cost change</dt><dd>NGN {signed(delta.costNgn)}</dd></div>
      <div><dt>Planning Fit change</dt><dd>{signed(delta.planningFit)}</dd></div>
      <div><dt>Evidence change</dt><dd>{signed(delta.evidenceScore)}</dd></div>
      <div>
        <dt>{delta.comparable ? delta.deliveryLabel : "Objective delivery"} change</dt>
        <dd>{delta.eligibleDelivery === null
          ? "Not subtracted · " + (delta.reasonCode ?? "Unavailable")
          : signed(delta.eligibleDelivery) + " " + delta.deliveryUnit}</dd>
      </div>
      <div><dt>Changed zones</dt><dd>{delta.changedZoneIds.join(", ") || "None"}</dd></div>
      <div><dt>Changed sites</dt><dd>{delta.changedSiteIds.join(", ") || "None"}</dd></div>
      <div><dt>Affected pillars</dt><dd>{delta.affectedPillars.join(", ") || "None"}</dd></div>
    </dl>
  </section>;
}

export function AdjustmentsPanel({
  isDirty,
  siteIds,
  zoneIds,
  deltas,
  invalidReasons,
  onInclude,
  onRemove,
  onSwap,
  onReplaceZone,
  onUndo,
  onReset,
}: {
  isDirty: boolean;
  siteIds: string[];
  zoneIds: string[];
  deltas: ReturnType<typeof selectPlanDeltas>;
  invalidReasons: string[];
  onInclude(): void;
  onRemove(siteId: string): void;
  onSwap(): void;
  onReplaceZone(zoneId: string): void;
  onUndo(): void;
  onReset(): void;
}) {
  return (
    <aside aria-label="Plan adjustments">
      <strong>{isDirty ? "Unapplied changes" : "Adjust plan"}</strong>
      {invalidReasons.map((reason) => <p key={reason}>{reason}</p>)}
      {isDirty && deltas && <section aria-label="What changed">
        <h2>What changed?</h2>
        <Comparison label="Applied → proposed" delta={deltas.currentToDraft} />
        <details>
          <summary>Compare with original recommendation</summary>
          <Comparison label="Original → proposed" delta={deltas.originalToDraft} />
        </details>
      </section>}
      <button type="button" onClick={onInclude}>Include compatible face</button>
      <button type="button" onClick={onSwap}>Swap first face in its zone</button>
      {zoneIds.map((zoneId) => (
        <button key={zoneId} type="button" onClick={() => onReplaceZone(zoneId)}>
          Replace zone {zoneId}
        </button>
      ))}
      {siteIds.map((siteId) => (
        <button key={siteId} type="button" onClick={() => onRemove(siteId)}>
          Remove {siteId}
        </button>
      ))}
      <button type="button" onClick={onUndo}>Undo</button>
      <button type="button" onClick={onReset}>Reset to original</button>
    </aside>
  );
}
~~~

Create `src/features/PlannerPage.tsx`:

~~~tsx
"use client";

import { useMemo, useReducer, useState } from "react";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { Brief } from "@/contracts/domain";
import type { MeasurementStage } from "@/contracts/metrics";
import type { DrawerTarget, MapLens } from "@/contracts/renderer";
import {
  buildPlan,
  promoteAlternativeZone,
  recalculatePlan,
  recalculateSelectedSites,
} from "@/application/plannerService";
import { initialPlannerState, plannerReducer } from "@/application/plannerReducer";
import {
  selectIsDirty,
  selectCausalDrawerViewModel,
  selectLensFeatures,
  selectPlanDeltas,
  selectVisiblePlan,
  selectZoneCards,
} from "@/application/plannerSelectors";
import { AdjustmentsPanel } from "@/features/AdjustmentsPanel";
import { BriefPanel } from "@/features/BriefPanel";
import { CausalDrawer } from "@/features/CausalDrawer";
import { LensTabs } from "@/features/LensTabs";
import { PackageStrip } from "@/features/PackageStrip";
import { RecommendationCards } from "@/features/RecommendationCards";
import { MapCanvas } from "@/maps/MapCanvas";
import { projectMapLibreScene } from "@/maps/projectScene";
import { siteDeliveryCompatible } from "@/planning/movement";

const initialBrief: Brief = {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
};

export function PlannerPage() {
  const [brief, setBrief] = useState(initialBrief);
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);
  const [lens, setLens] = useState<MapLens>("plan");
  const [drawer, setDrawer] = useState<{
    target: DrawerTarget;
    stage: MeasurementStage["id"];
    history: DrawerTarget[];
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const visible = selectVisiblePlan(state);
  const dirty = selectIsDirty(state);
  const cards = visible ? selectZoneCards(bundle, state) : [];
  const deltas = selectPlanDeltas(state);
  const drawerView = drawer && visible
    ? selectCausalDrawerViewModel(bundle, visible, drawer.target)
    : null;
  const selectedZoneId = drawer?.target.kind === "zone"
    ? drawer.target.id
    : drawer?.target.kind === "site"
      ? bundle.sites.find((site) => site.id === drawer.target.id)?.zoneId ?? null
      : drawer?.target.kind === "evidence"
        ? bundle.sites.find((site) => site.id === drawer.target.siteId)?.zoneId ?? null
      : null;
  const scene = useMemo(
    () => projectMapLibreScene(selectLensFeatures(bundle, state, lens)),
    [state, lens],
  );

  function changeBrief(change: Partial<Brief>) {
    setBrief((current) => ({ ...current, ...change }));
    if (visible) {
      dispatch({
        type: "drafted",
        plan: recalculatePlan(bundle, visible, change),
        reason: "Brief change · " + Object.keys(change).sort().join(", "),
      });
    }
  }
  function draftSites(siteIds: string[], reason = "Selected-face change") {
    if (!visible) return;
    dispatch({
      type: "drafted",
      plan: recalculateSelectedSites(bundle, visible, siteIds),
      reason,
    });
  }
  function includeFace() {
    if (!visible) return;
    const addition = bundle.sites.find((site) =>
      visible.selectedZoneIds.includes(site.zoneId) &&
      !visible.recommended.siteIds.includes(site.id) &&
      siteDeliveryCompatible(site, visible.brief.flightStart, visible.brief.flightEnd),
    );
    if (addition) draftSites(
      [...visible.recommended.siteIds, addition.id],
      "Include compatible face · " + addition.id,
    );
  }
  function swapFirstFace() {
    if (!visible) return;
    const first = bundle.sites.find((site) => site.id === visible.recommended.siteIds[0]);
    if (!first) return;
    const replacement = bundle.sites.find((site) =>
      site.zoneId === first.zoneId &&
      !visible.recommended.siteIds.includes(site.id) &&
      siteDeliveryCompatible(site, visible.brief.flightStart, visible.brief.flightEnd),
    );
    if (replacement) draftSites(
      [replacement.id, ...visible.recommended.siteIds.slice(1)],
      "Swap face · " + first.id + " → " + replacement.id,
    );
  }
  function replaceZone(zoneId: string) {
    if (!visible) return;
    dispatch({
      type: "drafted",
      plan: promoteAlternativeZone(bundle, visible, zoneId),
      reason: "Replace zone · " + zoneId,
    });
  }
  function openDrawer(target: DrawerTarget, history: DrawerTarget[] = []) {
    setDrawer({
      target,
      stage: target.kind === "package" || target.metric === "influence"
        ? "unique"
        : "location",
      history,
    });
  }
  function navigateDrawer(target: DrawerTarget) {
    setDrawer((current) => current ? {
      target,
      stage: target.kind === "package" || target.metric === "influence"
        ? "unique"
        : "location",
      history: [...current.history, current.target],
    } : current);
  }
  function reviewRfq() {
    if (!visible?.recommended.valid) return;
    if (dirty) dispatch({ type: "applied" });
    dispatch({ type: "review-rfq" });
  }
  function undoDraft() {
    const previous = state.draftHistory.at(-1) ?? state.appliedPlan;
    if (previous) setBrief(previous.brief);
    dispatch({ type: "undo" });
  }
  function resetDraft() {
    if (state.originalPlan) setBrief(state.originalPlan.brief);
    dispatch({ type: "reset" });
  }

  return (
    <main className="planner-shell">
      <BriefPanel
        brief={brief}
        onChange={changeBrief}
        onBuild={() => dispatch({ type: "loaded", plan: buildPlan(bundle, brief) })}
        onUpload={() => setUploadOpen(true)}
      />
      <section className="map-region" aria-label="Campaign map">
        <LensTabs
          active={lens}
          onChange={setLens}
          influenceAvailable={Boolean(visible?.measurement.influence)}
        />
        <MapCanvas
          scene={scene}
          selectedFeatureId={selectedZoneId}
          onFeatureSelect={(zoneId) => openDrawer({
            kind: "zone",
            id: zoneId,
            metric: lens === "influence" ? "influence" : "reach",
          })}
        />
        {visible && <RecommendationCards
          cards={cards}
          objective={visible.brief.objective}
          selectedZoneId={selectedZoneId}
          onZone={(zoneId) => openDrawer({
            kind: "zone",
            id: zoneId,
            metric: visible.brief.objective === "influential_core" ? "influence" : "reach",
          })}
          onSite={(siteId) => {
            const zoneId = bundle.sites.find((site) => site.id === siteId)!.zoneId;
            const metric = visible.brief.objective === "influential_core" ? "influence" : "reach";
            openDrawer(
              { kind: "site", id: siteId, metric },
              [{ kind: "zone", id: zoneId, metric }],
            );
          }}
        />}
      </section>
      {visible &&
        <PackageStrip
          plan={visible}
          isDirty={dirty}
          canReviewRfq={visible.recommended.valid}
          onExplain={(metric) => openDrawer({ kind: "package", metric })}
          onReviewRfq={reviewRfq}
        />
      }
      {visible && (
        <AdjustmentsPanel
          isDirty={dirty}
          siteIds={visible.recommended.siteIds}
          zoneIds={visible.selectedZoneIds}
          deltas={deltas}
          invalidReasons={visible.recommended.invalidReasonCodes}
          onInclude={includeFace}
          onRemove={(siteId) => draftSites(
            visible.recommended.siteIds.filter((id) => id !== siteId),
            "Remove face · " + siteId,
          )}
          onSwap={swapFirstFace}
          onReplaceZone={replaceZone}
          onUndo={undoDraft}
          onReset={resetDraft}
        />
      )}
      {drawer && drawerView && (
        <CausalDrawer
          measurement={drawerView.measurement}
          target={drawer.target}
          entityLabel={drawerView.label}
          scopeNote={drawerView.scopeNote}
          activeStage={drawer.stage}
          ancestors={drawer.history}
          nextTargets={drawerView.nextTargets}
          sourceRecord={drawerView.sourceRecord}
          onStage={(stage) => setDrawer((current) => current ? { ...current, stage } : current)}
          onNavigate={navigateDrawer}
          onAncestor={(index) => setDrawer((current) => {
            if (!current || !current.history[index]) return current;
            return {
              target: current.history[index],
              stage: "location",
              history: current.history.slice(0, index),
            };
          })}
          onBack={() => setDrawer((current) => {
            if (!current || current.history.length === 0) return current;
            const target = current.history.at(-1)!;
            return { target, stage: "location", history: current.history.slice(0, -1) };
          })}
          onClose={() => setDrawer(null)}
        />
      )}
      {uploadOpen && <div role="dialog" aria-label="Upload inventory" />}
    </main>
  );
}
~~~

Replace `src/app/page.tsx` so the application mounts the planner:

~~~tsx
import { PlannerPage } from "@/features/PlannerPage";

export default function HomePage() {
  return <PlannerPage />;
}
~~~

Task 12 replaces the empty upload-dialog shell with `UploadDialog`; Task 11 renders `RfqDrawer` when `state.status === "rfq"`. `PlannerPage` owns one reducer, one active lens, and one ID-bearing drawer history. Every brief, face, or zone change recomputes the plan and exact fingerprint. Applying a claim-degraded but package-valid draft is allowed; invalid cost, availability, site count, or zone constraints disable Apply with the exact reason code.

- [ ] **Step 7: Add the visual hierarchy**

Use CSS custom properties and this desktop layout:

~~~css
.planner-shell {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  min-height: 100vh;
}

.map-region {
  position: relative;
  min-height: 620px;
  background: #e9edf1;
}

.map-surface { position: absolute; inset: 0; }
.map-marker {
  --marker-scale: 0.5;
  display: grid;
  place-items: center;
  width: calc(30px + 24px * var(--marker-scale));
  height: calc(30px + 24px * var(--marker-scale));
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: #145c54;
  color: #ffffff;
  box-shadow: 0 4px 14px rgb(16 32 51 / 24%);
  font-size: 11px;
  font-weight: 750;
}
.map-marker:focus-visible { outline: 3px solid #ffbf47; outline-offset: 3px; }
.map-attribution {
  position: absolute;
  right: 8px;
  bottom: 6px;
  padding: 3px 6px;
  background: rgb(255 255 255 / 90%);
  font-size: 11px;
}

.upload-map {
  position: relative;
  min-height: 340px;
  overflow: hidden;
  border: 1px solid #dce1e8;
  border-radius: 12px;
}

.comparison-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.comparison-pair > section {
  padding: 12px;
  border: 1px solid #dce1e8;
  border-radius: 10px;
  background: #ffffff;
}

.zone-cards {
  position: absolute;
  top: 76px;
  left: 16px;
  z-index: 2;
  width: min(360px, calc(100% - 32px));
}

.package-strip {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.8fr 0.8fr auto;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  background: #ffffff;
  border-top: 1px solid #dce1e8;
}

@media (max-width: 820px) {
  .planner-shell { display: block; }
  .map-region { min-height: 58vh; }
  .zone-cards { position: relative; top: 64px; left: 0; width: auto; margin: 0 12px; }
  .package-strip { grid-template-columns: 1fr 1fr; }
  .comparison-pair { grid-template-columns: 1fr; }
}
~~~

Do not add a dashboard grid, chart library, arbitrary weight editor, or competing alternative-package comparison. The compact previous/proposed `What changed?` panel above is the only side-by-side comparison and keeps its original-plan baseline behind a disclosure.

- [ ] **Step 8: Run component and accessibility-unit tests**

Run:

~~~bash
pnpm test -- tests/component/PlannerPage.test.tsx tests/component/PackageStrip.test.tsx tests/component/CausalDrawer.test.tsx
pnpm typecheck
~~~

Expected: all tests PASS; there are exactly three zone cards and one package strip; stage buttons are keyboard reachable and evidence is not colour-only.

- [ ] **Step 9: Commit**

~~~bash
git add src/app src/features src/application/plannerSelectors.ts src/application/permittedDeliveryView.ts tests/component
git commit -m "feat: add map-first planning experience"
~~~

## Task 11: Generate the supplier-verification RFQ draft

**Files:**

- Create: `src/contracts/rfq.ts`
- Create: `src/planning/rfq.ts`
- Create: `src/features/RfqDrawer.tsx`
- Modify: `src/features/PlannerPage.tsx`
- Modify: `src/application/plannerReducer.ts`
- Create: `tests/fixtures/seededPlans.ts`
- Modify: `tests/unit/application/plannerReducer.test.ts`
- Test: `tests/unit/planning/rfq.test.ts`
- Test: `tests/component/RfqDrawer.test.tsx`

- [ ] **Step 1: Create deterministic plan and review fixtures**

Create `tests/fixtures/seededPlans.ts`:

~~~ts
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import type { RfqReviewInput } from "@/contracts/rfq";
import { optimizePackage } from "@/planning/packageOptimizer";

export const seededFmcgPlan = optimizePackage(frozenLagosBundle, {
  productName: "Demo Spark",
  productDescription: "Affordable on-the-go refreshment launch",
  targetAudience: "Students, young workers, and convenience shoppers",
  sector: "fmcg",
  objective: "broad_reach",
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
});

export const deterministicReview: RfqReviewInput = {
  buyerContact: { name: "Demo Buyer", email: "buyer@example.test" },
  responseDeadline: "2026-08-20",
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
  datesConfirmed: true,
  supplierNotes: {},
};
~~~

- [ ] **Step 2: Write the failing RFQ safety tests**

Create `tests/unit/planning/rfq.test.ts` with this acceptance table before implementing the generator:

~~~ts
import { describe, expect, it } from "vitest";
import { applyUploadContextToPlan } from "@/application/plannerService";
import { frozenLagosBundle as bundle } from "@/bundle/loadFrozenBundle";
import type { PlanningResult } from "@/contracts/domain";
import { buildInternalDownload, generateRfq } from "@/planning/rfq";
import { deterministicReview, seededFmcgPlan as plan } from "../../fixtures/seededPlans";

describe("generateRfq", () => {
  const rejectedCases: Array<[string, PlanningResult, unknown]> = [
    ["PACKAGE_INVALID", { ...plan, recommended: { ...plan.recommended, valid: false } }, deterministicReview],
    ["FLIGHT_DATES_NOT_CONFIRMED", plan, { ...deterministicReview, datesConfirmed: false }],
    ["FLIGHT_DATE_ORDER_INVALID", plan, { ...deterministicReview, flightEnd: "2026-08-01" }],
  ];

  it.each(rejectedCases)("rejects %s", (code, candidate, review) => {
    expect(() => generateRfq(bundle, candidate, review)).toThrow(String(code));
  });

  it("rejects stale applied IDs/fingerprints and notes for an inactive supplier", () => {
    const stale = {
      ...plan,
      recommended: { ...plan.recommended, estimateFingerprint: "stale" },
    };
    expect(() => generateRfq(bundle, stale, deterministicReview))
      .toThrow("STALE_APPLIED_PLAN");
    const staleReplay = {
      ...plan,
      replay: { ...plan.replay, exposurePlanFingerprint: "stale-replay" },
    };
    expect(() => generateRfq(bundle, staleReplay, deterministicReview))
      .toThrow("STALE_APPLIED_PLAN");
    expect(() => generateRfq(bundle, plan, {
      ...deterministicReview,
      supplierNotes: { "supplier-not-selected": "Do not leak this" },
    })).toThrow("UNKNOWN_SUPPLIER_NOTE");
  });

  it.each([
    { ...deterministicReview, buyerContact: { name: "D", email: "bad" } },
    { ...deterministicReview, responseDeadline: "2026-09-01" },
  ])("rejects invalid contact or deadline review input", (review) => {
    expect(() => generateRfq(bundle, plan, review)).toThrow();
  });

  it("contains every campaign field, selected line, verification request and replay value", () => {
    const rfq = generateRfq(bundle, plan, deterministicReview);
    expect(rfq.internalRequest.campaign).toMatchObject({
      product: { name: "Demo Spark" },
      sector: "fmcg",
      objective: "broad_reach",
      targetAudience: plan.brief.targetAudience,
      flight: { start: "2026-09-01", end: "2026-09-28", datesConfirmed: true },
      responseDeadline: "2026-08-20",
    });
    expect(rfq.internalRequest.lines.map((line) => line.faceId).sort())
      .toEqual([...plan.recommended.siteIds].sort());
    expect(rfq.internalRequest.audiencePlanningBasis).toMatchObject({
      targetDefinition: plan.brief.targetAudience,
      targetUniverse: plan.measurement.claim.kind === "scenario_target_reach"
        ? plan.measurement.claim.universe
        : null,
      modelVersion: bundle.manifest.modelVersion,
      targetUniverseVersion: bundle.manifest.targetUniverseVersion,
      intervalType: "scenario",
      estimateValidity: "EXACT_APPLIED_PLAN",
      contextRevision: null,
    });
    expect(rfq.internalRequest.audiencePlanningBasis.targetReachSharePercent)
      .not.toBeNull();
    expect(rfq.internalRequest.audiencePlanningBasis.priorityInfluenceArchetypes)
      .toEqual([...rfq.internalRequest.audiencePlanningBasis.priorityInfluenceArchetypes].sort());
    for (const line of rfq.internalRequest.lines) {
      expect(line).toMatchObject({
        supplierId: expect.any(String),
        ownerSeller: expect.any(String),
        assetId: line.faceId,
        structureId: null,
        address: expect.any(String),
        coordinate: { longitude: expect.any(Number), latitude: expect.any(Number) },
        dimensions: null,
        requestedSchedule: { quantity: 1 },
        indicativeRate: { currency: "NGN", basis: "illustrative_demo_line_rate" },
      });
    }
    expect(rfq.internalRequest.lines.every((line) =>
      Object.values(line.confirmationRequests).every((value) => value === "REQUESTED")
    )).toBe(true);
    expect(buildInternalDownload(rfq)).toContain(plan.replay.exposurePlanFingerprint);
  });

  it("isolates supplier copy from internal budget, audience, replay and other suppliers", () => {
    const supplierIds = [...new Set(plan.recommended.siteIds.map((siteId) =>
      bundle.sites.find((site) => site.id === siteId)!.supplierId
    ))].sort();
    const notes = Object.fromEntries(supplierIds.map((id, index) => [
      id,
      "Private supplier note " + index,
    ]));
    const rfq = generateRfq(bundle, plan, {
      ...deterministicReview,
      supplierNotes: notes,
    });
    for (const message of rfq.supplierMessages) {
      const otherIds = rfq.internalRequest.lines
        .filter((line) => line.supplierId !== message.supplierId)
        .map((line) => line.faceId);
      const otherAddresses = rfq.internalRequest.lines
        .filter((line) => line.supplierId !== message.supplierId)
        .map((line) => line.address);
      expect(message.lines.every((line) => line.supplierId === message.supplierId)).toBe(true);
      for (const line of message.lines) {
        expect(message.body).toContain(line.assetId);
        expect(message.body).toContain(line.address);
        expect(message.body).toContain(String(line.coordinate.latitude));
        expect(message.body).toContain(line.indicativeRate.basis);
      }
      expect(otherIds.every((id) => !message.body.includes(id))).toBe(true);
      expect(otherAddresses.every((address) => !message.body.includes(address))).toBe(true);
      expect(message.body).toContain(notes[message.supplierId]);
      expect(Object.entries(notes).filter(([id]) => id !== message.supplierId)
        .every(([, note]) => !message.body.includes(note))).toBe(true);
      expect(message.body).not.toContain(String(plan.brief.budgetNgn));
      expect(message.body).not.toMatch(/Influence Capture|exposurePlanFingerprint|panelVersion/i);
    }
  });

  it("invalidates internal numeric estimates when reviewed dates change", () => {
    const rfq = generateRfq(bundle, plan, {
      ...deterministicReview,
      flightStart: "2026-09-08",
    });
    expect(rfq.internalRequest.audiencePlanningBasis.estimateValidity)
      .toBe("RFQ_SCHEDULE_REQUIRES_RECOMPUTE");
    expect(rfq.internalRequest.audiencePlanningBasis.targetReach).toBeNull();
  });

  it("keeps a valid context shortlist generatable with audience estimates unavailable", () => {
    const context = {
      ...plan,
      recommended: {
        ...plan.recommended,
        mode: "context_shortlist" as const,
        planningFit: null,
        pillars: null,
      },
    };
    expect(generateRfq(bundle, context, deterministicReview)
      .internalRequest.audiencePlanningBasis.estimateValidity)
      .toBe("CONTEXT_SHORTLIST_ONLY");
  });

  it("keeps applied upload provenance internal without changing seeded delivery claims", () => {
    const applied = applyUploadContextToPlan(bundle, plan, {
      mode: "context_shortlist" as const,
      selectedRowIds: ["UP-001"],
      enrichmentSnapshotId: "snapshot-upload-1",
      dataRevision: "upload-context-v1",
      claimResolution: {
        highest: "context" as const,
        influenceEligible: false,
        evidenceCap: "D" as const,
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
        recoveryAction: "Provide a feature-compatible calibration bundle",
      },
      planningFit: null,
    });
    expect(applied.measurement.fingerprint).not.toBe(plan.measurement.fingerprint);
    expect(applied.replay).toMatchObject({
      enrichmentSnapshotId: "snapshot-upload-1",
      dataRevision: "upload-context-v1",
    });
    const rfq = generateRfq(bundle, applied, deterministicReview);
    expect(rfq.internalRequest.audiencePlanningBasis).toMatchObject({
      estimateValidity: "EXACT_APPLIED_PLAN",
      contextRevision: {
        enrichmentSnapshotId: "snapshot-upload-1",
        dataRevision: "upload-context-v1",
        decisionUse: "context_only",
        reasonCode: "CALIBRATION_BUNDLE_MISMATCH",
      },
    });
    const supplierCopy = JSON.stringify(rfq.supplierMessages);
    expect(supplierCopy).not.toContain("snapshot-upload-1");
    expect(supplierCopy).not.toContain("upload-context-v1");
    expect(supplierCopy).not.toContain("CALIBRATION_BUNDLE_MISMATCH");
  });

  it("is deterministic, watermarked, and contains no transactional guarantee", () => {
    const first = generateRfq(bundle, plan, deterministicReview);
    const second = generateRfq(bundle, plan, deterministicReview);
    expect(first).toEqual(second);
    const text = JSON.stringify(first);
    expect(text).toContain("DEMO — DO NOT SEND");
    expect(text).not.toMatch(/\b(booked|reserved|sent|guaranteed)\b/i);
  });
});
~~~

Run `pnpm test -- tests/unit/planning/rfq.test.ts` and expect FAIL because the contract and generator do not exist.

- [ ] **Step 3: Define the reviewed RFQ contract**

Create `src/contracts/rfq.ts`:

~~~ts
import { z } from "zod";
import type { Daypart, Objective, Sector } from "@/contracts/domain";
import type { MetricClaim, ReplayEnvelope } from "@/contracts/metrics";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const RfqReviewInputSchema = z.object({
  buyerContact: z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
  }),
  responseDeadline: IsoDateSchema,
  flightStart: IsoDateSchema,
  flightEnd: IsoDateSchema,
  datesConfirmed: z.boolean(),
  supplierNotes: z.record(z.string().min(1), z.string().trim().max(2_000)).default({}),
}).superRefine((value, context) => {
  if (!value.datesConfirmed) context.addIssue({
    code: "custom", path: ["datesConfirmed"], message: "FLIGHT_DATES_NOT_CONFIRMED",
  });
  if (value.flightStart > value.flightEnd) context.addIssue({
    code: "custom", path: ["flightEnd"], message: "FLIGHT_DATE_ORDER_INVALID",
  });
  if (value.responseDeadline >= value.flightStart) context.addIssue({
    code: "custom", path: ["responseDeadline"], message: "RESPONSE_DEADLINE_TOO_LATE",
  });
});
export type RfqReviewInput = z.infer<typeof RfqReviewInputSchema>;

export type CampaignRfqFields = {
  product: { name: string; description: string };
  sector: Sector;
  objective: Objective;
  targetAudience: string;
  geography: { market: "Lagos"; zones: Array<{ id: string; label: string }> };
  flight: { start: string; end: string; daypart: Daypart; datesConfirmed: true };
  buyerContact: RfqReviewInput["buyerContact"];
  responseDeadline: string;
  creativeCompliance: {
    status: "confirmation_required";
    notes: string[];
  };
};

export type SupplierRfqLine = {
  supplierId: string;
  ownerSeller: string;
  assetId: string;
  structureId: string | null;
  faceId: string;
  address: string;
  coordinate: { longitude: number; latitude: number };
  format: string;
  dimensions: string | null;
  mediaClass: "STATIC" | "DOOH";
  requestedSchedule: {
    start: string;
    end: string;
    daypart: Daypart;
    quantity: 1;
    shareOfTimePercent: number | null;
  };
  indicativeRate: {
    amount: number;
    currency: "NGN";
    basis: "illustrative_demo_line_rate";
  };
  confirmationRequests: {
    identityAndOrientation: "REQUESTED";
    dimensions: "REQUESTED";
    availability: "REQUESTED";
    grossAndNetRate: "REQUESTED";
    production: "REQUESTED";
    installation: "REQUESTED";
    taxes: "REQUESTED";
    leadTime: "REQUESTED";
    permitOrAuthorization: "REQUESTED";
    proofOfPostingOrPlay: "REQUESTED";
    measurementDeliverables: "REQUESTED";
    faceLevelAudienceMethodFiles: "REQUESTED";
  };
};

export type RfqRange =
  | { type: "scenario"; low: number; base: number; high: number }
  | { type: "quantile"; p10: number; p50: number; p90: number };

export type AudiencePlanningBasis = {
  estimateValidity:
    | "EXACT_APPLIED_PLAN"
    | "RFQ_SCHEDULE_REQUIRES_RECOMPUTE"
    | "CONTEXT_SHORTLIST_ONLY";
  targetReach: MetricClaim | null;
  targetDefinition: string;
  targetUniverse: number | null;
  targetReachSharePercent: RfqRange | null;
  influenceCapture: MetricClaim | null;
  priorityInfluenceArchetypes: string[];
  exposureBasis: "target people with at least one modelled OOH opportunity to see";
  exposureThreshold: "1+";
  modelVersion: string;
  targetUniverseVersion: string;
  influenceProfileVersion: string | null;
  intervalType: "scenario" | "quantile" | "unavailable";
  contextRevision: {
    enrichmentSnapshotId: string;
    dataRevision: string;
    decisionUse: "context_only";
    reasonCode: string | null;
  } | null;
  evidence: { recommendation: string; reach: string; influence: string | null };
  limitations: string[];
  replay: ReplayEnvelope;
};

export type SupplierMessage = {
  supplierId: string;
  supplierNote: string;
  subject: string;
  body: string;
  lines: SupplierRfqLine[];
  watermark: "DEMO — DO NOT SEND";
  status: "draft_unbooked_unsent";
};

export type InternalRfqRequest = {
  watermark: "DEMO — DO NOT SEND";
  status: "draft_unbooked_unsent";
  planFingerprint: string;
  campaign: CampaignRfqFields;
  internalBudget: { amount: number; currency: "NGN" };
  packageCost: { amount: number; currency: "NGN" };
  lines: SupplierRfqLine[];
  supplierNotes: Record<string, string>;
  audiencePlanningBasis: AudiencePlanningBasis;
};

export type RfqDraft = {
  watermark: "DEMO — DO NOT SEND";
  status: "draft_unbooked_unsent";
  supplierMessages: SupplierMessage[];
  internalRequest: InternalRfqRequest;
};

export type RfqWorkflowState =
  | { status: "Review required" }
  | { status: "Generating" }
  | { status: "Generated"; output: RfqDraft }
  | { status: "Generation failed"; message: string };
~~~

- [ ] **Step 4: Implement deterministic generation and isolation**

Create `src/planning/rfq.ts`:

~~~ts
import type { FrozenBundle } from "@/bundle/bundleSchema";
import type { PlanningResult } from "@/contracts/domain";
import {
  RfqReviewInputSchema,
  type AudiencePlanningBasis,
  type RfqDraft,
  type RfqRange,
  type SupplierRfqLine,
} from "@/contracts/rfq";
import { canonicalJson } from "@/shared/canonicalJson";

const requested = {
  identityAndOrientation: "REQUESTED",
  dimensions: "REQUESTED",
  availability: "REQUESTED",
  grossAndNetRate: "REQUESTED",
  production: "REQUESTED",
  installation: "REQUESTED",
  taxes: "REQUESTED",
  leadTime: "REQUESTED",
  permitOrAuthorization: "REQUESTED",
  proofOfPostingOrPlay: "REQUESTED",
  measurementDeliverables: "REQUESTED",
  faceLevelAudienceMethodFiles: "REQUESTED",
} as const;

function parseReview(rawReview: unknown) {
  const parsed = RfqReviewInputSchema.safeParse(rawReview);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "RFQ_REVIEW_INVALID");
  }
  return parsed.data;
}

function reachShareRange(range: RfqRange, universe: number): RfqRange {
  return range.type === "scenario"
    ? {
        type: "scenario",
        low: 100 * range.low / universe,
        base: 100 * range.base / universe,
        high: 100 * range.high / universe,
      }
    : {
        type: "quantile",
        p10: 100 * range.p10 / universe,
        p50: 100 * range.p50 / universe,
        p90: 100 * range.p90 / universe,
      };
}

function renderSupplierLine(line: SupplierRfqLine): string {
  return [
    "Asset/structure/face: " + line.assetId + " / " +
      (line.structureId ?? "Confirmation requested") + " / " + line.faceId,
    "Address/coordinate: " + line.address + " / " +
      line.coordinate.latitude + ", " + line.coordinate.longitude,
    "Format/class/dimensions: " + line.format + " / " + line.mediaClass + " / " +
      (line.dimensions ?? "Confirmation requested"),
    "Schedule: " + line.requestedSchedule.start + " to " +
      line.requestedSchedule.end + " / " + line.requestedSchedule.daypart +
      " / quantity " + line.requestedSchedule.quantity + " / share of time " +
      (line.requestedSchedule.shareOfTimePercent ?? "Confirmation requested"),
    "Indicative rate: NGN " + line.indicativeRate.amount +
      " / " + line.indicativeRate.basis,
    "Confirm: " + Object.keys(line.confirmationRequests).sort().join(", "),
  ].join("\n");
}

export function generateRfq(
  bundle: FrozenBundle,
  appliedPlan: PlanningResult,
  rawReview: unknown,
): RfqDraft {
  if (!appliedPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
  if (
    appliedPlan.recommended.estimateFingerprint !== appliedPlan.measurement.fingerprint ||
    appliedPlan.replay.exposurePlanFingerprint !== appliedPlan.measurement.fingerprint ||
    appliedPlan.measurement.replay.exposurePlanFingerprint !== appliedPlan.measurement.fingerprint ||
    [...appliedPlan.recommended.siteIds].sort().join("|") !==
      [...appliedPlan.replay.controls.siteIds].sort().join("|")
  ) throw new Error("STALE_APPLIED_PLAN");
  const review = parseReview(rawReview);
  const activeSites = appliedPlan.recommended.siteIds.map((siteId) => {
    const site = bundle.sites.find((candidate) => candidate.id === siteId);
    if (!site) throw new Error("UNKNOWN_ASSET");
    return site;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const supplierIds = [...new Set(activeSites.map((site) => site.supplierId))].sort();
  if (Object.keys(review.supplierNotes).some((id) => !supplierIds.includes(id))) {
    throw new Error("UNKNOWN_SUPPLIER_NOTE");
  }
  const lines: SupplierRfqLine[] = activeSites.map((site) => ({
    supplierId: site.supplierId,
    ownerSeller: site.supplierId,
    assetId: site.id,
    structureId: null,
    faceId: site.id,
    address: site.label,
    coordinate: { longitude: site.coordinate[0], latitude: site.coordinate[1] },
    format: site.format,
    dimensions: null,
    mediaClass: site.format === "dooh" ? "DOOH" : "STATIC",
    requestedSchedule: {
      start: review.flightStart,
      end: review.flightEnd,
      daypart: appliedPlan.brief.daypart,
      quantity: 1,
      shareOfTimePercent: site.format === "dooh"
        ? site.deliverySchedule.shareOfTime * 100
        : null,
    },
    indicativeRate: {
      amount: site.rateNgn,
      currency: "NGN",
      basis: "illustrative_demo_line_rate",
    },
    confirmationRequests: requested,
  }));
  const changedSchedule =
    review.flightStart !== appliedPlan.brief.flightStart ||
    review.flightEnd !== appliedPlan.brief.flightEnd;
  const contextOnly = appliedPlan.recommended.mode === "context_shortlist";
  const estimateValidity: AudiencePlanningBasis["estimateValidity"] = contextOnly
    ? "CONTEXT_SHORTLIST_ONLY"
    : changedSchedule
      ? "RFQ_SCHEDULE_REQUIRES_RECOMPUTE"
      : "EXACT_APPLIED_PLAN";
  const reachClaim = estimateValidity === "EXACT_APPLIED_PLAN" && (
    appliedPlan.measurement.claim.kind === "scenario_target_reach" ||
    appliedPlan.measurement.claim.kind === "calibrated_target_reach"
  )
    ? appliedPlan.measurement.claim
    : null;
  const influenceClaim = estimateValidity === "EXACT_APPLIED_PLAN"
    ? appliedPlan.measurement.influence
    : null;
  const influenceProfileVersion = influenceClaim?.kind === "influence_capture"
    ? influenceClaim.qiSourceId
    : influenceClaim?.kind === "influence_weighted_coverage"
      ? influenceClaim.weightSourceId
      : null;
  const audiencePlanningBasis: AudiencePlanningBasis = {
    estimateValidity,
    targetReach: reachClaim,
    targetDefinition: appliedPlan.brief.targetAudience,
    targetUniverse: reachClaim?.universe ?? null,
    targetReachSharePercent: reachClaim
      ? reachShareRange(reachClaim.range, reachClaim.universe)
      : null,
    influenceCapture: influenceClaim,
    priorityInfluenceArchetypes: bundle.targets
      .filter((target) => target.sector === appliedPlan.brief.sector)
      .map((target) => target.cellId)
      .sort(),
    exposureBasis: "target people with at least one modelled OOH opportunity to see",
    exposureThreshold: "1+",
    modelVersion: bundle.manifest.modelVersion,
    targetUniverseVersion: bundle.manifest.targetUniverseVersion,
    influenceProfileVersion,
    intervalType: reachClaim?.range.type ?? "unavailable",
    contextRevision: appliedPlan.contextRevision ? {
      enrichmentSnapshotId: appliedPlan.contextRevision.enrichmentSnapshotId,
      dataRevision: appliedPlan.contextRevision.dataRevision,
      decisionUse: "context_only",
      reasonCode: appliedPlan.contextRevision.claimResolution.reasonCode,
    } : null,
    evidence: {
      recommendation: appliedPlan.recommended.evidenceGrade,
      reach: appliedPlan.measurement.evidenceGrades.reach,
      influence: appliedPlan.measurement.evidenceGrades.influence,
    },
    limitations: [
      ...appliedPlan.measurement.claim.caveats,
      ...(changedSchedule ? ["Reviewed RFQ schedule differs; recompute audience estimates before reliance"] : []),
      ...(contextOnly ? ["Audience delivery unavailable; context shortlist only"] : []),
    ],
    replay: appliedPlan.replay,
  };
  const campaign = {
    product: {
      name: appliedPlan.brief.productName,
      description: appliedPlan.brief.productDescription,
    },
    sector: appliedPlan.brief.sector,
    objective: appliedPlan.brief.objective,
    targetAudience: appliedPlan.brief.targetAudience,
    geography: {
      market: "Lagos" as const,
      zones: appliedPlan.selectedZoneIds.map((id) => ({
        id,
        label: bundle.zones.find((zone) => zone.id === id)?.label ?? id,
      })),
    },
    flight: {
      start: review.flightStart,
      end: review.flightEnd,
      daypart: appliedPlan.brief.daypart,
      datesConfirmed: true as const,
    },
    buyerContact: review.buyerContact,
    responseDeadline: review.responseDeadline,
    creativeCompliance: {
      status: "confirmation_required" as const,
      notes: ["Supplier to confirm artwork, production, installation, permits, and lead time"],
    },
  };
  const supplierMessages = supplierIds.map((supplierId) => {
    const supplierLines = lines.filter((line) => line.supplierId === supplierId);
    const note = review.supplierNotes[supplierId] ?? "";
    const body = [
      "DEMO — DO NOT SEND",
      campaign.product.name + " — supplier verification request",
      "Sector/objective: " + campaign.sector + " / " + campaign.objective,
      "Target audience: " + campaign.targetAudience,
      "Buyer: " + review.buyerContact.name + " <" + review.buyerContact.email + ">",
      "Response deadline: " + review.responseDeadline,
      "Confirmed flight: " + review.flightStart + " to " + review.flightEnd + " · " + campaign.flight.daypart,
      "Creative/compliance: supplier confirmation required before activation.",
      supplierLines.map(renderSupplierLine).join("\n\n"),
      note ? "Supplier note: " + note : "",
      "Please confirm identity/orientation, dimensions, availability, gross/net rate, production, installation, taxes, lead time, permits, proof of posting/play, measurement deliverables, and face-level audience provider/target/universe/period/method/uncertainty files.",
      "Status: draft, unbooked, unsent",
    ].filter(Boolean).join("\n");
    return {
      supplierId,
      supplierNote: note,
      subject: "Request for rate, availability and face verification",
      body,
      lines: supplierLines,
      watermark: "DEMO — DO NOT SEND" as const,
      status: "draft_unbooked_unsent" as const,
    };
  });
  return {
    watermark: "DEMO — DO NOT SEND",
    status: "draft_unbooked_unsent",
    supplierMessages,
    internalRequest: {
      watermark: "DEMO — DO NOT SEND",
      status: "draft_unbooked_unsent",
      planFingerprint: appliedPlan.measurement.fingerprint,
      campaign,
      internalBudget: { amount: appliedPlan.brief.budgetNgn, currency: "NGN" },
      packageCost: { amount: appliedPlan.recommended.costNgn, currency: "NGN" },
      lines,
      supplierNotes: review.supplierNotes,
      audiencePlanningBasis,
    },
  };
}

export function buildInternalDownload(rfq: RfqDraft): string {
  return canonicalJson(rfq.internalRequest) + "\n";
}
~~~

- [ ] **Step 5: Make RFQ entry atomic in the reducer**

Extend `PlannerAction` with:

~~~ts
  | { type: "apply-and-review-rfq" }
  | { type: "close-rfq" }
  | { type: "close-rfq-with-draft"; plan: PlanningResult }
~~~

Replace the existing `review-rfq` case with the case below, then append the two new cases; do not leave a duplicate case. Plain review is forbidden while dirty or invalid:

~~~ts
case "review-rfq":
  if (!state.appliedPlan) throw new Error("NO_APPLIED_PLAN");
  if (state.draftPlan) throw new Error("APPLY_DRAFT_BEFORE_RFQ");
  if (!state.appliedPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
  return { ...state, status: "rfq" };
case "apply-and-review-rfq":
  if (!state.draftPlan) throw new Error("NO_DRAFT_PLAN");
  if (!state.draftPlan.recommended.valid) throw new Error("PACKAGE_INVALID");
  return {
    ...state,
    appliedPlan: state.draftPlan,
    draftPlan: null,
    draftHistory: [],
    lastAction: null,
    status: "rfq",
  };
case "close-rfq":
  return { ...state, status: "loaded" };
case "close-rfq-with-draft":
  return {
    ...state,
    draftPlan: action.plan,
    draftHistory: [],
    lastAction: "RFQ schedule changed",
    status: "dirty",
  };
~~~

Replace `reviewRfq()` in `PlannerPage` with the single transition:

~~~ts
function reviewRfq() {
  if (!visible?.recommended.valid) return;
  dispatch({ type: dirty ? "apply-and-review-rfq" : "review-rfq" });
}
~~~

Extend `plannerReducer.test.ts`:

~~~ts
it("atomically applies a valid draft and enters RFQ without replacing original", () => {
  const original = buildPlan(frozenLagosBundle, brief);
  const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
  const draft = recalculatePlan(frozenLagosBundle, original, { daypart: "evening" });
  const dirty = plannerReducer(loaded, { type: "drafted", plan: draft });
  const rfq = plannerReducer(dirty, { type: "apply-and-review-rfq" });
  expect(rfq).toMatchObject({
    originalPlan: original,
    appliedPlan: draft,
    draftPlan: null,
    draftHistory: [],
    status: "rfq",
  });
});

it("rejects direct dirty or invalid review and closes a valid RFQ to loaded", () => {
  const original = buildPlan(frozenLagosBundle, brief);
  const loaded = plannerReducer(initialPlannerState, { type: "loaded", plan: original });
  const draft = recalculatePlan(frozenLagosBundle, original, { daypart: "evening" });
  const dirty = plannerReducer(loaded, { type: "drafted", plan: draft });
  expect(() => plannerReducer(dirty, { type: "review-rfq" }))
    .toThrow("APPLY_DRAFT_BEFORE_RFQ");
  const invalid = {
    ...loaded,
    appliedPlan: {
      ...original,
      recommended: { ...original.recommended, valid: false },
    },
  };
  expect(() => plannerReducer(invalid, { type: "review-rfq" }))
    .toThrow("PACKAGE_INVALID");
  const review = plannerReducer(loaded, { type: "review-rfq" });
  expect(plannerReducer(review, { type: "close-rfq" }).status).toBe("loaded");
});

it("turns changed RFQ dates into a recomputed dirty schedule revision", () => {
  const original = buildPlan(frozenLagosBundle, brief);
  const review = plannerReducer(
    plannerReducer(initialPlannerState, { type: "loaded", plan: original }),
    { type: "review-rfq" },
  );
  const revised = recalculatePlan(frozenLagosBundle, original, {
    flightStart: "2026-09-08",
  });
  const dirty = plannerReducer(review, {
    type: "close-rfq-with-draft",
    plan: revised,
  });
  expect(dirty.status).toBe("dirty");
  expect(dirty.appliedPlan).toBe(original);
  expect(dirty.draftPlan).toBe(revised);
  expect(revised.measurement.fingerprint).not.toBe(original.measurement.fingerprint);
});
~~~

- [ ] **Step 6: Build the focused review-and-download drawer**

Create `src/features/RfqDrawer.tsx`. Keep the generated message immutable; only review inputs are editable:

~~~tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import type { PlanningResult } from "@/contracts/domain";
import {
  RfqReviewInputSchema,
  type RfqDraft,
  type RfqWorkflowState,
} from "@/contracts/rfq";
import { buildInternalDownload, generateRfq } from "@/planning/rfq";

export function downloadText(fileName: string, value: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RfqDrawer({
  plan,
  onClose,
  onScheduleRevision,
  generator = generateRfq,
}: {
  plan: PlanningResult;
  onClose(): void;
  onScheduleRevision(flightStart: string, flightEnd: string): void;
  generator?: typeof generateRfq;
}) {
  const supplierIds = [...new Set(plan.recommended.siteIds.map((siteId) =>
    frozenLagosBundle.sites.find((site) => site.id === siteId)!.supplierId
  ))].sort();
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [flightStart, setFlightStart] = useState(plan.brief.flightStart);
  const [flightEnd, setFlightEnd] = useState(plan.brief.flightEnd);
  const [datesConfirmed, setDatesConfirmed] = useState(false);
  const [supplierNotes, setSupplierNotes] = useState<Record<string, string>>({});
  const [workflow, setWorkflow] = useState<RfqWorkflowState>({ status: "Review required" });
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);
  const review = {
    buyerContact: { name: buyerName, email: buyerEmail },
    responseDeadline,
    flightStart,
    flightEnd,
    datesConfirmed,
    supplierNotes,
  };
  const datesMatchAppliedPlan = flightStart === plan.brief.flightStart &&
    flightEnd === plan.brief.flightEnd;
  const valid = plan.recommended.valid && datesMatchAppliedPlan &&
    RfqReviewInputSchema.safeParse(review).success;
  function change(action: () => void) {
    action();
    setWorkflow({ status: "Review required" });
  }
  async function generate() {
    setWorkflow({ status: "Generating" });
    await Promise.resolve();
    try {
      setWorkflow({ status: "Generated", output: generator(frozenLagosBundle, plan, review) });
    } catch (error) {
      setWorkflow({
        status: "Generation failed",
        message: error instanceof Error ? error.message : "RFQ_GENERATION_FAILED",
      });
    }
  }
  const output: RfqDraft | null = workflow.status === "Generated" ? workflow.output : null;
  return <aside role="dialog" aria-modal="true" aria-label="Supplier verification RFQ">
    <button ref={closeRef} type="button" onClick={onClose}>Close</button>
    <strong>DEMO — DO NOT SEND</strong>
    <p>{workflow.status}</p>
    {workflow.status === "Generation failed" && <p role="alert">{workflow.message}</p>}
    <label>Buyer name<input value={buyerName} onChange={(event) => change(() => setBuyerName(event.target.value))} /></label>
    <label>Buyer email<input type="email" value={buyerEmail} onChange={(event) => change(() => setBuyerEmail(event.target.value))} /></label>
    <label>Response deadline<input type="date" value={responseDeadline} onChange={(event) => change(() => setResponseDeadline(event.target.value))} /></label>
    <label>Flight start<input type="date" value={flightStart} onChange={(event) => change(() => setFlightStart(event.target.value))} /></label>
    <label>Flight end<input type="date" value={flightEnd} onChange={(event) => change(() => setFlightEnd(event.target.value))} /></label>
    {!datesMatchAppliedPlan && <section aria-label="Schedule revision required">
      <p>Dates changed. Recompute a dirty plan revision before generating the RFQ.</p>
      <button
        type="button"
        disabled={flightStart > flightEnd}
        onClick={() => onScheduleRevision(flightStart, flightEnd)}
      >
        Recompute plan with these dates
      </button>
    </section>}
    <label><input type="checkbox" checked={datesConfirmed} onChange={(event) => change(() => setDatesConfirmed(event.target.checked))} />Dates confirmed</label>
    {supplierIds.map((supplierId) => <label key={supplierId}>
      {supplierId} note
      <textarea value={supplierNotes[supplierId] ?? ""} onChange={(event) => change(() => setSupplierNotes((current) => ({ ...current, [supplierId]: event.target.value })))} />
    </label>)}
    <button type="button" disabled={!valid || workflow.status === "Generating"} onClick={() => void generate()}>Generate RFQ</button>
    {output?.supplierMessages.map((message) => <section key={message.supplierId}>
      <h2>{message.supplierId}</h2>
      <pre>{message.body}</pre>
      <button type="button" onClick={() => void navigator.clipboard.writeText(message.body)}>Copy {message.supplierId} request</button>
      <button type="button" onClick={() => downloadText(message.supplierId + "-rfq.txt", message.body)}>Download {message.supplierId} request</button>
    </section>)}
    {output && <button type="button" onClick={() => downloadText(
      "consolidated-internal-request.json",
      buildInternalDownload(output),
    )}>Download consolidated internal request</button>}
    <p>Status: draft, unbooked, unsent</p>
  </aside>;
}
~~~

Import `RfqDrawer` into `PlannerPage` and render it only for `state.status === "rfq" && state.appliedPlan`:

~~~tsx
{state.status === "rfq" && state.appliedPlan && (
  <RfqDrawer
    plan={state.appliedPlan}
    onClose={() => dispatch({ type: "close-rfq" })}
    onScheduleRevision={(flightStart, flightEnd) => {
      const revised = recalculatePlan(bundle, state.appliedPlan!, {
        flightStart,
        flightEnd,
      });
      setBrief(revised.brief);
      dispatch({ type: "close-rfq-with-draft", plan: revised });
    }}
  />
)}
~~~

Changing RFQ dates therefore closes review into a fully recomputed dirty plan, with a new schedule fingerprint and ordinary Undo/Reset/Apply semantics. There is no Send, Book, Reserve, API, storage, persistence, or editable generated-message control.

- [ ] **Step 7: Test the drawer workflow and run the RFQ suite**

Create `tests/component/RfqDrawer.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RfqDrawer } from "@/features/RfqDrawer";
import { generateRfq } from "@/planning/rfq";
import { seededFmcgPlan as plan } from "../fixtures/seededPlans";

async function completeReview() {
  await userEvent.type(screen.getByLabelText("Buyer name"), "Demo Buyer");
  await userEvent.type(screen.getByLabelText("Buyer email"), "buyer@example.test");
  await userEvent.type(screen.getByLabelText("Response deadline"), "2026-08-20");
  await userEvent.click(screen.getByLabelText("Dates confirmed"));
}

afterEach(() => vi.restoreAllMocks());

describe("RfqDrawer", () => {
  it("gates generation, exposes isolated downloads, and resets after an edit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<RfqDrawer
      plan={plan}
      onClose={() => undefined}
      onScheduleRevision={() => undefined}
    />);
    expect(screen.getByRole("button", { name: "Generate RFQ" })).toBeDisabled();
    await completeReview();
    await userEvent.click(screen.getByRole("button", { name: "Generate RFQ" }));
    expect(await screen.findByText("Generated", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Copy .* request$/ }).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Download .* request$/ }).length)
      .toBeGreaterThan(0);
    expect(screen.getByRole("button", {
      name: "Download consolidated internal request",
    })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send|book|reserve/i }))
      .not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Buyer name"), " Updated");
    expect(screen.getByText("Review required", { exact: true })).toBeInTheDocument();
  });

  it("shows observable generation failure without clearing reviewed fields", async () => {
    const failing: typeof generateRfq = () => {
      throw new Error("FIXTURE_GENERATION_FAILURE");
    };
    render(<RfqDrawer
      plan={plan}
      generator={failing}
      onClose={() => undefined}
      onScheduleRevision={() => undefined}
    />);
    await completeReview();
    await userEvent.click(screen.getByRole("button", { name: "Generate RFQ" }));
    expect(await screen.findByText("Generation failed", { exact: true }))
      .toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("FIXTURE_GENERATION_FAILURE");
    expect(screen.getByLabelText("Buyer name")).toHaveValue("Demo Buyer");
    expect(screen.getByLabelText("Buyer email")).toHaveValue("buyer@example.test");
    expect(screen.getByLabelText("Response deadline")).toHaveValue("2026-08-20");
    expect(screen.getByLabelText("Dates confirmed")).toBeChecked();
  });

  it("routes changed dates into a recomputed plan revision and supports Escape", async () => {
    const onScheduleRevision = vi.fn();
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const rendered = render(<RfqDrawer
      plan={plan}
      onClose={onClose}
      onScheduleRevision={onScheduleRevision}
    />);
    await userEvent.clear(screen.getByLabelText("Flight start"));
    await userEvent.type(screen.getByLabelText("Flight start"), "2026-09-08");
    expect(screen.getByRole("button", { name: "Generate RFQ" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", {
      name: "Recompute plan with these dates",
    }));
    expect(onScheduleRevision).toHaveBeenCalledWith("2026-09-08", "2026-09-28");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rendered.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
~~~

Run:

~~~bash
pnpm test -- tests/unit/planning/rfq.test.ts tests/unit/application/plannerReducer.test.ts tests/component/RfqDrawer.test.tsx
pnpm typecheck
~~~

Expected: all tests PASS; every seeded output is supplier-isolated, watermarked, editable only at the review boundary, unbooked, and unsent.

- [ ] **Step 8: Commit**

~~~bash
git add src/contracts/rfq.ts src/planning/rfq.ts src/features/RfqDrawer.tsx src/features/PlannerPage.tsx src/application/plannerReducer.ts tests/fixtures/seededPlans.ts tests/unit/application/plannerReducer.test.ts tests/unit/planning/rfq.test.ts tests/component/RfqDrawer.test.tsx
git commit -m "feat: add supplier verification RFQ"
~~~

## Task 12: Lock the golden demo, upload vignette, and release checks

**Files:**

- Create: `src/features/UploadDialog.tsx`
- Create: `src/features/UploadPreview.tsx`
- Create: `tests/e2e/seeded-fmcg.spec.ts`
- Create: `tests/e2e/sector-presets.spec.ts`
- Create: `tests/e2e/upload-enrichment.spec.ts`
- Create: `tests/e2e/network-disabled.spec.ts`
- Create: `tests/e2e/visual-accessibility.spec.ts`
- Generate and review: `tests/e2e/*-snapshots/*.png`
- Create: `tests/component/DegradedClaimViews.test.tsx`
- Create: `tests/fixtures/customer-owned-inventory.csv`
- Create: `scripts/build-golden-outputs.ts`
- Create: `scripts/verify-client-secrets.ts`
- Create: `tests/unit/demo/goldenOutputs.test.ts`
- Create: `src/demo/lagos-v1/golden-outputs.json`
- Create: `README.md`
- Create: `docs/demo-comprehension-check.md`
- Modify: `src/features/PlannerPage.tsx`

- [ ] **Step 1: Complete the upload and enrichment vignette**

Create `src/features/UploadPreview.tsx` as the numerical/list alternative to the upload map:

~~~tsx
import type { ValidatedInventoryRow } from "@/import/validateRows";

export function UploadPreview({
  rows,
  selected,
  onToggle,
}: {
  rows: ValidatedInventoryRow[];
  selected: Set<string>;
  onToggle(assetId: string): void;
}) {
  return (
    <fieldset>
      <legend>Select up to 50 accepted rows</legend>
      {rows.map((row) => (
        <label key={row.assetId}>
          <input
            type="checkbox"
            checked={selected.has(row.assetId)}
            disabled={!selected.has(row.assetId) && selected.size >= 50}
            onChange={() => onToggle(row.assetId)}
          />
          {row.assetId} · {row.address ?? `${row.latitude}, ${row.longitude}`} ·
          {row.modelEligible ? " model-eligible input" : " context-only"}
        </label>
      ))}
    </fieldset>
  );
}
~~~

Create `src/features/UploadDialog.tsx`. Its three action handlers are the authorization boundary:

~~~tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EnrichmentRow,
  EnrichmentSnapshot,
  GeocodeResponse,
} from "@/contracts/enrichment";
import type { SpatialFeature } from "@/contracts/renderer";
import {
  applyUploadToDraft,
  confirmGeocodeIdentity,
  correctCoordinate,
  createLocalEnrichmentSnapshot,
  mergeProviderResponses,
  type UploadPlanningDraft,
} from "@/enrichment/enrichmentSnapshot";
import { requestPreflight, runEnrichment } from "@/enrichment/enrichmentClient";
import { mapHeaders } from "@/import/mapHeaders";
import { readLocalSpreadsheet, type LocalSheet } from "@/import/readLocalSpreadsheet";
import {
  selectRowsForEnrichment,
  validateMappedRows,
  type MappedInventoryRow,
  type ValidatedInventoryRow,
} from "@/import/validateRows";
import { UploadPreview } from "@/features/UploadPreview";
import { MapCanvas } from "@/maps/MapCanvas";
import {
  projectGoogleScene,
  projectMapLibreScene,
} from "@/maps/projectScene";

function valueFor(target: string, value: unknown): unknown {
  if (["latitude", "longitude", "coordinateAccuracyM", "rate"].includes(target)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return typeof value === "string" ? value.trim() : String(value ?? "");
}

function mapSheet(sheet: LocalSheet): MappedInventoryRow[] {
  const headers = (sheet.rows[0] ?? []).map((value) => String(value ?? ""));
  const mappings = mapHeaders(headers);
  return sheet.rows.slice(1).map((values) => {
    const row: MappedInventoryRow = { extras: {} };
    mappings.forEach((mapping, index) => {
      const value = valueFor(mapping.target ?? "", values[index]);
      if (mapping.target && mapping.confirmed) {
        (row as unknown as Record<string, unknown>)[mapping.target] = value;
      } else {
        row.extras![mapping.source] = values[index];
      }
    });
    return row;
  });
}

function toEnrichmentRows(rows: ValidatedInventoryRow[]): EnrichmentRow[] {
  return rows.map((row) => ({
    rowId: row.assetId,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    coordinateAccuracyM: row.coordinateAccuracyM,
    spatialLicenseId: row.spatialLicenseId,
    sourceArtifactId: row.sourceArtifactId,
    spatialRights: row.spatialRights,
  }));
}

export function UploadDialog({
  onClose,
  onDraft,
}: {
  onClose(): void;
  onDraft(draft: UploadPlanningDraft, snapshot: EnrichmentSnapshot): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [accepted, setAccepted] = useState<ValidatedInventoryRow[]>([]);
  const [sheets, setSheets] = useState<LocalSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [selected, setSelected] = useState(new Set<string>());
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Record<string, unknown> | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EnrichmentSnapshot | null>(null);
  const [corrections, setCorrections] = useState<Record<
    string,
    { latitude: string; longitude: string }
  >>({});
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);
  const uploadScenes = useMemo(() => {
    const selectedRows = snapshot?.rows.filter(
      (item) => selected.has(item.row.rowId),
    ) ?? [];
    const localFeatures: SpatialFeature[] = selectedRows.flatMap((item) => {
      const coordinateField = item.customerCorrection ?? item.uploadedCoordinate;
      if (!coordinateField) return [];
      return [{
        id: item.row.rowId,
        coordinateField,
        visual: {
          label: item.row.address ?? item.row.rowId,
          metricLabel: "Uploaded location context",
          value: null,
          unit: "none" as const,
          evidenceLabel: item.customerCorrection
            ? "Customer-corrected coordinate"
            : "Uploaded coordinate · " +
              (item.row.coordinateAccuracyM
                ? "±" + item.row.coordinateAccuracyM + " m"
                : "accuracy undeclared"),
        },
      }];
    });
    const providerFeatures: SpatialFeature[] = selectedRows.flatMap((item) => {
      const candidate = item.candidates.find(
        (value) => value.candidateToken === item.selectedCandidateToken,
      ) ?? item.candidates[0];
      if (!candidate) return [];
      return [{
        id: "provider/" + item.row.rowId,
        coordinateField: candidate.coordinate,
        visual: {
          label: item.row.address ?? item.row.rowId,
          metricLabel: "Geocode review",
          value: null,
          unit: "none" as const,
          evidenceLabel: candidate.granularity.value,
        },
      }];
    });
    return {
      local: projectMapLibreScene(localFeatures),
      provider: projectGoogleScene(providerFeatures),
    };
  }, [snapshot, selected]);

  function inspectSheet(sheet: LocalSheet) {
    const validated = validateMappedRows(mapSheet(sheet));
    setAccepted(validated.accepted);
    setQuarantineCount(validated.quarantined.length);
    setSelected(new Set(validated.accepted.slice(0, 50).map((row) => row.assetId)));
    setPreflight(null);
    setEnrichmentError(null);
    setSnapshot(createLocalEnrichmentSnapshot(
      toEnrichmentRows(validated.accepted.slice(0, 50)),
      new Date().toISOString(),
    ));
  }

  async function selectFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const workbook = await readLocalSpreadsheet(file);
      setSheets(workbook.sheets);
      setSheetIndex(0);
      inspectSheet(workbook.sheets[0]);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "SPREADSHEET_PARSE_FAILED");
      setAccepted([]);
      setSelected(new Set());
    } finally {
      setParsing(false);
    }
  }

  function selectedEnrichmentRows(): EnrichmentRow[] {
    return toEnrichmentRows(selectRowsForEnrichment(accepted, [...selected]));
  }

  async function reviewEnrichment() {
    try {
      setEnrichmentError(null);
      const rows = selectedEnrichmentRows();
      if (rows.length === 0) throw new Error("SELECT_AT_LEAST_ONE_ROW");
      setPreflight(await requestPreflight({ rows }));
    } catch (error) {
      setEnrichmentError(error instanceof Error ? error.message : "PREFLIGHT_FAILED");
    }
  }

  async function enrichLocations() {
    try {
      setEnrichmentError(null);
      if (!preflight || typeof preflight.id !== "string") throw new Error("PREFLIGHT_REQUIRED");
      const rows = selectedEnrichmentRows();
      const responses = await runEnrichment({
        preflightId: preflight.id,
        rows,
        authorized: true,
        idempotencyKey: crypto.randomUUID(),
      }) as GeocodeResponse[];
      const local = createLocalEnrichmentSnapshot(rows, new Date().toISOString());
      setSnapshot(mergeProviderResponses(local, responses, new Date().toISOString()));
    } catch (error) {
      setEnrichmentError(error instanceof Error ? error.message : "ENRICHMENT_FAILED");
    }
  }

  function useUploadedFacts() {
    const local = createLocalEnrichmentSnapshot(
      selectedEnrichmentRows(),
      new Date().toISOString(),
    );
    onDraft(applyUploadToDraft(local, [...selected]), local);
  }

  function updateCorrection(
    rowId: string,
    field: "latitude" | "longitude",
    value: string,
  ) {
    setCorrections((current) => ({
      ...current,
      [rowId]: {
        latitude: current[rowId]?.latitude ?? "",
        longitude: current[rowId]?.longitude ?? "",
        [field]: value,
      },
    }));
  }

  function applyCorrection(rowId: string) {
    const value = corrections[rowId];
    if (!value?.latitude.trim() || !value.longitude.trim()) {
      throw new Error("CORRECTION_COORDINATE_REQUIRED");
    }
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      throw new Error("CORRECTION_COORDINATE_INVALID");
    }
    setSnapshot((current) => current
      ? correctCoordinate(
          current,
          rowId,
          { latitude, longitude },
          "customer-upload-" + rowId,
        )
      : current,
    );
  }

  return (
    <aside role="dialog" aria-modal="true" aria-label="Upload inventory">
      <button ref={closeRef} type="button" onClick={onClose}>Close</button>
      <input aria-label="Inventory spreadsheet" type="file" accept=".csv,.tsv,.xlsx" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void selectFile(file);
      }} />
      {sheets.length > 1 && <label>Worksheet<select value={sheetIndex} onChange={(event) => {
        const index = Number(event.target.value);
        setSheetIndex(index);
        inspectSheet(sheets[index]);
      }}>{sheets.map((sheet, index) => (
        <option key={sheet.name} value={index}>{sheet.name}</option>
      ))}</select></label>}
      <p>{parsing
        ? "Reading spreadsheet locally…"
        : accepted.length + " accepted · " + quarantineCount + " quarantined"}</p>
      {parseError && <p role="alert">{parseError}</p>}
      {enrichmentError && <p role="alert">{enrichmentError}. Uploaded facts remain usable offline.</p>}
      <UploadPreview
        rows={accepted}
        selected={selected}
        onToggle={(assetId) => setSelected((current) => {
          const next = new Set(current);
          next.has(assetId) ? next.delete(assetId) : next.add(assetId);
          if (next.size > 50) return current;
          return next;
        })}
      />
      <button
        type="button"
        disabled={parsing || selected.size === 0}
        onClick={useUploadedFacts}
      >
        Use uploaded facts as context
      </button>
      <button
        type="button"
        disabled={parsing || selected.size === 0}
        onClick={() => void reviewEnrichment()}
      >
        Review enrichment
      </button>
      {preflight && <section aria-label="Enrichment preflight">
        <pre>{JSON.stringify(preflight, null, 2)}</pre>
        <button type="button" onClick={() => void enrichLocations()}>
          Enrich locations
        </button>
      </section>}
      {snapshot && <section aria-label="Geocode review">
        <h2>Review locations</h2>
        <p>Customer/open coordinates work offline. Provider candidates remain optional, context-only, and separately reviewable.</p>
        {uploadScenes.local.features.length > 0 && <div className="upload-map">
          <h3>Uploaded coordinates · offline MapLibre preview</h3>
          <MapCanvas scene={uploadScenes.local} />
        </div>}
        {uploadScenes.provider.features.length > 0 && <div className="upload-map">
          <h3>Provider candidates · Google review</h3>
          <MapCanvas
            scene={uploadScenes.provider}
            onFeatureSelect={(featureId) => setSnapshot((current) => {
              const rowId = featureId.replace(/^provider\//, "");
              const item = current?.rows.find((value) => value.row.rowId === rowId);
              const candidate = item?.candidates[0];
              return current && candidate
                ? confirmGeocodeIdentity(current, rowId, candidate.candidateToken)
                : current;
            })}
          />
        </div>}
        {snapshot.rows.filter((item) => selected.has(item.row.rowId)).map((item) => (
          <article key={item.row.rowId}>
            <h3>{item.row.address ?? item.row.rowId}</h3>
            {item.candidates.length === 0 && <p>No provider candidate returned.</p>}
            {item.candidates.map((candidate) => (
              <button
                key={candidate.candidateToken}
                type="button"
                aria-pressed={item.selectedCandidateToken === candidate.candidateToken}
                onClick={() => setSnapshot((current) => current
                  ? confirmGeocodeIdentity(current, item.row.rowId, candidate.candidateToken)
                  : current,
                )}
              >
                Confirm {candidate.formattedAddress.value} · {candidate.granularity.value}
              </button>
            ))}
            <label>
              Correct latitude
              <input
                inputMode="decimal"
                value={corrections[item.row.rowId]?.latitude ?? ""}
                onChange={(event) => updateCorrection(
                  item.row.rowId,
                  "latitude",
                  event.target.value,
                )}
              />
            </label>
            <label>
              Correct longitude
              <input
                inputMode="decimal"
                value={corrections[item.row.rowId]?.longitude ?? ""}
                onChange={(event) => updateCorrection(
                  item.row.rowId,
                  "longitude",
                  event.target.value,
                )}
              />
            </label>
            <button type="button" onClick={() => applyCorrection(item.row.rowId)}>
              Use customer coordinate
            </button>
          </article>
        ))}
        <button type="button" onClick={() => onDraft(
          applyUploadToDraft(snapshot, [...selected]),
          snapshot,
        )}>
          Use reviewed facts as context
        </button>
      </section>}
    </aside>
  );
}
~~~

File selection, sheet parsing, header mapping, validation, quarantine review, and row toggling call no network code. Only **Review enrichment** calls `requestPreflight`. The confirmation view must show:

- provider and product;
- rows and exact fields transmitted;
- maximum calls;
- configured cost revision or `Cost unavailable — rate card not configured`;
- retention and attribution;
- context-only versus model-eligible status; and
- disabled Places Aggregate and Routes reasons.

Only the subsequent **Enrich locations** button calls `runEnrichment` with `authorized: true`. **Use uploaded facts as context** is available first and makes no network call. Provider success merges into a new immutable snapshot revision; failure preserves the local snapshot and a recovery message. Customer/open rows render immediately in the offline MapLibre preview; provider candidates use a separate Google/no-map review scene; `UploadPreview` remains the complete numerical fallback. Identity confirmation never mutates a provider candidate. Accepting either local or reviewed facts creates an ordinary context-only plan draft. It can become applied RFQ context only through Apply, and it cannot silently qualify or alter calibrated Planning Fit inputs.

- [ ] **Step 2: Write the four-minute FMCG golden path**

Create `tests/e2e/seeded-fmcg.spec.ts`:

~~~ts
import { expect, test } from "@playwright/test";

test("four-minute FMCG path reaches a verification RFQ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page.getByTestId("zone-card")).toHaveCount(3);
  await expect(page.getByText(/Scenario target reach/)).toBeVisible();
  await expect(page.getByText(/Evidence D/).first()).toBeVisible();

  const firstZone = page.getByTestId("zone-card").first();
  await firstZone.getByRole("button").first().click();
  const explanation = page.getByRole("dialog", { name: "How delivery was estimated" });
  await explanation.getByRole("button", { name: /^Site / }).first().click();
  await expect(explanation).toBeVisible();
  for (const stage of ["Location", "Places", "Movement", "OTS", "Target", "Unique"]) {
    await expect(page.getByRole("button", { name: stage })).toBeVisible();
  }
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Campaign time").selectOption("evening");
  await expect(page.getByText("Unapplied changes")).toBeVisible();
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  await expect(page.getByText("DEMO — DO NOT SEND")).toBeVisible();
  await page.getByLabel("Buyer name").fill("Demo Buyer");
  await page.getByLabel("Buyer email").fill("buyer@example.test");
  await page.getByLabel("Response deadline").fill("2026-08-20");
  await page.getByLabel("Dates confirmed").check();
  await page.getByRole("button", { name: "Generate RFQ" }).click();
  await expect(page.getByText("Generated", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Download consolidated internal request",
  })).toBeVisible();
});
~~~

- [ ] **Step 3: Add the network-disabled seeded test**

Create `tests/e2e/network-disabled.spec.ts`:

~~~ts
import { expect, test } from "@playwright/test";

test("seeded flow makes no external request", async ({ page }) => {
  const external: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      external.push(url.toString());
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page.getByTestId("package-strip")).toBeVisible();
  expect(external).toEqual([]);
});
~~~

- [ ] **Step 4: Add sector, upload, renderer, and degradation goldens**

Create `tests/e2e/sector-presets.spec.ts`:

~~~ts
import { expect, test } from "@playwright/test";

for (const preset of [
  { value: "fmcg", label: "FMCG" },
  { value: "real_estate", label: "Real Estate" },
  { value: "bank_fintech", label: "Bank / Fintech" },
]) {
  test(preset.label + " builds from the same evidence-labelled engine", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Sector").selectOption(preset.value);
    await page.getByRole("button", { name: "Build campaign" }).click();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await expect(page.getByText(/Scenario target reach/)).toBeVisible();
    await expect(page.getByText(/Evidence D/).first()).toBeVisible();
  });
}

test("objective, time, budget, include, remove, swap, undo and apply stay coherent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await page.getByLabel("Objective").selectOption("influential_core");
  await expect(page.getByText(/Marginal influence/).first()).toBeVisible();
  await page.getByLabel("Campaign time").selectOption("evening");
  await page.getByLabel(/Budget \(NGN\)/).fill("20000000");
  await page.getByRole("button", { name: "Include compatible face" }).click();
  await page.getByRole("button", { name: "Swap first face in its zone" }).click();
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await expect(page.getByText("Unapplied changes")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  await expect(page.getByRole("dialog", { name: "Supplier verification RFQ" })).toBeVisible();
});
~~~

Create `tests/e2e/upload-enrichment.spec.ts` using a synthetic API fixture. File selection must precede the first recorded API request:

~~~ts
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
~~~

Create `tests/fixtures/customer-owned-inventory.csv`:

~~~csv
asset_id,address,latitude,longitude,coordinate accuracy m,supplier,format,rate,coordinate source,coordinate attestation id,source artifact id
UP-001,Herbert Macaulay Way Yaba Lagos,6.5158,3.3717,25,Upload Media,static,3200000,customer_captured,customer-coordinate-attestation-1,upload-fixture-1
~~~

Replace the temporary upload shell in `PlannerPage` with the ordinary plan-draft transition:

~~~tsx
{uploadOpen && (
  <UploadDialog
    onClose={() => setUploadOpen(false)}
    onDraft={(contextRevision) => {
      const basis = visible ?? buildPlan(bundle, brief);
      if (!visible) dispatch({ type: "loaded", plan: basis });
      dispatch({
        type: "drafted",
        plan: applyUploadContextToPlan(bundle, basis, contextRevision),
        reason: "Apply uploaded context · " + contextRevision.dataRevision,
      });
      setUploadOpen(false);
    }}
  />
)}
{visible?.contextRevision && (
  <aside aria-label="Uploaded planning status">
    <strong>Context shortlist</strong>
    <span>Evidence unavailable · context only</span>
    <span>{visible.contextRevision.claimResolution.reasonCode}</span>
    <p>{visible.contextRevision.claimResolution.recoveryAction}</p>
    <p>Revision {visible.contextRevision.dataRevision}</p>
    <p>{dirty ? "Unapplied context change" : "Applied plan context"}</p>
  </aside>
)}
~~~

Import `UploadDialog` and `applyUploadContextToPlan`; do not add disconnected upload-specific React state. The new revision is a normal `draftPlan`, so Undo and Reset work unchanged, `Apply & review RFQ` atomically promotes it, and the RFQ then uses that exact applied fingerprint/data revision. The upload remains context-only and does not alter calibrated delivery inputs unless a future governed bundle explicitly declares compatibility.

Create `tests/component/DegradedClaimViews.test.tsx`:

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MetricClaimSchema,
  type MetricClaim,
} from "@/contracts/metrics";
import { selectPermittedDeliveryView } from "@/application/permittedDeliveryView";

function metric(input: Record<string, unknown>): MetricClaim {
  return MetricClaimSchema.parse({
    id: String(input.kind),
    label: String(input.label),
    sourceIds: ["fixture-source"],
    caveats: ["Fixture caveat"],
    applicability: "inside",
    ...input,
  });
}

type ViewCase = {
  name: string;
  claim: MetricClaim;
  recoveryAction: string | null;
  expectedValue: string;
  expectedUnit: string;
  expectedEvidence: string;
  expectedState: string;
};

const cases: ViewCase[] = [
  {
    name: "Activity Potential",
    claim: metric({
      kind: "activity_potential", label: "Activity Potential", state: "modelled",
      evidence: "D", unit: "index_0_100", value: 72,
    }),
    recoveryAction: null,
    expectedValue: "72",
    expectedUnit: "index_0_100",
    expectedEvidence: "Evidence D",
    expectedState: "modelled",
  },
  {
    name: "movement",
    claim: metric({
      kind: "movement", label: "Person passages", state: "observed",
      evidence: "C", unit: "person_passages", value: 180_000,
    }),
    recoveryAction: "Verify face orientation and delivery schedule",
    expectedValue: "180K",
    expectedUnit: "person_passages",
    expectedEvidence: "Evidence C",
    expectedState: "observed",
  },
  {
    name: "general OTS",
    claim: metric({
      kind: "general_ots", label: "General OTS", state: "modelled",
      evidence: "C", unit: "ots", value: 95_000,
    }),
    recoveryAction: "Attach a compatible target allocation source",
    expectedValue: "95K",
    expectedUnit: "ots",
    expectedEvidence: "Evidence C",
    expectedState: "modelled",
  },
  {
    name: "target OTS",
    claim: metric({
      kind: "target_ots", label: "Target OTS", state: "assumed",
      evidence: "D", unit: "ots", value: 56_000,
    }),
    recoveryAction: "Attach an eligible overlap model",
    expectedValue: "56K",
    expectedUnit: "ots",
    expectedEvidence: "Evidence D",
    expectedState: "assumed",
  },
  {
    name: "scenario reach",
    claim: metric({
      kind: "scenario_target_reach", label: "Scenario target reach", state: "assumed",
      evidence: "D", unit: "people", universe: 800_000,
      range: { type: "scenario", low: 220_000, base: 250_000, high: 285_000 },
    }),
    recoveryAction: null,
    expectedValue: "220K / 250K / 285K",
    expectedUnit: "people · Low / Base / High scenario",
    expectedEvidence: "Evidence D",
    expectedState: "assumed",
  },
  {
    name: "calibrated reach",
    claim: metric({
      kind: "calibrated_target_reach", label: "Calibrated target reach", state: "modelled",
      evidence: "C", unit: "people", universe: 800_000,
      range: { type: "quantile", p10: 210_000, p50: 248_000, p90: 291_000 },
    }),
    recoveryAction: null,
    expectedValue: "210K / 248K / 291K",
    expectedUnit: "people · P10 / P50 / P90",
    expectedEvidence: "Evidence C",
    expectedState: "modelled",
  },
  {
    name: "scenario Influence",
    claim: metric({
      kind: "influence_capture", label: "Influence Capture", state: "assumed",
      evidence: "D", unit: "percent", qiSourceId: "fixture-qi",
      range: { type: "scenario", low: 40, base: 45, high: 51 },
    }),
    recoveryAction: null,
    expectedValue: "40% / 45% / 51%",
    expectedUnit: "percent · Low / Base / High scenario",
    expectedEvidence: "Evidence D",
    expectedState: "assumed",
  },
  {
    name: "no-qi Influence",
    claim: metric({
      kind: "unavailable", label: "Influence Capture", state: "unavailable",
      evidence: "unavailable", unit: "none", reasonCode: "QI_UNAVAILABLE",
      caveats: ["A named category-specific influence source is required"],
      applicability: "outside",
    }),
    recoveryAction: "Attach a named category-specific influence propensity source",
    expectedValue: "Unavailable",
    expectedUnit: "none",
    expectedEvidence: "Evidence unavailable",
    expectedState: "unavailable",
  },
  {
    name: "context only",
    claim: metric({
      kind: "unavailable", label: "Context shortlist", state: "unavailable",
      evidence: "unavailable", unit: "none", reasonCode: "LOW_PRECISION_GEOCODE",
      caveats: ["Context only: coordinate needs review"], applicability: "outside",
    }),
    recoveryAction: "Supply an independently sourced precise coordinate",
    expectedValue: "Unavailable",
    expectedUnit: "none",
    expectedEvidence: "Evidence unavailable",
    expectedState: "unavailable",
  },
];

function ClaimView({ value }: { value: ViewCase }) {
  const view = selectPermittedDeliveryView(value.claim, value.recoveryAction);
  return (
    <section aria-label={view.label}>
      <h2>{view.label}</h2>
      <output data-testid="value">{view.valueText}</output>
      <span data-testid="unit">{view.unitLabel}</span>
      <span data-testid="evidence">{view.evidenceLabel}</span>
      <span data-testid="state">{view.stateLabel}</span>
      <ul>{view.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
      <p data-testid="recovery">{view.recoveryAction ?? "No recovery needed"}</p>
    </section>
  );
}

describe("claim-aware visual copy", () => {
  it.each(cases)("renders only the permitted $name claim", (viewCase) => {
    render(<ClaimView value={viewCase} />);
    expect(screen.getByRole("heading", { name: viewCase.claim.label })).toBeVisible();
    expect(screen.getByTestId("value")).toHaveTextContent(viewCase.expectedValue);
    expect(screen.getByTestId("unit")).toHaveTextContent(viewCase.expectedUnit);
    expect(screen.getByTestId("evidence")).toHaveTextContent(viewCase.expectedEvidence);
    expect(screen.getByTestId("state")).toHaveTextContent(viewCase.expectedState);
    for (const caveat of viewCase.claim.caveats) {
      expect(screen.getByText(caveat)).toBeVisible();
    }
    expect(screen.getByTestId("recovery")).toHaveTextContent(
      viewCase.recoveryAction ?? "No recovery needed",
    );
  });
});
~~~

This is the executable visual-copy proof for every claim ceiling, including unavailable Influence and low-precision context. Task 9's renderer-switch component test remains the executable Google → MapLibre separation proof. Do not duplicate the pure degradation matrix as brittle browser journeys.

- [ ] **Step 5: Freeze golden output bytes**

Create `scripts/build-golden-outputs.ts`:

~~~ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenLagosBundle } from "../src/bundle/loadFrozenBundle";
import type { Brief } from "../src/contracts/domain";
import type { RfqReviewInput } from "../src/contracts/rfq";
import { optimizePackage } from "../src/planning/packageOptimizer";
import { generateRfq } from "../src/planning/rfq";
import { canonicalJson } from "../src/shared/canonicalJson";

const common = {
  daypart: "pm",
  budgetNgn: 18_000_000,
  normalizationBudgetNgn: 30_000_000,
  flightStart: "2026-09-01",
  flightEnd: "2026-09-28",
} as const;

const briefs: Brief[] = [
  {
    ...common,
    productName: "Demo Spark",
    productDescription: "Affordable on-the-go refreshment launch",
    targetAudience: "Students, young workers, and convenience shoppers",
    sector: "fmcg",
    objective: "broad_reach",
  },
  {
    ...common,
    productName: "Demo Residences",
    productDescription: "Mid-market residential development launch",
    targetAudience: "Professionals, investors, and diaspora buyers",
    sector: "real_estate",
    objective: "influential_core",
  },
  {
    ...common,
    productName: "DemoPay",
    productDescription: "Merchant and consumer payments launch",
    targetAudience: "Merchants, students, and urban professionals",
    sector: "bank_fintech",
    objective: "near_conversion",
  },
];

export function buildGoldenOutputs() {
  return Object.fromEntries(briefs.map((brief) => {
    const plan = optimizePackage(frozenLagosBundle, brief);
    const review: RfqReviewInput = {
      buyerContact: { name: "Demo Buyer", email: "buyer@example.test" },
      responseDeadline: "2026-08-20",
      flightStart: brief.flightStart,
      flightEnd: brief.flightEnd,
      datesConfirmed: true,
      supplierNotes: {},
    };
    return [brief.sector, {
      plan,
      rfq: generateRfq(frozenLagosBundle, plan, review),
    }];
  }));
}

const outputPath = resolve("src/demo/lagos-v1/golden-outputs.json");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, canonicalJson(buildGoldenOutputs()) + "\n", "utf8");
  const verified = readFileSync(outputPath, "utf8");
  if (verified !== canonicalJson(buildGoldenOutputs()) + "\n") {
    throw new Error("GOLDEN_WRITE_NOT_REPRODUCIBLE");
  }
}
~~~

Create `tests/unit/demo/goldenOutputs.test.ts`:

~~~ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildGoldenOutputs } from "../../../scripts/build-golden-outputs";
import { canonicalJson } from "@/shared/canonicalJson";

describe("golden outputs", () => {
  it("rebuilds all three plan and RFQ bytes exactly", async () => {
    const checkedIn = await readFile("src/demo/lagos-v1/golden-outputs.json", "utf8");
    expect(canonicalJson(buildGoldenOutputs()) + "\n").toBe(checkedIn);
  });
});
~~~

Add `"golden:build": "tsx scripts/build-golden-outputs.ts"` to `package.json`.

Run `pnpm golden:build` twice. Expected: the second run produces no Git diff and every output contains bundle, model, feature snapshot, source-manifest, enrichment-snapshot, data-revision, fingerprint, overlap-method, replicate-set, seed, and control fields through its replay envelope.

- [ ] **Step 6: Add accessibility and visual checks**

Create `tests/e2e/visual-accessibility.spec.ts`:

~~~ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function assertAccessible(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("locks the sparse result, four lenses, six causal stages, dirty draft and RFQ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page).toHaveScreenshot("sparse-first-result.png", { animations: "disabled" });
  await assertAccessible(page);

  for (const lens of ["Plan", "Activity", "Reach", "Influence"]) {
    await page.getByRole("tab", { name: lens }).click();
    await expect(page.getByTestId("zone-card")).toHaveCount(3);
    await expect(page).toHaveScreenshot("lens-" + lens.toLowerCase() + ".png", {
      animations: "disabled",
    });
  }

  const firstZone = page.getByTestId("zone-card").first();
  await firstZone.getByRole("button").first().click();
  const explanation = page.getByRole("dialog", { name: "How delivery was estimated" });
  await explanation.getByRole("button", { name: /^Site / }).first().click();
  for (const stage of ["Location", "Places", "Movement", "OTS", "Target", "Unique"]) {
    await page.getByRole("button", { name: stage }).click();
    await expect(page.getByText("Transformation")).toBeVisible();
    await expect(page).toHaveScreenshot("causal-" + stage.toLowerCase() + ".png", {
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByLabel("Campaign time").selectOption("evening");
  await expect(page).toHaveScreenshot("dirty-draft.png", { animations: "disabled" });
  await page.getByRole("button", { name: "Apply & review RFQ" }).click();
  await expect(page).toHaveScreenshot("rfq-review.png", { animations: "disabled" });
  await assertAccessible(page);
});

test("keeps the core visual legible at 390 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Build campaign" }).click();
  await expect(page).toHaveScreenshot("mobile-390.png", {
    animations: "disabled",
    fullPage: true,
  });
  await assertAccessible(page);
});
~~~

Create the first reviewed baselines before treating the visual suite as a release gate:

~~~bash
pnpm test:e2e -- --update-snapshots
git status --short tests/e2e
pnpm test:e2e
~~~

Expected: the first command writes Chromium baselines under the Playwright-managed `*-snapshots` directories. Review every PNG for clipped labels, accidental provider content, missing evidence text, and unstable timestamps; then the ordinary run must pass byte-for-byte. Commit the reviewed baselines with Task 12. Future changes use `--update-snapshots` only when the visual change is intentional and reviewed.

The upload E2E fixture above is the low-precision context screenshot. `DegradedClaimViews.test.tsx` is the exact unavailable-Influence visual-copy proof. Every map encoding has the three-card numerical list alternative, which the lens loop asserts remains present. Evidence state is rendered as text and never relies on colour alone.

- [ ] **Step 7: Add secret and history verification**

Create `scripts/verify-client-secrets.ts`:

~~~ts
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const forbidden = [
  /GOOGLE_GEOCODING_API_KEY/i,
  /X-Goog-Api-Key/i,
  /AIza[0-9A-Za-z_-]{20,}/,
];

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : Promise.resolve([path]);
  }));
  return nested.flat();
}

const staticRoot = resolve(".next/static");
const violations: string[] = [];
for (const file of await filesUnder(staticRoot)) {
  const contents = await readFile(file, "utf8");
  if (forbidden.some((pattern) => pattern.test(contents))) violations.push(file);
}
if (violations.length > 0) {
  throw new Error("CLIENT_SECRET_PATTERN:" + violations.join(","));
}
console.log("No server-key patterns found in .next/static");
~~~

The release command also runs:

~~~powershell
git log -p --all -- . ':(exclude)docs/**' ':(exclude).env.example' |
  Select-String -Pattern 'AIza[0-9A-Za-z_-]{20,}|GOOGLE_GEOCODING_API_KEY=[^\s]{8,}'
~~~

Expected: no match. The deliberately browser-visible restricted map key is injected only at runtime and is never committed.

- [ ] **Step 8: Run the three-viewer comprehension gate**

Show only the initial loaded result for 30 seconds to three people unfamiliar with the project. Each must correctly identify:

1. the recommended three-zone package;
2. the currently permitted delivery claim and Evidence D state; and
3. the primary reason for the recommendation.

Record anonymous pass/fail results and misunderstood labels in `docs/demo-comprehension-check.md`. All three must pass; otherwise revise labels or hierarchy and rerun the same gate.

- [ ] **Step 9: Document the exact demo**

`README.md` must contain:

- install and run commands;
- seeded-mode and optional live-geocoding configuration;
- the four-minute path;
- the separate upload vignette;
- Evidence-D and booking-status disclaimers;
- why Low/Base/High is not P10/P50/P90;
- provider feature flags and required approvals;
- network-disabled verification; and
- the commands below.

- [ ] **Step 10: Run release verification**

Run:

~~~bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm tsx scripts/verify-client-secrets.ts
pnpm test:e2e
git diff --check
git status --short
~~~

Expected:

- lint and typecheck exit 0;
- all unit, property, component, accessibility, visual, and E2E tests pass;
- the production build succeeds;
- the secret scans find nothing;
- the seeded path makes no external request;
- golden output bytes match;
- no unexpected working-tree changes remain; and
- the first result appears within three seconds on the agreed demo laptop.

- [ ] **Step 11: Commit**

~~~bash
git add README.md package.json docs/demo-comprehension-check.md scripts src/features tests src/demo/lagos-v1/golden-outputs.json
git commit -m "test: lock calibrated promotion wizard demo"
~~~

## Acceptance coverage ledger

| Approved requirement | Implemented by | Release proof |
|---|---|---|
| Recommendation, permitted claim, evidence, and reason understood within 30 seconds | Tasks 10, 12 | Three-viewer gate |
| No more than three zone cards and one strip | Task 10 | Component and screenshot tests |
| Six causal steps | Tasks 4, 10 | Component and E2E navigation |
| Objective, time, budget, include, remove, and swap remain coherent | Tasks 5, 6, 10 | Reducer and E2E tests |
| Dirty draft and applied RFQ basis | Tasks 6, 11 | Reducer and RFQ tests |
| Editable, watermarked, unsent, unbooked RFQ | Task 11 | Unit, component, and E2E tests |
| Typed units and claim ladder | Tasks 2, 4 | Contract and degradation tests |
| Stable-panel unique reach and qi-gated Influence | Tasks 3, 4 | Golden and invariant tests |
| Coherent scenario ranges and Evidence D | Tasks 2–4 | Bundle and claim tests |
| Feature-use isolation and objective weights | Tasks 2, 5 | Registry and score tests |
| Local upload and 50-row cap | Task 7 | Parser and validation tests |
| Explicit preflight before live calls | Tasks 7, 8, 12 | Gateway and E2E request assertions |
| Low-precision geocode and correction provenance | Tasks 7, 8, 12 | Contract and E2E tests |
| Provider-safe renderer separation | Task 9 | Projector and renderer-switch tests |
| No client secrets and seeded offline mode | Tasks 1, 8, 12 | Bundle, history, and network scans |
| Exact reproducibility | Tasks 1, 3–6, 12 | Golden byte comparison |

## External implementation references

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security)
- [Google Geocoding API v4 overview](https://developers.google.com/maps/documentation/geocoding/geocoding-v4-overview)
- [Google Geocoding v4 address method](https://developers.google.com/maps/documentation/geocoding/geocoding)
- [Google Geocoding v3-to-v4 migration](https://developers.google.com/maps/documentation/geocoding/geocoding-v4-migrate)
- [Google Places Aggregate computeInsights](https://developers.google.com/maps/documentation/places-aggregate/reference/rest/v1/TopLevel/computeInsights)
- [Google Places Aggregate policies](https://developers.google.com/maps/documentation/places-aggregate/policies)
- [Google Maps API security best practices](https://developers.google.com/maps/api-security-best-practices)
- [React Google Maps documentation](https://visgl.github.io/react-google-maps/docs/get-started)
- [MapLibre style specification](https://maplibre.org/maplibre-style-spec/)

The implementation must recheck provider availability, pricing, quotas, taxonomy, and terms before changing any disabled provider capability to enabled.
