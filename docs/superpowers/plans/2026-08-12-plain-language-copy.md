# Plain-Language Product Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace technical and demo-framed customer copy with concise plain English while keeping calculation and audit internals stable.

**Architecture:** Add a small `src/content/plainLanguage.ts` presentation dictionary and formatter functions. Components and selectors consume that layer; internal schemas, IDs, and mathematical behavior remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Playwright.

---

### Task 1: Establish the public-copy contract

**Files:**
- Create: `src/content/plainLanguage.ts`
- Create: `tests/unit/content/plainLanguage.test.ts`

- [ ] **Step 1: Write the failing test**

Create a test that imports `PUBLIC_COPY`, joins its leaf strings, and rejects `synthetic`, `demo`, `exposure geometry`, `marginal`, `headroom`, `cohort`, `serviceability`, `normalization`, `causal`, and bare `Evidence [A-D]`. Assert the approved replacements for real inventory, estimates, plan score, budget remaining, and draft RFQ status.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/content/plainLanguage.test.ts`

Expected: FAIL because `@/content/plainLanguage` does not exist.

- [ ] **Step 3: Add the presentation dictionary**

Export typed groups for campaign defaults, confidence labels, recommendation metrics, map copy, explanation copy, upload copy, and RFQ copy. Add `confidenceLabel(grade)` and objective-specific metric helpers. Do not import calculation modules into this file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/content/plainLanguage.test.ts`

Expected: PASS.

### Task 2: Simplify the five-step planner and package comparison

**Files:**
- Modify: `src/features/PlannerPage.tsx`
- Modify: `src/features/PackageOptionComparison.tsx`
- Modify: `src/features/PackageStrip.tsx`
- Modify: `src/features/RecommendationCards.tsx`
- Modify: `src/features/LensTabs.tsx`
- Modify: `src/application/plannerSelectors.ts`
- Test: `tests/component/PlannerPage.test.tsx`
- Test: `tests/component/PackageOptionComparison.test.tsx`
- Test: `tests/component/PackageStrip.test.tsx`
- Test: `tests/component/RecommendationCards.test.tsx`

- [ ] **Step 1: Update assertions first**

Assert that the default product is “Spark Refresh”; recommendation screens use “Additional people reached,” “Area activity,” “Plan score,” “Budget remaining,” and plain area roles; and the old jargon is absent from rendered output.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `pnpm exec vitest run tests/component/PlannerPage.test.tsx tests/component/PackageOptionComparison.test.tsx tests/component/PackageStrip.test.tsx tests/component/RecommendationCards.test.tsx`

Expected: FAIL on old labels.

- [ ] **Step 3: Replace the rendered wording**

Use the presentation dictionary in components and selectors. Keep internal lens IDs, objective IDs, metric kinds, and numeric values unchanged.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run the same command. Expected: PASS.

### Task 3: Simplify map, fine-tuning, upload, and recovery wording

**Files:**
- Modify: `src/features/MapStage.tsx`
- Modify: `src/maps/MapLibreRenderer.tsx`
- Modify: `src/features/AdjustmentsPanel.tsx`
- Modify: `src/features/ActionDock.tsx`
- Modify: `src/features/UploadDialog.tsx`
- Modify: `src/features/UploadedContextPanel.tsx`
- Modify: `src/features/recoveryCopy.ts`
- Test: corresponding component tests under `tests/component/`

- [ ] **Step 1: Add failing plain-language assertions**

Cover “Planning map · not for directions,” understandable map loading/error messages, “media location” instead of “face,” plain change summaries, and uploaded inventory wording that does not imply a demo or a confidence upgrade.

- [ ] **Step 2: Verify RED**

Run the affected component test files and confirm failures point to the old copy.

- [ ] **Step 3: Apply the new wording**

Change labels and supporting text only. Preserve roles, accessible names, event handlers, and state transitions.

- [ ] **Step 4: Verify GREEN**

Run the affected component tests and confirm all pass.

### Task 4: Rewrite the explanation drawer without hiding uncertainty

**Files:**
- Modify: `src/features/CausalDrawer.tsx`
- Modify: `src/application/plannerSelectors.ts`
- Modify: `src/planning/engine.ts`
- Test: `tests/component/CausalDrawer.test.tsx`
- Test: `tests/unit/application/plannerSelectors.test.ts`
- Test: relevant planning-engine unit tests

- [ ] **Step 1: Add failing assertions for the explanation flow**

Expect plain stage names, “How the estimate was built,” “Early estimate,” “Inventory locations and mapped visibility inputs,” and human-readable caveats. Assert “Synthetic demo inventory and exposure geometry” is absent.

- [ ] **Step 2: Verify RED**

Run the focused drawer, selector, and planning tests. Expected: FAIL on old copy.

- [ ] **Step 3: Change public labels and descriptions**

Retain source IDs and formulas in secondary audit fields. Replace only labels, summaries, caveats, and recovery actions that users read.

- [ ] **Step 4: Verify GREEN**

Run the focused test set. Expected: PASS.

### Task 5: Remove demo framing from RFQ and metadata

**Files:**
- Modify: `src/planning/rfq.ts`
- Modify: `src/features/RfqDrawer.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/planning/rfq.test.ts`
- Test: `tests/component/RfqDrawer.test.tsx`

- [ ] **Step 1: Add failing assertions**

Expect “DRAFT — NOT YET SENT,” a plain supplier-request subject/body, and browser metadata that describes a campaign planner rather than a demo.

- [ ] **Step 2: Verify RED**

Run the RFQ and metadata tests. Expected: FAIL on demo wording.

- [ ] **Step 3: Replace the wording**

Keep the RFQ status `draft_unbooked_unsent` and all safety gates unchanged. Only the watermark and readable message change.

- [ ] **Step 4: Verify GREEN**

Run the focused tests. Expected: PASS.

### Task 6: Full verification and visual review

**Files:**
- Modify as needed: tests that intentionally assert superseded customer wording

- [ ] **Step 1: Scan production UI sources**

Run a case-insensitive search over `src/features`, `src/maps`, `src/app`, and customer-facing strings in selectors/planning for banned terms. Review each remaining hit and confirm it is an internal identifier or replace it.

- [ ] **Step 2: Run automated verification**

Run: `pnpm typecheck`, `pnpm lint`, focused Vitest suites, and the core Playwright planner/map tests.

- [ ] **Step 3: Review responsive layouts**

Inspect Step 3, the fine-tuning screen, and explanation/RFQ drawers at 1440×900 and 390×844. Confirm copy wraps cleanly, no control is obscured, and touch targets remain at least 44px.

- [ ] **Step 4: Review the diff**

Run `git diff --check` and confirm no calculation, inventory, coordinate, or pricing changes were introduced.
