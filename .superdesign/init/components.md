# Component inventory

This file is generated from the current OOH Datahub implementation and is design context, not runtime configuration.

## Primary workflow components

### `PlannerPage`
- Single application/workflow owner for the seeded planner.
- Owns campaign brief, five-step explorer state, map lens, selected zone, drawer state and upload modal state.
- Uses the existing planner reducer/service as the only planning state machine; the explorer must never become a second planning engine.

### `StepCard`
- One-decision-at-a-time card shell.
- Announces `Step N of 5` and exposes progress, optional Back and one primary action.
- Desktop: floating left rail. Tablet: bottom-sheet treatment. Mobile: full content sheet below compressed map.

### `RecommendationCarousel`
- Three-zone package exploration surface.
- Cards expose rank/role, objective-specific marginal contribution, Activity Potential and Evidence state.
- Selection focuses the map first; causal explanation is a separate `View delivery story` action.
- Selected zone can return to `View full package`.

### `PackageStrip`
- Compact applied/draft package summary.
- Shows site count, planned spend vs campaign budget/headroom, governed audience basis, permitted delivery claim/evidence, influence state and Planning Fit.
- Delivery evidence and Planning Fit remain distinct concepts.

### `ActionDock`
- Step 4 outcome choices only: Review RFQ, Upload customer inventory, Fine-tune package.
- Large choice-card interaction; one clear action per card.

### `AdjustmentsPanel`
- Step 5 explicit fine-tune interaction.
- User chooses exact site/zone objects before Add/Swap/Replace/Remove mutations.
- Default comparison is business-facing: spend, objective delivery, Planning Fit, evidence, trade-off.
- Fingerprints, revisions, raw IDs and comparability metadata belong under Audit / calculation details.

## Spatial components

### `MapStage`
- Persistent map wrapper and visible active-lens legend.
- Always labelled as planning context, not navigation.

### `MapCanvas`
- Renderer adapter for local MapLibre and optional provider-review Google scene.

### `MapLibreRenderer`
- Deterministic seeded/offline map.
- Continuous camera focus via imperative `flyTo`, not remounts.
- Visible marker captions and compact metric values.
- Honors reduced motion.

### `LensTabs`
- Plan / Activity / Reach / Influence explanatory lenses.
- Lenses explain already-computed values; they do not alter the planning decision.
- Influence is disabled/falls back to Plan when influence data is unavailable.

## Explanation and review surfaces

### `CausalDrawer`
- Human explanation first; audit detail second.
- Delivery chain: Location → Places → Movement → OTS → Target → Unique.
- Only Planning Fit D · Delivery enters that chain.
- A/C/P/E are recommendation inputs with independent explanation.

### `RfqDrawer`
- Supplier verification review, never booking/sending.
- Groups package summary, Buyer, Schedule and Supplier Notes.
- Explicitly explains why generation is blocked.
- Supplier outputs stay isolated; exact plain text and internal JSON remain downloadable.

### `UploadDialog`
- Guided context-only inventory import.
- Stages: Upload file → Map columns → Review rows → Use as context → optional live enrichment → Review locations.
- Offline path is first-class and requires no provider call.
- Technical codes/preflight JSON/manual coordinates are secondary diagnostic/advanced detail.

### `UploadedContextPanel`
- Transparent context-only comparison of uploaded customer rows.
- Nearest selected zone, format relation, indicative rate delta and metadata completeness.
- Never assigns reach, Planning Fit or evidence upgrades to uncalibrated rows.

## Accessibility infrastructure

### `ModalFocusContainment`
- Global Tab containment for the active `role=dialog[aria-modal=true]` surface.
- Filters hidden and closed-details content.

### Dialog-specific behavior
- Causal/RFQ/Upload own initial focus, Escape close and focus return.
- StepCard Escape navigation yields while any dialog is open.

## Extraction rule

Do not create a new component merely to satisfy a design pattern. Extract only when a repeated interaction/state boundary exists. Reuse these primitives before adding another card, dialog, metric or navigation system.
