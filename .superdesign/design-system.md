# OOH Datahub design system

## Purpose

This file is the design contract for the current promotion-planning product. It is derived from the implementation in `src/features`, `src/maps`, `src/app/*.css`, the split-canvas specification, and the Evidence-D product boundaries.

The goal is a client-presentable planning tool that feels calm, spatial and precise. Design changes must improve comprehension or decision efficiency; visual novelty is not a goal by itself.

## Product principles

### 1. One decision at a time
The map is persistent context. The foreground surface asks for one planning decision. Never regress to a dashboard where campaign form, recommendation, adjustments, evidence and RFQ all compete simultaneously.

### 2. Meaning before metadata
Normal UI order:
1. what is recommended / what happened;
2. why it matters;
3. commercial consequence;
4. evidence/caveat;
5. exact audit metadata under disclosure.

Raw IDs, hashes, JSON, fingerprints, provenance and coordinates belong in audit/advanced layers unless they are the immediate task.

### 3. Evidence is a product state, not decoration
Evidence C/D/unavailable must be visible in text and must come from the engine. Visual polish can never upgrade a claim.

Planning Fit and delivery evidence are separate concepts and remain visually/semantically separate.

### 4. Spatial interaction should explain the recommendation
A selected recommendation must have a visible relationship to the map. Focus is continuous rather than a map remount. Zone identity and lens semantics should be readable without requiring a modal.

### 5. Human labels first
Use zone/site labels and commercial descriptions. Keep raw IDs secondary. Do not invent names that are absent from governed data.

### 6. Reversible planning
Draft changes are explicit and reversible. Undo means the last planning decision, not the last text-input keystroke. Reset returns to the original recommendation.

## Visual signature

OOH Datahub should be recognizable through domain language rather than decorative branding:
- ranked zone roles: `#1 Primary`, `#2 Booster`, `#3 Cover`;
- cartographic marker/caption language;
- map-focus + explanation pairing;
- deep teal for selected/planning action;
- warm gold for recommendation/Evidence D emphasis;
- explicit evidence lozenges;
- warm editorial surfaces with restrained elevation.

This is the product signature. Do not add generic AI gradients, neon, glass effects, abstract neural imagery or gratuitous charting.

## Tokens

### Color
```text
--surface-shell:        #faf8f5
--surface-map:          #f2efe9
--surface-card:         #ffffff
--surface-soft:         #fbfbfa
--surface-technical:    #f7f8f8

--text-primary:         #1c2026
--text-body:            #5c6272
--text-caption:         #667085

--accent-teal:          #0f5b4e
--accent-teal-soft:     #e7f1ee / #edf5f2
--accent-gold:          #c7982c
--accent-gold-text:     #765314
--accent-gold-soft:     #fdf6e3

--border-neutral:       #e3e4e7
--border-subtle:        rgba(28,32,38,.05-.07)
```

### Radius
```text
--radius-major: 18px
--radius-card:  12-14px
--radius-field: 8-10px
--radius-pill:  999px
```

### Elevation
```text
foreground decision card:
0 1px 2px rgba(28,32,38,.05), 0 10px 36px rgba(28,32,38,.10)

small floating spatial chrome:
0 4px 18px rgba(28,32,38,.08-.09)
```

### Spacing rhythm
Prefer an 4/8/12/16/20/24px rhythm. Use denser 2–5px gaps only inside captions/metric pairs.

## Typography

- Font: Inter/system sans unless a deliberate brand typography decision is approved.
- Step headline: 24px / ~750 / tight tracking.
- Modal headline: 22px / strong.
- Section title: 15–18px / 650–700.
- Card title: 13–16px / 600–700.
- Body: 12–14px / 400–500 / 1.4–1.5 line height.
- Eyebrow/caption: 10–12px / 650–750.
- Large metrics use tabular numerals.

Do not solve density by shrinking body text below readable sizes.

## Component rules

### StepCard
- one step title;
- progress always visible;
- Back is secondary;
- at most one primary CTA;
- internal scroll only when necessary.

### Recommendation card
Must answer:
- rank/role;
- zone identity;
- objective-specific **marginal contribution**;
- Activity Potential;
- Evidence state.

Selected state additionally explains the role and exposes delivery story + full-package reset.

### Package summary
Must show:
- site count;
- planned spend vs campaign budget + headroom/overrun;
- governed audience basis;
- permitted delivery claim/evidence;
- influence state;
- Planning Fit separately.

### Fine-tune
No hidden `first compatible` behavior.
- user selects exact object;
- action produces one draft;
- business-impact summary first;
- audit details collapsed.

### Upload
Offline context is first-class. Optional live enrichment is clearly distinguished before any provider call. Technical preflight/codes/manual coordinates are secondary.

### RFQ
Always visibly `DEMO — DO NOT SEND` and draft/unbooked/unsent. Generation blockers are explained. Supplier messages are readable cards with exact raw text available secondarily.

### Causal explanation
Default: plain-English stage meaning → value → evidence → caveat/recovery → drill-down.
Audit: exact transformations/source IDs/provenance.

## Interaction rules

### Map
- map remains mounted during focus transitions;
- focus uses camera motion, not component recreation;
- selected zone has visible caption/identity;
- current lens has a compact legend;
- full-package overview is always recoverable;
- reduced motion uses immediate camera movement.

### Forms
- text editing is staged locally;
- planner recomputation happens at a semantic decision boundary;
- disabled primary actions have an adjacent reason where ambiguity would otherwise exist.

### Dialogs
- initial focus inside dialog;
- Tab contained in active modal;
- Escape closes the modal only;
- focus returns to opener;
- underlying StepCard Escape navigation does not also fire.

## Accessibility acceptance

Required for a design change to merge:
- WCAG AA text contrast for the tested UI;
- keyboard reachable actions;
- no color-only state;
- no dangling ARIA relationships;
- one coherent active tab/lens state;
- reduced motion support;
- permanent axe CI remains zero-violation for covered states.

## Responsive acceptance

### Desktop
Persistent map + left decision card; no dashboard expansion.

### Tablet
Map context + bottom sheet; avoid shrinking the desktop card into a tiny floating panel.

### Mobile
Compressed map header + full content sheet. Keep one-column choices and reduce nonessential map chrome while preserving meaning.

## Design review checklist

Before approving a UI change:
1. Does it reduce time/effort to make the current planning decision?
2. Does it preserve exact evidence/metric semantics?
3. Is the primary meaning visible without opening audit details?
4. Is raw technical data hidden only when it is genuinely secondary?
5. Does it reuse the established spatial/evidence language?
6. Is it simpler than adding another card/panel/chart?
7. Does it remain keyboard/mobile/reduced-motion usable?
8. Did permanent visual + axe regression intentionally accept the change?

## 9/10 bar

A whole-product 9/10 claim requires:
- primary Step 1–4 workflow is immediately comprehensible;
- Step 5 is deliberate rather than helper-driven;
- Upload/RFQ/causal surfaces are human-first with audit depth preserved;
- spatial focus and lens semantics are visible;
- no semantic-label/state bugs;
- three real unfamiliar viewers pass the Step 3 comprehension gate;
- visual/axe/core/deterministic CI all remain green.

Do not call the UI 9/10 solely because screenshots look polished.
