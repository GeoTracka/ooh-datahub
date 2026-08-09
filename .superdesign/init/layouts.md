# Layout system

## Core composition

The product is a persistent spatial canvas with one foreground decision surface. The map is context; the card is the current decision. Do not turn this into a dashboard grid.

## Desktop — 1024px and wider

- Viewport-height shell.
- Map canvas fills the viewport at z-index 0.
- Decision rail sits at the left at z-index 100.
- Rail width: approximately `min(440px, 38vw)`; intended visual proportion is roughly 30–35% decision surface / 65–70% map.
- Card is vertically centered where content permits and scrolls internally when needed.
- Lens control floats top-right and must remain visually secondary to the current decision.
- Map note/legend live in bottom-right spatial chrome.
- Dialog/drawer surfaces overlay above rail/map and own focus.

## Tablet — 768–1023px

- Map remains full-screen context.
- Decision card becomes a bottom sheet, maximum roughly 55vh.
- Sheet should feel like the same decision card moved to a touch-friendly surface, not a new mobile application.
- Lens controls remain floating above the map.

## Mobile — below 768px

- Map becomes a compressed top spatial header (~32vh currently).
- Decision card begins around 28vh and owns the remainder of the document.
- One-column fields.
- Avoid desktop-like multi-panel density.
- Map legend/captions simplify rather than disappear semantically.

## Step card layout

Each step is composed in this order:
1. eyebrow / step number;
2. one task-oriented headline;
3. progress line;
4. current decision content;
5. Back + one primary CTA when applicable.

Secondary detail uses `<details>` or nested review cards, not additional full-width panels competing with the main action.

## Step-specific layout intent

### Step 1 — Campaign profile
- Quick-start presets first.
- Concise current-campaign summary second.
- Detailed fields under `Edit campaign details`.
- Default action can skip timing/budget only when defaults are intentionally accepted.

### Step 2 — Timing and budget
- Daypart chips.
- Budget quick choices + exact amount.
- Flight dates.
- Validation near the action boundary.

### Step 3 — Recommended package
- This is the hero composition.
- Recommendation carousel first.
- Package/evidence/budget summary second.
- Context-only customer inventory disclosure only when present.
- One primary acceptance action.

### Step 4 — Outcome
- Three large decision cards only.
- Avoid adding metrics or configuration here.

### Step 5 — Fine-tune
- Live package summary.
- Business-facing proposed-change summary.
- Explicit Add/Swap/Replace/Remove choices.
- Audit details collapsed by default.
- Undo/Reset visually grouped as history controls.

## Dialog/drawer layout

- Width/height must preserve context but prioritize reading.
- Human summary precedes raw metadata.
- Sections use clear headers and compact bordered surfaces; avoid one undifferentiated long form.
- Raw JSON, source IDs, fingerprints, coordinates and exact generated text are disclosure/advanced layers unless they are the user's immediate task.
