# OOH Promotion Wizard

A calibrated out-of-home (OOH) promotion-planning wizard for Lagos.
Built with Next.js 16, React 19, TypeScript 6, and Zod 4.

The application turns a campaign brief into one deterministic three-zone package,
shows the evidence and causal basis behind delivery claims, supports context-only
customer inventory, and produces a supplier-verification RFQ. The seeded demo
runs without external network access.

## Current product flow

The primary UI is a persistent-map, five-step split-canvas explorer:

1. **Campaign profile** — product information, target audience, sector and objective.
2. **Timing & budget** — daypart, budget and flight dates. A default-profile shortcut can skip directly from Step 1 to Step 3.
3. **Choose a planning approach** — compare **Best overall**, **Maximum delivery**, and **Budget smart** packages derived from the same brief. Select any package, continue with it, or fine-tune it directly without accepting the recommended option first. Selecting a zone focuses the map; **View delivery story** opens its causal explanation.
4. **Choose outcome** — review RFQ, upload customer inventory, or fine-tune the package.
5. **Fine-tune** — include/swap/remove faces or replace zones, inspect deterministic trade-offs, Undo/Reset, then apply and review the RFQ.

The planner reducer/service remains the single state path for original, applied and
draft plans; the explorer is presentation/workflow, not a second planning engine.

## Install and run

```bash
pnpm install
pnpm dev          # development server on http://127.0.0.1:3000
pnpm build        # production build
pnpm start        # start the production build
```

## Verification

`pnpm verify` is the deterministic repository gate:

```bash
pnpm verify
```

It runs lint, TypeScript, unit/component tests, frozen-bundle reproducibility,
golden-output reproducibility, the production build, and the client-secret scan.

Browser verification is intentionally separate:

```bash
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test \
  tests/e2e/seeded-fmcg.spec.ts \
  tests/e2e/sector-presets.spec.ts \
  tests/e2e/network-disabled.spec.ts
pnpm exec playwright test tests/e2e/visual-accessibility.spec.ts
```

GitHub Actions runs the deterministic `verify` job, core Chromium paths, and a
permanent visual/accessibility job against checked-in Linux Chromium baselines.
The visual suite covers Step 1, Step 3, focused Step 3, dirty Step 5, and a
390px mobile viewport, and runs axe accessibility checks.

Useful individual commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm bundle:check
pnpm bundle:verify
pnpm golden:build
pnpm golden:check
pnpm verify:secrets
pnpm tsx scripts/benchmark-planner.ts
```

## Seeded mode

The frozen Lagos bundle at `src/demo/lagos-v1/bundle.json` contains the sites,
zones, evidence profiles, target universes and model inputs needed for the demo.
Seeded planning makes **zero external network requests**. Its spatial display uses
local/synthetic planning context rather than a navigation basemap, and all delivery
claims and RFQ lines are derived from governed local inputs.

`tests/e2e/network-disabled.spec.ts` aborts every non-localhost request and proves
the core seeded flow still completes.

## Evidence and claims

The UI separates recommendation scoring from the audience-delivery causal chain.
The delivery explanation uses the six causal stages:

**Location → Places → Movement → OTS → Target → Unique**

Planning Fit A/C/P/E are recommendation-score inputs and are not presented as
causal delivery stages. Delivery/evidence claims degrade when required provenance
or calibration inputs are unavailable rather than being silently promoted.

### Evidence D

Evidence D is an assumed scenario, not a calibrated measurement. Low/Base/High
are assumption-driven scenario bounds, not P10/P50/P90 statistical quantiles.

### Evidence C

P10/P50/P90 is only appropriate when the required measurement chain and compatible
calibration bundle support a calibrated interval. The UI and RFQ preserve the
actual evidence state and source/replay information.

## Customer inventory upload

From Step 4 choose **Upload customer inventory**.

1. Select a `.csv`, `.tsv`, or `.xlsx` file; parsing stays local.
2. Confirm ambiguous column mappings when required.
3. Review accepted/quarantined/rejected rows and select up to 50.
4. Use **Use uploaded facts as context** for the offline path, or optionally run **Review enrichment** before a provider call.
5. Review/correct coordinates and apply the reviewed facts as context.

Applied customer inventory is shown back in Step 3 as a transparent comparison:
nearest selected zone, format fit, indicative rate delta versus the selected-face
median, and metadata completeness.

Uploaded/provider data is always **context-only**. It does not receive calibrated
reach, Planning Fit, or an evidence upgrade merely because it was uploaded or
geocoded.

## Optional live geocoding

Live geocoding is **off by default** and is not required for the seeded demo.
Application-side live enablement fails closed unless the required flags, secrets,
provider key, and upstream quota mode are configured.

Relevant settings are documented in `.env.example`, including:

- `LIVE_ENRICHMENT_ENABLED=true`
- `GOOGLE_GEOCODING_V4_ENABLED=true`
- server-only `GOOGLE_GEOCODING_API_KEY`
- `ENRICHMENT_PREFLIGHT_SECRET`
- `ENRICHMENT_ACCESS_GRANT_SECRET`
- `ENRICHMENT_QUOTA_ENFORCEMENT=upstream`

The API requires a short-lived signed upstream access grant and binds preflight
approval to the caller/grant plus the submitted rows. Provider candidates remain
context-only and separately reviewable.

**Deployment boundary:** the repository does not pretend an in-process map is a
production quota/billing authority. Before internet-facing live enrichment is
enabled, a trusted upstream authentication/quota service and durable replay/
idempotency policy are still required.

## RFQ boundary

The generated supplier RFQ is a verification request, not a booking. It carries:

- `DEMO — DO NOT SEND`
- `draft_unbooked_unsent`
- supplier-isolated lines and notes
- requested identity/orientation, dimensions, availability, rate, production,
  installation, tax, lead-time, permit, proof and measurement confirmations.

Internal RFQ audit data records the governed target definition, evidence basis,
model/replay versions and context revision. Supplier-facing copy keeps the buyer's
original target-audience wording and does not leak internal budget/evidence data.

## Deterministic artifacts and performance guardrail

`pnpm bundle:verify` and `pnpm golden:check` rebuild their checked-in artifacts and
require byte-for-byte reproducibility.

`scripts/benchmark-planner.ts` exercises the full bounded optimizer against expanded
50- and 100-site synthetic inventories. The committed benchmark is a regression
guardrail (100 sites ≤ 2,000 ms and ≤ 256 MB heap delta), **not** a production or
browser SLA.

## Release status / known external gates

Machine-verifiable seeded-demo gates are now represented in CI: deterministic
verification, core browser paths, network-disabled execution, visual baselines,
and axe checks.

Two boundaries remain intentionally external rather than fabricated in code:

- the real three-viewer comprehension protocol in `docs/demo-comprehension-check.md` requires actual human observations;
- live paid enrichment remains blocked on a deployment-grade upstream auth/quota
  issuer and durable replay/idempotency enforcement.

Those gates should remain explicit rather than being marked complete by fixtures or
in-memory substitutes.
