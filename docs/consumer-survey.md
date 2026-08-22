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

## Product integration

`selectSurveyContextSignals()` remains the general-purpose bounded selector for a
transparent facet query. `selectSurveyObjectiveContextProfile()` applies a separately
versioned presentation policy for the three planner objectives:

- **Broad reach:** recent recall, the leading visibility environment, and the
  hardest-to-ignore format;
- **Priority audience:** perceived format trust, personal relevance, and the leading
  creative memorability cue;
- **Likely customers:** perceived format effect and the strongest available
  self-reported actions after noticing OOH.

Each profile emits no more than three independent facts. The campaign objective only
selects which approved facts are presented; it does not alter package calculation,
ordering, delivery, Planning Fit, or evidence grade. Signals retain source period,
sample size, selected scope, applicable question denominator, evidence state and claim
boundary. They are not a composite opportunity or confidence score.

## Published planning-context projection

The full aggregate snapshot is an offline governed derivative and is not bundled into
the browser. Publish the bounded Lagos product projection from a verified snapshot:

```bash
pnpm survey:publish-context \
  --snapshot="/secure/derived/rbl-loma-2026-context.json" \
  --out="src/survey/data/rbl-loma-2026-lagos-planning-context.json" \
  --city="Lagos"
```

The publisher independently verifies the aggregate snapshot digest before selecting
the most specific eligible facet. The checked-in `consumer-survey-planning-context-v2`
artifact contains one deterministic profile for each planner objective, with exactly
three signals per profile, plus the shared Lagos sample size and collection period,
source snapshot digest, independent publication digest, and unchanged `context_only`
claim boundary. Respondent records and the full aggregate matrix are not shipped to
the client.

The Step 3 strip selects the profile from the already-calculated campaign objective.
The drawer explains that selection policy and applicable denominators. Neither surface
may change package selection or ordering, delivery estimates, evidence grade, Planning
Fit, movement, OTS, reach, frequency, influence, target share, or calibration.

The current Lagos publication is bound to:

- aggregate snapshot digest: `c0644a87d54060b71963f7b9cedaf994efec3828a62400d5c4c92340ea1b64fa`;
- objective-aware publication digest: `795e392c77ef8ece87e4ff3ff35dfbce478ca483def211ec5ba3a47d8497e928`;
- Lagos sample: `204` respondents;
- profile cardinality: exactly `3` signals for each of `broad_reach`,
  `influential_core`, and `near_conversion`.
