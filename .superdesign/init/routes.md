# Route and surface context

## `/`
Primary and currently only user-facing application route.

### States within the route
- Step 1 Campaign profile
- Step 2 Timing & budget
- Step 3 Recommended package
- Step 4 Choose outcome
- Step 5 Fine-tune
- Causal explanation dialog
- Supplier verification RFQ dialog
- Customer inventory upload/review dialog

The five steps are application state, not separate browser routes. Preserve one continuous spatial/planning context unless a future product requirement proves URL-addressable steps are necessary.

## `/api/enrichment/preflight`
Optional live-enrichment server route.
- Seeded/offline product does not depend on it.
- Live mode requires the server-controlled signed access boundary.
- Browser-facing design must distinguish `offline context` from `optional paid/live enrichment` before this route is called.
- Never expose signing material in the client.

## `/api/enrichment/run`
Optional provider-execution route after valid preflight.
- Context-only output.
- Does not upgrade delivery evidence.
- Production exposure is blocked by the external auth/quota/replay deployment gates.

## Navigation principles

- Do not introduce a global sidebar for the current product; it would add permanent chrome without a current multi-section navigation need.
- The map lenses are explanatory view controls, not application navigation.
- Back within the explorer means return to the previous planning decision, not browser history.
- Escape may return one step only when a modal is not open.
- Drawers/dialogs return focus to the launching control.

## Future route threshold

Add distinct browser routes only when there is a persistent user-owned object that benefits from a stable URL, e.g. saved campaigns, organization inventory, RFQ history, or production administration. Do not create routes solely to make the demo feel larger.
