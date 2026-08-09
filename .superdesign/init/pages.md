# Page/state context

## Primary page: Promotion planning explorer

### Step 1 — Who is this campaign for?
Goal: establish a coherent campaign profile with minimal effort.

Visible by default:
- three coherent quick-start campaign presets;
- selected preset state;
- concise Current campaign summary;
- `Edit campaign details` disclosure;
- Continue to timing;
- Use default timing & budget shortcut.

Failure mode to avoid: simultaneous preset + full-form dominance that makes a simple starting decision feel like form administration.

### Step 2 — When and how much?
Goal: set daypart, budget and flight.

Visible:
- daypart chips;
- quick budget chips;
- exact budget field;
- start/end dates;
- simple validation near the CTA.

### Step 3 — Recommended package
Goal: understand the recommendation in seconds.

This is the hero state and the human-comprehension test target.

Visible:
- three ranked zone cards;
- zone role/rationale;
- objective-specific marginal contribution with explicit marginal label;
- Activity Potential;
- Evidence state;
- selected zone explanation and `View delivery story`;
- `View full package` reset;
- package spend vs campaign budget/headroom;
- governed audience basis;
- permitted delivery claim/evidence;
- Planning Fit kept separate from delivery evidence;
- optional context-only uploaded inventory disclosure.

A first-time viewer should answer:
1. what package is recommended?
2. what delivery claim is permitted and at what evidence state?
3. why is this package/zone recommended?

### Step 4 — What would you like to do with this package?
Goal: choose the next outcome, not analyze more metrics.

Visible:
- Review RFQ;
- Upload customer inventory;
- Fine-tune package.

### Step 5 — Make this package yours
Goal: make deliberate package changes with clear commercial consequences.

Visible:
- current package summary;
- proposed-change business impact when dirty;
- explicit Add / Swap / Replace zone / Remove choices;
- Undo last change / Reset to original history controls;
- Audit / calculation details collapsed.

## Dialog: Delivery explanation

Default reading order:
1. what this stage means;
2. current value;
3. evidence state/source;
4. caveats and how to strengthen it;
5. supporting detail drill-down.

Audit metadata is secondary disclosure.

## Dialog: Supplier verification RFQ

Default reading order:
1. DEMO — DO NOT SEND;
2. package/flight/supplier/status summary;
3. Buyer;
4. Schedule;
5. Supplier notes;
6. explicit generation blocker or Generate RFQ;
7. readable generated supplier-isolated request cards;
8. exact plain-text/internal JSON downloads.

Never present this as booking, reservation or sending.

## Dialog: Customer inventory

Default journey:
1. Upload file;
2. Map columns when needed;
3. Review rows;
4. choose offline context or optional live enrichment;
5. confirm live enrichment when applicable;
6. review/correct locations;
7. apply reviewed facts as context.

Raw preflight JSON, technical reason codes and manual coordinates are advanced/diagnostic layers.

## Empty/unavailable/degraded states

- Invalid package: explain repair requirement and disable acceptance/RFQ, while leaving repair/upload paths available.
- Influence unavailable: disable Influence lens and normalize selection back to Plan.
- Missing evidence input: degrade claim and show recovery action; never fill the gap cosmetically.
- Provider failure: uploaded facts remain usable offline.
- No customer context: do not show empty context cards.
