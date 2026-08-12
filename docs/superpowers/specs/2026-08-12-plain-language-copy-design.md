# Plain-Language Product Copy Design

## Goal

Make every customer-facing screen and generated RFQ understandable to a non-specialist, while accurately presenting the inventory as real inventory and clearly distinguishing inventory facts from modelled audience estimates.

## Chosen approach

Use a presentation-only vocabulary layer. Internal schema values, evidence grades, source IDs, calculation names, and replay identifiers remain unchanged so calculations and audit records stay stable. Components and view models translate those values into plain English before they reach the user.

This is preferable to a small search-and-replace pass, which would leave inconsistent wording, and to renaming the domain model, which would create calculation and migration risk without improving the interface.

## Copy principles

1. Lead with the decision a planner needs to make, not the calculation method.
2. Use familiar words: location, audience, estimate, remaining budget, data confidence, and package.
3. Describe the inventory as inventory or media locations. Never call it synthetic, demo, sample, or illustrative in customer-facing copy.
4. Do not overstate modelled outputs. Reach and audience figures remain estimates, with a plain confidence description.
5. Keep technical source IDs and model details available in the explanation drawer, but place them after the plain summary.
6. Use short labels that fit the existing clean layout; longer explanations belong in supporting text or the explanation drawer.

## Vocabulary

| Current wording | Customer-facing wording |
| --- | --- |
| Demo Spark | Spark Refresh |
| Synthetic demo inventory and exposure geometry | Inventory locations and mapped visibility inputs |
| Evidence D | Early estimate |
| Evidence unavailable | Data confidence unavailable |
| Marginal target reach | Additional people reached |
| Marginal influence-weighted reach | Additional priority-audience reach |
| Marginal serviceable reach | Additional likely-customer reach |
| Activity Potential | Area activity |
| Influence Capture | Priority-audience coverage |
| Planning Fit | Plan score |
| Lead delivery zone | Main area |
| Complementary audience zone | Supporting area |
| Coverage balance zone | Additional coverage area |
| Scenario target reach | Estimated audience reach |
| Low / Base / High | Lower / Expected / Upper |
| Budget headroom | Budget remaining |
| Audience basis | Audience used |
| Eligible faces / locations | Available media locations |
| Planning context | Planning map |
| Causal stages | How the estimate was built |
| DEMO — DO NOT SEND | DRAFT — NOT YET SENT |

## Scope

Included:

- All five planner steps and their actions, errors, empty states, and loading states.
- Recommendation cards, package comparison, metrics, map tabs, legend, and map status.
- Fine-tuning controls and change summaries.
- Upload dialog and uploaded-inventory status.
- Explanation drawer, including stage labels, summaries, caveats, and recovery guidance.
- RFQ drawer, generated subject/body, and draft watermark.
- Browser title and description.

Excluded:

- Internal TypeScript property names and enum values.
- Frozen-bundle IDs and replay/source identifiers.
- Developer-only README material and test names that accurately describe historical fixtures.
- Calculation behavior, inventory coordinates, rates, and audience estimates.

## Accuracy safeguards

- Real inventory is described as inventory without adding unverified claims such as “audited” or “certified.”
- Modelled audience outputs are labelled as estimates.
- “Early estimate” replaces the opaque grade in primary UI, while the raw grade remains available in source/audit details when needed.
- Draft RFQs remain visibly unsent; removing “demo” must not make them look booked or issued.

## Testing

- Add a copy-policy test that fails when banned demo framing or priority jargon appears in the customer-facing copy registry.
- Update component tests to assert the new labels in the main planner, recommendations, map, explanation drawer, upload flow, fine-tuning, and RFQ.
- Run focused unit/component tests, type checking, linting, and the core desktop/mobile Playwright workflow.
- Visually inspect Step 3 and the explanation drawer at desktop and mobile widths to catch wrapping or hierarchy regressions.
