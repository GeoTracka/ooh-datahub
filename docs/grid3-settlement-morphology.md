# GRID3 settlement morphology context

E2B2 adds settlement-fabric context around reviewed OOH site coordinates. It is deliberately independent from E2A destination/network context and E2B1 resident-population/accessibility context.

All outputs are `decision_use='context_only'`. They are not land-use truth, traffic, footfall, OTS, reach, influence, availability or Planning Fit.

## Product boundary

The current governed contract targets **GRID3 NGA – Settlement Extents v4.1 (August 2026)**.

Do not assume that an attribute name from an older GRID3 settlement release has the same meaning in v4.1. The importer inspects the landed vector schema and normalizes optional attributes only through an explicit field map.

The repository does not hard-code a v4.1 license from another GRID3 product or older release. Production registration requires the exact release-specific license ID, attribution, share-alike status, review date/reference and commercial-use approval to be supplied from reviewed source evidence.

The generic source-registry entry is intentionally not production enabled. The dedicated v4.1 importer is the only supported production path because it requires exact release-specific licensing and coverage evidence.

## Exact source coverage is separate evidence

Settlement feature bounds are **not** product coverage. The outermost polygon only says where settlement features exist; it cannot prove that an empty location was actually evaluated by the source product.

A latitude/longitude bounding box is also insufficient for a national product because it can include territory outside the actual product geography. E2B2 therefore requires a retained WGS84 Polygon or MultiPolygon coverage mask:

- `--coverage-geojson=/retained/evidence/nga-settlement-coverage.geojson`
- `--coverage-storage-uri=<immutable retained URI for those exact bytes>`
- `--coverage-reference=<reviewed source/reduction evidence>`

The coverage record stores:

- exact canonical geometry fingerprint;
- SHA-256 of the retained coverage-evidence file;
- evidence reference;
- retained storage URI;
- valid immutable `MultiPolygon,4326` geometry.

Import fails atomically if any normalized settlement feature lies outside the declared coverage geometry. Failed coverage validation leaves no normalized settlement feature or coverage rows behind; only the landed artifact/run audit may remain.

A site-radius row is `complete` only when its **entire geodesic radius buffer** is covered by the exact retained coverage geometry. Otherwise it is `partial_source_coverage`. An empty settlement intersection can therefore mean zero only inside reviewed source coverage; missing coverage never becomes rural/suburban evidence.

## Explicit source-field map

A field-map JSON may map only these semantics:

```json
{
  "featureId": "settlement_id",
  "buildingCount": "building_count",
  "buildingDensity": "building_density",
  "degreeUrbanisation": "degree_urbanisation",
  "populationEstimate": "population_estimate",
  "falsePositiveProbability": "false_positive_probability",
  "placeCode": "place_code"
}
```

`featureId` may be `$fid` when the source feature ID itself is the reviewed identity.

Every mapped source field must exist in the inspected layer schema. Unknown map keys, duplicate source-column mappings and invalid mapped values fail closed. Unmapped source properties remain preserved in `raw_properties` rather than being guessed into semantics.

The normalized field map and its SHA-256 fingerprint are part of the artifact metadata and context-snapshot fingerprint.

## Geometry handling

The Python worker uses GDAL/OGR and streams records; the national vector source is not buffered wholesale in Node or expanded through an application ORM.

Accepted source geometry is polygonal. Invalid geometry may be repaired only by the pinned policy:

`ogr_make_valid_then_polygonal_only_v1`

The importer records whether the original geometry was valid and whether repair occurred. Non-polygonal results or failed repairs are rejected. Settlement morphology is explicitly 2D horizontal context; source Z/M dimensions are discarded before durable storage rather than silently widening the geometry contract.

Raw source properties and immutable source bytes remain auditable.

## Atomic source import

The raw artifact registration is separate from normalization. Once a normalization run starts, these operations commit together:

1. exact coverage geometry validation;
2. source-feature count and duplicate-ID validation;
3. proof that every normalized feature lies within coverage;
4. coverage-row insertion/replay check;
5. normalized source-feature insertion/replay check;
6. successful enrichment-run status + counts.

