# Split-Canvas Explorer UI Design

## Overview

Replace the current sparse map-first planner with a premium, sales-facing, step-by-step explorer interface. The design is **warm editorial**, **one-decision-at-a-time**, and keeps the map as a persistent spatial canvas while decision cards enter from the side (desktop) or bottom (tablet). The flow has up to **5 steps**; earlier steps may be skipped when data is already filled or defaults are accepted. Fine-tune is always the **final** step.

## Target user

Sales executive presenting campaign recommendations to clients, primarily on **laptop and tablet**, sometimes projected. Needs a clean, confident, stage-friendly experience.

## Visual language

- **Shell background**: `#faf8f5` warm ivory.
- **Map canvas**: `#f2efe9` warm grey, recedes behind cards.
- **Card surface**: `#ffffff` with `0 1px 2px rgb(28 32 38 / 5%), 0 4px 16px rgb(28 32 38 / 6%)` and `16px` border radius.
- **Primary accent**: deep teal `#0f5b4e` for primary CTAs and selected states.
- **Secondary accent**: warm gold `#c7982c` for map selection rings, recommendation highlights, and Evidence D lozenges.
- **Text**: warm black `#1c2026` headings, `#5c6272` body, `#8a92a3` captions.
- **Evidence lozenges**:
  - Evidence C: teal `#0f5b4e` on `#e6f4f1`.
  - Evidence D: gold `#c7982c` on `#fdf6e3`.
  - Unavailable: grey `#8a92a3` on `#f0f1f4`.
- **No neon, no heavy borders**: 1px hairline separators only.

## Layout and shell

- **Desktop (1024px+)**: persistent map canvas on the **right (65–70% width, full height)**. A single decision card enters from the **left (30–35% width, max 420px)**. One card visible at a time.
- **Tablet (768–1023px)**: map still fills most of the screen; decision card becomes a **bottom sheet** (max 55% height) that slides up and can be minimized.
- **Mobile (<768px)**: map becomes a compressed header; card is a full-screen sheet. This is not the primary target, but it must remain usable.
- **Z-index**: map at `0`, floating zone highlights at `10`, decision card at `100`, drawers/dialogs at `200`.

## The 5 steps

Steps are adaptive — the user can confirm early and skip later steps.

### Step 1 — Confirm campaign profile

- **Headline**: "Who is this campaign for?"
- **Pre-filled** from existing `initialBrief`:
  - Product name
  - Product description
  - Target audience
  - Sector (FMCG / Real Estate / Bank / Fintech)
  - Objective (Broad reach / Influential core / Near conversion)
- **Choices**:
  - Three large **sector + objective chips** as quick presets (e.g., "FMCG · Broad reach", "Real Estate · Influential core").
  - Editable fields for product/audience in an expandable "Edit details" section.
- **Primary CTA**: "Build package".
- **Skip condition**: if the user already accepted defaults on a previous session or URL contains a preset.

### Step 2 — Choose flight & budget

- **Headline**: "When and how much?"
- **Pre-filled**: daypart = PM, budget = ₦18,000,000, flight = 2026-09-01 → 2026-09-28.
- **Choices**:
  - Daypart chips: All day / AM / Midday / PM / Evening.
  - Budget slider or quick chips: ₦15M / ₦18M / ₦20M / ₦25M.
  - Flight date range with start/end inputs.
- **Primary CTA**: "Show recommended zones".
- **Skip condition**: user accepts the default flight and budget.

### Step 3 — Explore recommended zones

