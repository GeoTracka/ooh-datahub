# Governed site-context read model (E3)

E3 is the consumption boundary for the context families already landed in E2A, E2B1 and E2B2. It does **not** add a new data source and it does not turn contextual proxies into calibrated audience measurement.

## Why this layer exists

The family-specific `*_latest` views originally selected the newest row independently for each radius. If a later derivation intentionally used a smaller radius set, an older radius could remain visible beside the new rows. That produced a result that looked current but mixed snapshot generations and therefore mixed provenance.

Migration `026_site_context_read_model.sql` changes `latest` to mean **one coherent snapshot head per site + coordinate assertion + family**. Every radius/threshold returned for that family now comes from that one snapshot.

The migration also prevents spatial evidence (point, accuracy, source/license lineage and enrichment revision) from being rewritten after any governed context row references that assertion. Approval/revocation state can still change. Corrected coordinates require a new assertion ID.

## Read surface

`ooh_data.site_context_latest` returns one row per site + coordinate assertion. It never silently picks one approved coordinate when a site has several.

The row contains:

- current coordinate governance state plus source/rights evidence;
- E2A vector snapshot ID, algorithm/input fingerprint, exact Overture artifact identities, and radius-ordered destination/network context;
- E2B1 raster snapshot ID, algorithm/input fingerprint, exact GRID3 population/friction artifact identities, radius population context, and walking/mixed accessibility context;
- E2B2 settlement snapshot ID, algorithm/input fingerprint, exact settlement artifact identity/field-map fingerprint, and radius-ordered morphology context;
- explicit `*_missing_reason` values instead of converting missing context to zero;
- `decision_use='context_only'`.

A family can therefore be absent while the other families remain usable. Partial source coverage stays on the individual context row; it is not re-labelled as a zero observation.

### Current eligibility versus history

If a coordinate assertion was used historically and is later revoked, its derived context remains auditable in `site_context_latest`, but:

- `coordinate_currently_eligible=false`;
- every family `*_missing_reason` becomes `coordinate_not_currently_eligible`;
- the corrected family-specific `*_latest` views no longer surface that assertion as current planning context.

This preserves evidence history without allowing revoked coordinates to continue acting like current evidence.

## Comparison semantics

`src/enrichment/siteContext.ts` is the narrow typed application/planner contract. It retains coordinate evidence plus exact family snapshot/input/artifact provenance instead of leaking source-specific raw rows into application code. `compareSiteContext()` emits only factual contrasts from mutually source-covered facts and is versioned separately from the SQL read model.

The comparison layer deliberately has **no winner, score, rank bonus or recommendation field**. It can say that one site has higher resident-population context while another has more destination presence, for example, without resolving that disagreement into a universal score.

The current “similar” wording uses an explicit 5% relative tolerance (`site-context-comparison-v1`). That threshold is descriptive only; it is not a calibrated performance threshold.

If a coordinate is not currently eligible, or a family is not derived, the comparison is marked incomplete. Partial-coverage rows are not used to manufacture a favourable contrast.

## Query pattern

Use one bounded query for the requested site set:

```sql
SELECT *
FROM ooh_data.site_context_latest
WHERE site_id = ANY($1::text[])
ORDER BY site_id, coordinate_assertion_id;
```

Do not query each context family per site. E3 intentionally adds **no speculative indexes or materialization**: existing primary/FK indexes remain the baseline, and production query plans/cardinality should justify any later read-optimization index.

## Evidence boundary

E3 remains Evidence-D/contextual support:

- destination presence is not visitation;
- road/network prominence is not observed traffic;
- resident population is not OTS or reach;
- friction accessibility is not observed travel;
- settlement morphology is not land-use truth or audience exposure;
- no context family closes the production calibration gate in issue #41.

Any future ranking/composition policy must be separately versioned and tested for explicit trade-offs. Any movement/OTS/reach/influence or Planning Fit promotion still requires the governed calibration evidence package.
