# Authoritative consumer-survey context

## Source contract

OOH Datahub treats the owner-supplied workbook below as an authoritative, final,
commercially usable consumer-research source:

- source ID: `rbl-loma-nigeria-ooh-consumer-penetration-2026-r1`
- file: `RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx`
- worksheet: `Nigeria OOH 3`
- data rows: `1,844`
- columns: `302`
- file SHA-256: `780a9fbaa2b4e736c4a4236fae751cb8c314aabaf6cad8206e553870bc5032e2`
- exact header-array SHA-256: `8ef2dc4ede086ba1e7b28e78f9c413eeea4463ee658b9f394dfbc7b955d12acc`
- collection period: `2026-05-20` through `2026-06-03`

The raw workbook is not committed. Every validation or derivative must verify the
exact file bytes, worksheet, column count, header digest and row count before use.
A corrected workbook is a new immutable source revision rather than an overwrite.

## Semantic boundary

The source is approved for `context_only` consumer research:

- OOH attention and self-reported notice frequency;
- recall and memorability;
- mobility, commute and environment context;
- relative format affinity;
- creative/attention cues;
- self-reported actions and responsive product categories;
- reviewed road/area research.

It is not direct observational evidence of movement, exposure geometry, OTS,
frequency, unique reach, target share, influence, sales lift or asset location.
Survey aggregates must not populate the measurement, Planning Fit, target universe,
panel or calibration contracts.

## Privacy boundary

The source adapter deliberately omits respondent/collector identity and raw
coordinates from `CanonicalSurveyResponse`. Interview GPS and timing are used only
to emit advisory source diagnostics. Client-facing derivatives contain aggregates
only, omit facets below the configured minimum sample size and suppress individual
question denominators below that threshold.

The authoritative-cleaned assumption means advisory diagnostics do not invalidate
the source. They remain auditable and are applied at the relevant question rather
than deleting unrelated answers.

## Commands

Validate the exact workbook without producing a derivative:

```bash
pnpm survey:validate \
  --source="/secure/raw/RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx"
```

Derive a deterministic de-identified aggregate snapshot:

```bash
pnpm survey:derive \
  --source="/secure/raw/RBL-LOMA Nigeria OOH Consumer Penetration Cleaned Databook.2026.xlsx" \
  --out="/secure/derived/rbl-loma-2026-context.json" \
  --minimum-sample-size=30
```

The output has no generation timestamp. Its digest is SHA-256 over canonical JSON,
so the same source, policy and code inputs reproduce the same identity.

## Aggregate contract

`consumer-survey-context-v1` contains:

- immutable source identity and rights/authority state;
- response and included-response counts;
- explicit minimum sample size;
- deterministic overall and segment facets;
- per-metric numerator/denominator or suppression state;
- `context_only` decision use;
- `self_reported_consumer_context_not_observed_delivery` claim boundary;
- canonical snapshot digest.

Default facets are overall, city, age band, gender, transport mode, city × age band
and city × transport mode. Additional dimensions remain explicit and versioned.

## Objective-aware product integration

`selectSurveyContextSignals()` selects the most specific available facet for a
transparent query and emits no more than three independent signals. The campaign
objective controls only which survey facts are surfaced:

- `broad_reach`: strongest format affinity, dominant noticing environment and leading
  creative cue;
- `influential_core`: strongest format trust affinity, four-week recall context and
  leading creative cue;
- `near_conversion`: self-reported search, visit and purchase actions.

The objective profile does not change package ranking, delivery, Planning Fit,
evidence grade or any measurement contract. Signals retain source period, sample
size, selected scope, evidence state and claim boundary. They are facts, not a
composite opportunity or confidence score.

## Published planning-context projections

The full aggregate snapshot is an offline governed derivative and is not bundled into
the browser. Publish each bounded Lagos objective projection from the same verified
snapshot:

```bash
pnpm survey:publish-context \
  --snapshot="/secure/derived/rbl-loma-2026-context.json" \
  --out="src/survey/data/rbl-loma-2026-lagos-planning-context.json" \
  --city="Lagos" \
  --objective="broad_reach"

pnpm survey:publish-context \
  --snapshot="/secure/derived/rbl-loma-2026-context.json" \
  --out="src/survey/data/rbl-loma-2026-lagos-influential-core-context.json" \
  --city="Lagos" \
  --objective="influential_core"

pnpm survey:publish-context \
  --snapshot="/secure/derived/rbl-loma-2026-context.json" \
  --out="src/survey/data/rbl-loma-2026-lagos-near-conversion-context.json" \
  --city="Lagos" \
  --objective="near_conversion"
```

The publisher independently verifies the aggregate snapshot digest before selecting
the most specific eligible facet. Each `consumer-survey-planning-context-v2`
artifact binds its objective, exactly three signals, Lagos sample size, collection
period, source snapshot digest, independent publication digest and unchanged
`context_only` claim boundary. Respondent records and the full aggregate matrix are
not shipped to the client.

The Step 3 planning-context strip and exploration drawer may explain these findings,
but must not change package selection, delivery estimates, evidence grade, Planning
Fit, movement, OTS, reach, frequency, influence, target share or calibration.