- **Headline**: "Recommended package"
- **Content**:
  - A horizontal **recommendation carousel** of up to 3 large zone cards, each showing:
    - Zone name and role (#1 Primary, #2 Booster, #3 Cover).
    - Objective-specific delivery number (marginal target reach, marginal influence-weighted reach, or marginal serviceable reach).
    - Activity Potential score.
    - Evidence grade.
  - Tapping a card focuses the map on that zone (pan/zoom), shows its sites, and opens a "View delivery story" button for the causal drawer.
- **Primary CTA**: "This package works" (advance to step 4).
- **Secondary action**: tap any zone card in the carousel to focus the map on that zone and reveal a "View delivery story" button for the causal drawer. Tapping again outside the card returns to the full-package view.
- **Skip condition**: none — this is the main recommendation moment.

### Step 4 — Choose outcome

- **Headline**: "What would you like to do with this package?"
- **Three large choice cards**:
  1. **Review RFQ** — open the RFQ drawer to generate a supplier verification draft.
  2. **Upload customer inventory** — open the upload dialog to enrich and use customer-owned sites as context.
  3. **Fine-tune package** — go to step 5 for include/swap/remove adjustments.
- **CTA**: each choice card is a large, clickable action. Tapping one opens the corresponding drawer or advances to step 5. A small "Back to package" link returns to step 3.

### Step 5 — Fine-tune package

- **Headline**: "Make this package yours"
- **Content**:
  - Live package preview with cost, reach/influence, planning fit, and evidence.
  - One-click actions: Include compatible face, Swap first face in its zone, Replace zone, Remove site.
  - "What changed?" comparison panel (existing `AdjustmentsPanel` logic) as an accordion inside the card.
  - Undo / Reset to original links.
- **Primary CTA**: "Apply & review RFQ" (or "Apply package" if not yet ready for RFQ).
- **Note**: This is always the final step. After applying, the user returns to step 4 or opens the RFQ drawer.

## Component architecture

- **`ExplorerShell`** (new): top-level wizard shell. Owns `step` state, `selectedZoneId`, `selectedOutcome`, and renders `MapStage` + `StepCard`.
- **`StepCard`** (new): reusable decision card container. Props:
  - `step: number`
  - `total: number`
  - `title: string`
  - `onBack?: () => void`
  - `onDismiss?: () => void`
  - `primaryAction: { label: string; onClick: () => void; disabled?: boolean }`
- **`MapStage`** (new wrapper around existing `MapCanvas`): accepts `focusedZoneId` and `focusedSiteId`, animates map camera.
- **`RecommendationCarousel`** (new): horizontal scrollable strip of zone cards; replaces static overlay.
- **`ActionDock`** (new): the 3 outcome cards in step 4.
- **Refactored existing components**:
  - `BriefPanel` becomes the editable section inside Step 1.
  - `AdjustmentsPanel` becomes the inner content of Step 5.
  - `RfqDrawer`, `UploadDialog`, and `CausalDrawer` remain as modal dialogs but are triggered from the new shell.
  - `PackageStrip` becomes a compact live preview used in Steps 3 and 5.

## Animation and interactivity

- **Card entry**: `0.32s cubic-bezier(0.22, 1, 0.36, 1)` `translateX(-16px)` → `0` and `opacity 0` → `1`.
- **Card exit**: reverse, `0.2s`.
- **Map focus on zone select**: `0.4s` ease pan/zoom to bounding box of selected zone.
- **Step progress dots**: fill with `0.2s` color transition.
- **Button hover/active**: `0.12s` background transition; active state `scale(0.98)`.
- **Choice card hover**: `0.15s` translate `-2px` and shadow lift.
- **Reduced motion**: if `prefers-reduced-motion: reduce`, all transitions become `0.01s` or instant.

## Typography and visual hierarchy

- **Font**: Inter, with `font-feature-settings: "tnum"` for numbers.
- **Headings**:
  - Step title: `24px / 750`.
  - Section title: `18px / 650`.
  - Card title: `16px / 600`.
- **Body**: `14px / 400`, line-height `1.5`.
- **Captions/labels**: `12px / 500`, uppercase letter-spacing `0.02em`.
- **Large metrics** (reach, cost, planning fit): `28px / 750` `tabular-nums`.
- **Evidence lozenges**: `11px / 600`, `4px 8px` padding, `12px` radius.

## Accessibility

- All step transitions are announced with `aria-live="polite"` on the card region.
- Each step card has `role="region"` and `aria-label="Step N of M: title"`.
- Progress dots are a `role="progressbar"` with `aria-valuenow`.
- Map markers have `aria-label` for zone/site identity.
- Keyboard navigation: Tab through choices, Enter to select, Escape to go back.
- Focus is trapped inside `RfqDrawer`, `UploadDialog`, and `CausalDrawer`.
- Color is never the only means of conveying information (text accompanies lozenges).

## Testing

- Component tests for `StepCard`, `RecommendationCarousel`, and `ActionDock`.
- E2E test: complete the 5-step flow from default brief to RFQ with no backtracking.
- E2E test: skip from step 1 defaults to step 3.
- Visual regression: step 1, step 3 with selected zone, step 5 with What Changed open.

## Out of scope

- Full mobile redesign beyond usable bottom sheet.
- New charting library — numbers remain text-based.
- Backend changes — all data from existing bundle and planner.
