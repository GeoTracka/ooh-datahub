# Step 3 Package Options Design

## Goal

Replace the single prescribed Step 3 package with a clear comparison of three distinct, deterministic planning approaches. Users must be able to continue with any option or fine-tune it directly without first accepting a recommended package.

## Product decisions

- Step 3 is titled **Choose a planning approach**.
- It presents exactly three planning styles when the planning inventory can produce at least three candidates:
  1. **Best overall** — the highest-ranked valid package under the existing objective-aware planning-fit comparator.
  2. **Maximum delivery** — the valid package with the highest objective delivery value. The user-facing supporting label adapts to the campaign objective: target reach, influence-weighted reach, or serviceable reach.
  3. **Budget smart** — the lowest-cost valid package within five score points of the best available objective-fit score, preserving a credible planning-fit guardrail while creating useful headroom.
- Styles must resolve to unique package IDs. If a style's first choice duplicates an earlier style, it takes the next candidate in that style's deterministic ranking.
- Remaining globally ranked candidates fill any open style slot. The seeded bundle must be tested to produce three unique valid options for supported briefs.
- If fewer than three valid candidates exist, Step 3 still exposes the best repair candidates, labels their constraint state, disables continuation for invalid choices, and keeps fine-tuning available as the recovery path. It does not invent duplicate packages.

## Information architecture

The decision surface is ordered as follows:

1. Short explanation tying the recommendations to campaign objective, audience, timing, and budget.
2. A three-option package comparison group.
3. Selected-package summary and zone/site breakdown.
4. Constraint or context notices when applicable.
5. Persistent actions: **Fine-tune selected package** and **Continue with selected package**.

The existing three zone cards move below the package comparison and are explicitly labelled as the selected package's zone breakdown. This removes the current ambiguity in which zones look like three alternative packages.

## Package comparison card

Each card contains only decision-relevant information:

- style badge and package name;
- one-sentence reason the option suits the brief;
- zone and site counts;
- objective delivery value with the correct permitted claim label;
- planned cost and budget headroom or overrun;
- planning fit or explicit unavailable state;
- selected, recommended, or constraint status.

The first card is selected by default. Selection updates the visible package, map features, summary metrics, and zone breakdown without navigating away.

## Interaction and state

- Package options are part of the deterministic planning result rather than UI-only calculations.
- A dedicated package-selection state transition replaces the current Step 3 preview without adding fine-tune undo history.
- Selecting the original recommendation clears the package-selection draft.
- Selecting an alternative creates a draft based on that candidate and updates the map through the existing visible-plan selector.
- **Continue with selected package** applies a valid alternative, if any, then moves to Step 4.
- **Fine-tune selected package** moves directly to Step 5. The selected candidate is the adjustment baseline and remains a draft until the existing apply/review action.
- Invalid candidates cannot continue, but can be fine-tuned to repair the stated constraints.
- Step 4 remains the outcomes screen for users who accept the selected baseline. Its existing fine-tune entry remains available.

## Planner contract

Add an objective-aware package option contract to `PlanningResult`:

- stable style ID;
- display label and reason code;
- package candidate;
- objective delivery value and reason code needed for comparison.

The optimizer derives all three options from the candidate cohort it already evaluates. The current primary recommendation remains `recommended`, preserving RFQ, adjustment, persistence, and measurement contracts. Recalculating with selected site IDs keeps the same option cohort and measures the selected candidate with the existing engine.

## Accessibility and responsive behavior

- The option list uses single-selection semantics with an accessible group label and selected state.
- Every option has a unique accessible name containing its style and key trade-off.
- Keyboard users can select an option and reach both actions in a predictable order.
- Color is not the only selected or invalid indicator.
- Desktop shows three equal comparison columns. Narrow layouts stack the cards while keeping their metrics in the same order.
- The selected zone breakdown remains horizontally compact on desktop and stacks without clipping on mobile.
- Focus indicators and reduced-motion behavior follow existing explorer conventions.

## Error and degraded states

- An invalid option shows the existing human-readable package constraint notice in the selected detail region.
- Missing delivery or planning-fit evidence is rendered as unavailable with its recovery context; it is never converted to zero.
- If fewer than three candidate packages exist, Step 3 explains that inventory/timing constraints limited the comparison and keeps fine-tuning available.
- Package selection is deterministic and does not perform network requests.

## Verification

- Optimizer unit tests prove three distinct styles, unique IDs, deterministic ordering, objective-aware maximum delivery, budget-smart guardrail, and constrained fallback.
- Reducer/service tests prove selection, reset-to-original, apply-on-continue, and fine-tune draft behavior.
- Component tests prove three package cards, selected-state updates, map/zone detail updates, both actions, and invalid-option behavior.
- Existing Step 3 tests are updated from the single `This package works` action to the two-path interaction.
- Accessibility checks cover group semantics, names, focus, and disabled continuation.
- Desktop and mobile visual baselines are refreshed after component and end-to-end behavior passes.
- Full lint, typecheck, unit/component tests, deterministic artifact checks, and production build run before completion.

## Out of scope

- No MariaDB/PostgreSQL changes.
- No new third-party UI package dependency.
- No change to the evidence model, RFQ contract, uploaded-inventory semantics, or Step 5 adjustment operations beyond accepting the selected Step 3 baseline.
