# Canonical Entity and Spatial Resolution

T3 sits between immutable source observations and later planner-context derivation:

```text
reviewed XLSX
  -> deterministic normalization staging
  -> PostgreSQL immutable source-revision observations
  -> T3 canonical aliases / identity assertions / spatial evidence
  -> T4 governed context features
  -> only later, calibrated planner inputs
```

T3 **never rewrites the T2 OOH or FAAN observation tables** and does not raise an evidence grade.

## Commands

After the T2 data has been persisted:

```bash
DATABASE_URL='postgresql://...' pnpm data:resolve
```

This rebuilds resolver-versioned canonical vocabularies, candidate site identities and airport mappings from immutable observations.

Evidence-backed decisions/coordinates/owners are imported with NDJSON:

```bash
DATABASE_URL='postgresql://...' \
pnpm data:assert -- --input=/secure/reviewed-assertions.ndjson
```

## Resolver version

The automatic contract is pinned by `ENTITY_RESOLVER_VERSION` in `src/dataResolution/normalize.ts`.

Automatic normalization is intentionally conservative:

1. Unicode NFKC normalization;
2. trim/collapse whitespace;
3. locale-stable lowercase;
4. punctuation/symbol separators become spaces; and
5. repeated spaces collapse.

There is **no edit-distance, embedding, phonetic or semantic auto-merge**. For example punctuation/case variants may share a normalized key, while genuinely different spellings remain different entities unless reviewed.

A resolver algorithm change must use a new resolver version. Old mappings remain auditable.

## Canonical vocabulary

T3 creates canonical entities and source aliases for:

- advertiser;
- brand;
- category;
- format;
- state; and
- city.

Every exact source literal is retained in `canonical_entity_aliases` with its normalized key, mapping method, observation count and observed year range.

The immutable source fact retains the original text. Canonical entities are a query layer, not a destructive cleanup operation.

## Candidate OOH site identity

Automatic site grouping is deliberately stricter than vocabulary normalization. A candidate site key requires all of:

```text
normalized state
+ normalized city
+ normalized address
+ normalized board type
+ normalized format
```

The resulting `site_id` is stable for the resolver version.

This is an **identity assertion**, not proof that two billboard faces are physically identical. Multiple observations can point to the same candidate site without being deleted or collapsed. Rows missing a strict-key component, especially address, go to `resolution_review_items` rather than being guessed.

Automatic candidates start with `identity_status = candidate`. They can be confirmed/rejected only by an evidence-backed `site_identity` assertion.

## Media owner / supplier identity

The reviewed historical placement data does not contain a consistently authoritative media-owner field. T3 therefore does **not** infer owner identity from advertiser text or the board-quality `company` field.

`site_media_owner_status` exposes `Unknown` until an authoritative assertion is imported.

Example:

```json
{"kind":"media_owner","siteId":"site:...","ownerName":"Verified Media Ltd.","registryNamespace":"approved-ooh-registry","registryRevision":"2026-08","evidenceSourceId":"registry:row-42","evidenceRevision":"r3","mappingMethod":"authoritative_registry","assertionStatus":"approved"}
```

Owner identities and aliases retain registry/evidence revisions.

## Airport identity

FAAN flow rows generally contain an airport name/state label, while cargo/mail rows may contain only an airport/state-like label.

Automatic resolution uses two safe paths:

1. exact normalized airport-name equivalence; and
2. a **unique state anchor** only where a normalized state label maps to exactly one named airport in the persisted FAAN observations.

If a state maps to multiple normalized airport names, the resolver does not guess which spelling/name is correct. It creates `state_anchor_ambiguous` review work.

A reviewed typo/name variant can be mapped with an airport override:

```json
{"kind":"airport_override","sourceLiteral":"Source spelling exactly as reviewed","targetAirportId":"airport:...","evidenceSourceId":"airport-review:17","evidenceRevision":"r2"}
```

Manual overrides carry evidence and update matching FAAN airport assertions without deleting the original FAAN label.

## Spatial assertions and rights

Coordinates are separate evidence assertions attached to a site identity.

Every coordinate stores:

- latitude / longitude;
- declared accuracy;
- source kind and source ID;
- source artifact ID;
- spatial-rights state;
- license/attestation ID where required;
- assertion status;
- renderer eligibility; and
- enrichment revision.

All T3 coordinates are `planning_use = context_only`.

### Approved MapLibre coordinates

`customer_captured` and `open_licensed` coordinates may be approved for MapLibre only when they have:

- declared coordinate accuracy;
- source artifact ID; and
- spatial license/attestation ID.

### Provider-derived coordinates

Approved `provider_derived` coordinates are `provider_only`, never silently promoted to MapLibre rights. They still require declared accuracy and a source artifact/record identity.

### Unknown rights

`unknown` spatial rights cannot be approved. Pending/rejected/revoked assertions are renderer-ineligible.

These constraints are enforced both before insertion and by PostgreSQL checks.

Example approved customer/field coordinate:

```json
{"kind":"coordinate","siteId":"site:...","latitude":6.6018,"longitude":3.3515,"coordinateAccuracyM":4,"sourceKind":"field_survey","coordinateSourceId":"survey:site-1","sourceArtifactId":"survey-file:site-1","spatialRights":"customer_captured","spatialLicenseId":"attestation:site-1","assertionStatus":"approved","enrichmentRevision":"survey-r1"}
```

## Spatial enrichment queue

`ooh_data.site_spatial_enrichment_queue` is a work queue, not an automatic geocoder.

A site remains queued when:

- its site identity is not confirmed; or
- it is confirmed but has no approved coordinate assertion.

T3 does not call a paid provider during rebuild. Live Google geocoding remains behind the existing grant/quota/provider policy and must be explicitly reviewed before a returned coordinate is asserted here.

## Audit and replay

Every automatic rebuild creates a `resolution_runs` record with `run_kind = rebuild` and the pinned resolver version. The mapping write is transactional: failure rolls the resolver data transaction back and records a failed run.

Every evidence assertion import creates `run_kind = assertion_import`.

Re-running the same resolver version is idempotent. Manual site statuses, owner evidence and coordinate assertions are not reset by an automatic rebuild.

## Review semantics

`resolution_review_items` is first-class data. Open review work includes things such as:

- OOH observations missing a strict site key;
- unresolved airport labels; and
- ambiguous airport state anchors.

A review item is preferable to a false merge. Automation may update audit metadata on a repeated rebuild, but must not silently reopen a reviewer-resolved/dismissed item.

## T4 boundary

T4 can consume **resolved/context-safe** identities to derive historical benchmarks and context features. It must still:

- use active/superseded source semantics correctly;
- retain source/revision lineage;
- treat coordinate rights and renderer eligibility explicitly; and
- label derived features `context_only` until a separate calibration/evidence contract permits stronger use.
