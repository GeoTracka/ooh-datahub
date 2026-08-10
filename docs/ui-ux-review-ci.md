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
- nested scroll containers; and
- the active/focused element at capture time.

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
13. context shortlist.

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

### Responsive behavior

- No page-level horizontal overflow.
- Primary controls remain reachable and comfortably sized.
- Map and decision content retain sensible priority on smaller screens.
- Mobile does not become a long sequence of equally weighted cards.
- Dialogs remain readable without creating accidental nested-scroll traps.

### Copy and evidence

- Evidence labels should support decisions, not add technical noise.
- Scenario/calibrated/context-only claims must remain visually distinct.
- Caveats should be discoverable at the point where they matter.
- No unavailable or degraded state should look equivalent to a confirmed result.

## Local usage

Run the deterministic review suite with:

```bash
pnpm test:ui-review
```

Generated review evidence is written to `artifacts/ui-ux-review/` and is intentionally ignored by git.

When a deliberate UI change modifies one of the small set of approved pixel baselines, update those baselines separately and review the resulting image diff before committing it. Do not bulk-accept screenshot changes merely to make CI green.