Any failure rolls back coverage and normalized features, then records the enrichment run as failed. This prevents durable normalized facts from pointing to an import that never became successful.

## Derived morphology

For every eligible confirmed site coordinate and each configured radius (default 250/500/1000 m), E2B2 derives separately interpretable facts.

### Point/containing-settlement context

- whether the coordinate is inside a settlement extent;
- number of containing extents;
- deterministic primary extent: smallest containing area, then feature ID;
- nearest settlement distance when outside;
- `core_depth_m`: geodesic distance from an inside coordinate to its primary settlement boundary;
- primary settlement area and perimeter;
- primary compactness `4πA/P²`;
- explicitly mapped optional source attributes for the primary extent.

Overlapping containing extents are never resolved by choosing the most attractive classification or metric.

### Radius morphology

- buffer area;
- unioned settlement area inside the radius;
- settled-area share;
- positive-area intersecting **source extent** count (provenance/overlap diagnostic);
- connected settlement-component count after union;
- connected-component density per km²;
- largest connected-component area/share.

Polygon intersections are unioned before area calculation so overlapping source extents cannot double-count settled area. Boundary-only line/point touches do not count as settled patches.

The hard semantic label is:

`settlement_morphology_context_not_land_use_or_audience`

## Registration

Example using a reviewed retained vector artifact and exact retained coverage evidence:

```bash
DATABASE_URL=postgresql://... pnpm enrichment:import:grid3-settlement -- \
  --input=/data/grid3/nga-settlement-extents-v4.1.gpkg \
  --layer=<reviewed-layer-name> \
  --release=2026-08-v4.1 \
  --access-uri=<source-or-retention-uri> \
  --storage-uri=<immutable-retained-uri> \
  --coverage-geojson=/data/grid3/nga-settlement-v4.1-coverage.geojson \
  --coverage-storage-uri=<immutable-coverage-retained-uri> \
  --coverage-reference=<reviewed-coverage-evidence> \
  --license-id=<exact-v4.1-license> \
  --attribution=<exact-v4.1-attribution> \
  --share-alike=<true|false> \
  --license-reviewed-at=<YYYY-MM-DD> \
  --license-review-reference=<review-record> \
  --limitations=<operational-limitations> \
  --field-map=/data/grid3/v4.1-field-map.json
```

Registration streams SHA-256 over the actual source bytes and the retained coverage-evidence bytes, inspects the actual vector layer, validates the explicit field map, and imports source polygons through PostgreSQL COPY.

Identical artifact/coverage/source-feature replay is allowed only when the normalized evidence is identical. Same governed identity with changed output fails as replay drift.

## Derivation

```bash
DATABASE_URL=postgresql://... pnpm data:derive:settlement -- \
  --settlement-sha=<registered-artifact-sha256> \
  --radii=250,500,1000
```

The snapshot fingerprint binds:

- exact settlement artifact SHA/release/license/metadata;
- exact coverage-geometry fingerprint + evidence SHA/reference/retained URI;
- field map and fingerprint;
- all eligible coordinate assertions and their evidence metadata;
- radii;
- algorithm policies/version.

Identical governed inputs reuse one immutable snapshot while each execution retains a separate run audit. Recomputed rows that differ for the same snapshot key fail as drift.

## Incremental-value acceptance

The integration fixture intentionally gives two sites the same E2B1 500 m resident population and the same 5-minute walking-accessible population. It then gives them materially different settlement fabric:

- one site deep inside one large dense extent;
- one site inside a small patch surrounded by multiple fragmented patches.

E2B2 passes only if the morphology layer distinguishes them using interpretable outputs such as core depth, settled-area share and connected-component count. This prevents morphology from becoming a redundant proxy for population/accessibility.

The fixture also first attempts an import with an undersized coverage polygon and requires:

- import failure;
- a failed run audit;
- zero normalized settlement rows;
- zero coverage rows.

It then imports the valid exact coverage evidence and proves replay idempotency.

## Production-calibration boundary

E2B2 does not close #41. No settlement geometry, building statistic or classification becomes Evidence-C movement/exposure/downstream truth without separate independent calibration evidence and promotion through the production measurement gate.
