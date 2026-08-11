# Screenshot-driven UI / UX CI review

The UI quality gate has two deliberately separate responsibilities:

1. **Objective regression gates** — Playwright screenshot baselines, axe, horizontal-overflow checks, critical-control geometry, modal focus containment and focus restoration.
2. **Human design evidence** — named screenshots plus layout diagnostics captured on every CI run, including successful pull requests.

A green pixel diff is not treated as proof that the interface is good. The review pack exists so hierarchy, density, clarity and workflow coherence can be inspected deliberately.

## CI artifact

The `UI / UX review` job uploads:

- `ui-ux-review-<run>-<attempt>` on every run;
- `ui-ux-failure-<run>-<attempt>` only when the review suite fails.

The review artifact contains paired `.png` and `.json` files. The JSON sidecar records:

- viewport and document dimensions;
- page-level horizontal overflow;
- visible interactive-control count;
- controls smaller than the WCAG 24px minimum candidate size;
- potentially clipped text nodes;
- raw nested/inner scroll containers;
- actionable nested-scroll candidates; and
- the active/focused element at capture time.

The raw scroll list is intentionally lossless. The actionable scroll list is triage-only: it excludes the mobile explorer shell when that shell is the page's primary scroll surface, excludes near-full-width tablet/mobile step cards that operate as the intentional bottom sheet, and excludes `.planner-drawer-body`, which is deliberately the sole modal scroll owner. These intentional surfaces remain present in raw sidecars; narrow competing internal scrollers remain actionable.

The diagnostics are review signals, not a substitute for looking at the screenshot.

## Captured workflow states

The review suite intentionally samples the user journey rather than duplicating the functional E2E suite.

### Desktop, 1440 × 1000

1. brief / objective entry;
2. timing and budget;
3. recommended package;
4. focused recommendation zone;
5. delivery-story causal dialog;
6. package-confirmed state;
7. fine-tune state;
8. dirty/unapplied fine-tune state;
9. supplier-verification RFQ;
10. keyboard-focus state;
11. upload dialog;
12. uploaded inventory preview; and
13. uploaded planning-context status.

For the desktop fine-tune workflow, 1440 × 1000 is the no-internal-scroll quality target: clean and dirty Step 5 must expose all four adjustment modes and the RFQ decision action in the first viewport while retaining meaningful map context. Shorter desktop heights such as the 1280 × 720 locked visual baseline may still scroll vertically; that is preferable to shrinking typography, hiding decision evidence, or overlaying actions.

### Degraded and recovery states

The review suite also captures browser-reachable unhappy paths at 1440 × 1000:

1. invalid package / blocked acceptance;
2. approximate upload-column mapping review;
3. quarantined and rejected upload rows;
4. provider/preflight enrichment failure with local facts still usable;
5. spreadsheet parse failure after replacing a previously valid upload; and
6. RFQ schedule revision required before generation.

These states must lead with a human-readable consequence and next action. Machine reason codes and exception strings may remain available under a subordinate `Technical detail` disclosure for audit/support, but must not be the primary copy.

Quarantine/rejection summaries must never echo quarantined row values or apparent personal data. They may show safe aggregate reason counts only. Provider failure must not make already-valid local upload facts appear lost. A replacement-file parse failure must clear the previous upload snapshot/preflight so stale reviewed data cannot be mistaken for the failed file.

RFQ generator failure remains component-injected for deterministic testing; the production UI does not gain a fake failure switch solely to produce a screenshot.

When more than one map is visible, each map landmark must have a distinguishable accessible name. Embedded MapLibre review maps therefore receive context-specific labels instead of sharing the default `Map` landmark name with the planning canvas.

### Active transition states

Longer or expensive operations must be visibly explicit without inventing fake progress. The UI uses indeterminate `role="status"` surfaces and never displays a made-up percentage, artificial countdown, or synthetic stage completion claim.

The review pack holds real network requests open to capture two deterministic provider states at 1440 × 1000:

1. enrichment preflight pending — the selected-row basis is locked while provider requirements are checked; and
2. provider enrichment pending — row/file/geocode-review mutations are locked while location candidates are requested.

These states must remain single-flight. Repeated clicks must not create duplicate requests, Close/Escape must remain available, and changing selected rows after a completed preflight must invalidate that preflight before enrichment can run again.

Short local transitions are tested semantically rather than delayed just to make screenshots possible. Recommendation building yields one browser paint before synchronous planning computation so `Building recommendation…` can render and conflicting Step 1/2 controls can lock. RFQ generation likewise paints a generating state, freezes reviewed fields, rejects re-entry, and supports both the current synchronous generator and future asynchronous generators. No artificial wait is added solely for visual evidence.

### Responsive

- compact laptop: 1024 × 768 recommended package;
- tablet: 834 × 1112 recommended package and delivery story;
- mobile: 390 × 844 brief and recommended package.

The existing approved pixel baselines remain in `visual-accessibility.spec.ts`; the review screenshots are additional evidence and do not require committing a new baseline for every state.

## Review checklist

Review the screenshots as one workflow, not as isolated mockups.

### Hierarchy

- Is the current decision/question obvious within a few seconds?
- Is the primary action visually dominant without overpowering the content?
- Are package, zone, evidence and delivery claims clearly different information levels?
- Does the map support the decision rather than compete with it?

### Density and scanability

- Is important information visible without turning the screen into a dashboard wall?
- Are repeated labels, metadata and caveats collapsed to the minimum useful form?
- Are cards visually distinguishable without excessive borders, pills or containers?
- Are long evidence/caveat strings readable without becoming the dominant visual element?

### Interaction states

- Does selected/focused/dirty/applied state read immediately?
- Do drawers and dialogs preserve context and have a clear exit?
- Is keyboard focus visible and contained correctly?
- Does the RFQ transition feel like a continuation of the applied plan rather than a separate product?
- On failure, is the next recoverable action obvious without reading an internal code?
- Does a failed replacement/upload avoid showing stale data from the previous successful state?
- During an active operation, is it obvious what is happening and which controls are intentionally locked?
- Can the operation be accidentally submitted twice, or can its input basis change underneath it?
- Is Close/Escape still available while provider or RFQ work is active?

### Responsive behavior

- No page-level horizontal overflow.
- Primary controls remain reachable and comfortably sized.
- Map and decision content retain sensible priority on smaller screens.
- Mobile does not become a long sequence of equally weighted cards.
- Dialogs remain readable without creating accidental nested-scroll traps.
- Treat the mobile page and full-width tablet bottom sheet as primary responsive scroll surfaces; do not optimize merely for a zero raw-scroll count.

### Copy and evidence

- Evidence labels should support decisions, not add technical noise.
- Scenario/calibrated/context-only claims must remain visually distinct.
- Caveats should be discoverable at the point where they matter.
- No unavailable or degraded state should look equivalent to a confirmed result.
- Internal reason codes belong in technical detail, not as the recovery message.
- Quarantine summaries must explain why rows were excluded without reproducing sensitive row values.
- Busy copy must describe real work without claiming a percentage or completion estimate the application does not know.

## Local usage

Run the deterministic review suite with:

```bash
pnpm test:ui-review
```

Generated review evidence is written to `artifacts/ui-ux-review/` and is intentionally ignored by git.

When a deliberate UI change modifies one of the small set of approved pixel baselines, update those baselines separately and review the resulting image diff before committing it. Do not bulk-accept screenshot changes merely to make CI green.
