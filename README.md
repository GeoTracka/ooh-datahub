# OOH Promotion Wizard

A calibrated promotion wizard for out-of-home (OOH) media planning in Lagos.
Built with Next.js 16, React 19, TypeScript 7, and Zod 4.

The wizard produces a three-zone package recommendation from a frozen, seeded
data bundle, surfaces evidence-graded delivery claims, and generates a
supplier verification RFQ — all without requiring a live network connection in
seeded mode.

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev          # start the dev server at http://127.0.0.1:3000
pnpm build        # production build
pnpm test         # unit + component tests (Vitest)
pnpm test:e2e     # end-to-end tests (Playwright — requires running server)
pnpm lint         # ESLint
pnpm typecheck    # TypeScript --noEmit
pnpm golden:build # rebuild and verify golden plan/RFQ outputs
pnpm tsx scripts/verify-client-secrets.ts  # scan .next/static for leaked keys
```

## Seeded mode

The app ships with a frozen Lagos bundle (`src/demo/lagos-v1/bundle.json`)
that contains all sites, zones, evidence profiles, and target universes needed
to produce a deterministic recommendation. In seeded mode the wizard makes
**zero external network requests** — every delivery claim, map tile, and RFQ
line is derived from the bundle alone.

## Optional live geocoding

Live Google Geocoding API v4 enrichment is opt-in and requires:

- `GOOGLE_GEOCODING_API_KEY` — server-side only; never exposed to the client.
- Legal and commercial approval for Places Aggregate and Routes capabilities.

Provider candidates are always **context-only** and separately reviewable.
Customer-captured and open-licensed coordinates work offline without any
provider call.

## The four-minute demo path

1. Click **Build campaign** — three zone cards appear with a scenario target
   reach claim labelled **Evidence D**.
2. Click a zone card to open the causal drawer — navigate the six stages
   (Location → Places → Movement → OTS → Target → Unique) to see how each
   delivery estimate was derived.
3. Adjust the campaign (objective, time, budget, include/swap/remove faces) —
   the package strip shows **Unapplied changes**.
4. Click **Apply & review RFQ** — fill in buyer contact and response deadline,
   then click **Generate RFQ**.

The generated RFQ carries a **DEMO — DO NOT SEND** watermark and
`draft_unbooked_unsent` status. It is a verification request, not a booking.

## The upload vignette

1. Click **Upload spreadsheet** — select a `.csv`, `.tsv`, or `.xlsx` file.
2. Review accepted and quarantined rows; select up to 50.
3. Click **Use uploaded facts as context** — no network call is made.
4. Optionally click **Review enrichment** → **Enrich locations** to request
   provider geocode candidates (requires preflight and network).
5. Confirm or correct coordinates, then click **Use reviewed facts as context**.

Uploaded context is always **context-only** — it never upgrades the delivery
claim above the seeded evidence ceiling. A calibration bundle mismatch
(`CALIBRATION_BUNDLE_MISMATCH`) is shown when uploaded coordinates do not
match the frozen bundle's calibration envelope.

## Evidence-D and booking-status disclaimers

- **Evidence D** means the delivery claim is an assumed scenario, not a
  calibrated measurement. The Low/Base/High range reflects scenario
  assumptions, not statistical quantiles.
- **DEMO — DO NOT SEND** and `draft_unbooked_unsent` appear on every generated
  RFQ. The output is for internal review only.

## Why Low/Base/High is not P10/P50/P90

- **Scenario range (Low / Base / High)** — assumption-driven bounds used when
  the overlap model or schedule is assumed. Labelled Evidence D.
- **Quantile range (P10 / P50 / P90)** — calibrated statistical intervals
  produced only when the full measurement chain (movement, orientation, view
  zone, schedule, target universe, target allocation, overlap model) is
  available and the calibration bundle is inside the envelope. Labelled
  Evidence C.

## Provider feature flags and required approvals

| Capability | Product | Status | Required approval |
|---|---|---|---|
| Geocoding | Google Geocoding API v4 | Opt-in | API key + legal review |
| Places Aggregate | google.places-aggregate.v1 | Disabled | `LEGAL_AND_COMMERCIAL_APPROVAL_REQUIRED` |
| Routes | google.routes.v1 | Disabled | `DISPLAY_CONTEXT_APPROVAL_REQUIRED` |

## Network-disabled verification

The seeded flow makes no external request. The E2E test
`tests/e2e/network-disabled.spec.ts` aborts every non-localhost request and
confirms the package strip renders with an empty external-call list.

## Golden outputs

`pnpm golden:build` regenerates `src/demo/lagos-v1/golden-outputs.json` for
all three sector presets (FMCG, Real Estate, Bank / Fintech). The unit test
`tests/unit/demo/goldenOutputs.test.ts` verifies that the checked-in file
rebuilds byte-for-byte from the frozen bundle.
