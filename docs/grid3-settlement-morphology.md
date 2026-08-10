# GRID3 settlement morphology context

E2B2 adds settlement-fabric context around reviewed OOH site coordinates. It is deliberately independent from E2A destination/network context and E2B1 resident-population/accessibility context.

All outputs are `decision_use='context_only'`. They are not land-use truth, traffic, footfall, OTS, reach, influence, availability or Planning Fit.

## Product boundary

The current governed contract targets **GRID3 NGA – Settlement Extents v4.1 (August 2026)**.

Do not assume that an attribute name from an older GRID3 settlement release has the same meaning in v4.1. The importer inspects the landed vector schema and normalizes optional attributes only through an explicit field map.

The repository does not hard-code a v4.1 license from another GRID3 product or older release. Production registration requires the exact release-specific license ID, attribution, share-alike status, review date/reference and commercial-use approval to be supplied from reviewed source evidence.

## Why feature bounds are not coverage

The outer extent of settlement polygons only says where settlement features exist. It does **not** prove that an empty area outside those features was absent from the source survey/product.

Therefore registration requires a separate declared coverage envelope:

- `--coverage-bbox=minLon,minLat,maxLon,maxLat`
- `--coverage-reference=<reviewed source/reduction evidence>`

The importer verifies that the declared envelope contains the inspected feature bounds and stores both separately:

- `featureBoundsWgs84` — diagnostic bounds of source features;
- `coverageBoundsWgs84` — reviewed retained-source coverage used for complete/partial context semantics.

A site-radius row is `complete` only when its full radius buffer is inside the declared coverage bbox. Otherwise it is `partial_source_coverage`; an empty intersection is never silently interpreted as a rural/unsettled zero outside known coverage.

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

The importer records whether the original geometry was valid and whether repair occurred. Non-polygonal results or failed repairs are rejected. Raw source properties and immutable artifact bytes remain the audit boundary.

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
- positive-area intersecting settlement count;
- patch density per km²;
- largest settlement-intersection area;
- largest-patch share of settled area.

Polygon intersections are unioned before area calculation so overlapping source extents cannot double-count settled area. Boundary-only line/point touches do not count as settled patches.

The hard semantic label is:

`settlement_morphology_context_not_land_use_or_audience`

## Registration

Example using a reviewed retained vector artifact:

```bash
DATABASE_URL=postgresql://... pnpm enrichment:import:grid3-settlement -- \
  --input=/data/grid3/nga-settlement-extents-v4.1.gpkg \
  --layer=<reviewed-layer-name> \
  --release=2026-08-v4.1 \
  --access-uri=<source-or-retention-uri> \
  --storage-uri=<immutable-retained-uri> \
  --coverage-bbox=<minLon,minLat,maxLon,maxLat> \
  --coverage-reference=<reviewed-coverage-evidence> \
  --license-id=<exact-v4.1-license> \
  --attribution=<exact-v4.1-attribution> \
  --share-alike=<true|false> \
  --license-reviewed-at=<YYYY-MM-DD> \
  --license-review-reference=<review-record> \
  --limitations=<operational-limitations> \
  --field-map=/data/grid3/v4.1-field-map.json
```

Registration streams SHA-256 over the actual source bytes, inspects the actual vector layer, validates the field map and imports source polygons through PostgreSQL COPY.

Identical artifact replay is allowed only when normalized source rows are identical. Same artifact/feature identity with changed output fails as replay drift.

## Derivation

```bash
DATABASE_URL=postgresql://... pnpm data:derive:settlement -- \
  --settlement-sha=<registered-artifact-sha256> \
  --radii=250,500,1000
```

The snapshot fingerprint binds:

- exact settlement artifact SHA/release/license/metadata;
- declared source coverage and evidence reference;
- field map and fingerprint;
- all eligible coordinate assertions and their evidence metadata;
- radii;
- algorithm policies/version.

Identical governed inputs reuse one immutable snapshot while each execution retains a separate run audit. Recomputed rows that differ for the same snapshot key fail as drift.

## Incremental-value acceptance

The integration fixture intentionally gives two sites the same E2B1 500 m resident population and the same 5-minute walking-accessible population. It then gives them materially different settlement fabric:

- one site deep inside one large dense extent;
- one site inside a small patch surrounded by multiple fragmented patches.

E2B2 passes only if the morphology layer distinguishes them using interpretable outputs such as core depth, settled-area share and patch count. This prevents morphology from becoming a redundant proxy for population/accessibility.

## Production-calibration boundary

E2B2 does not close #41. No settlement geometry, building statistic or classification becomes Evidence-C movement/exposure/downstream truth without separate independent calibration evidence and promotion through the production measurement gate.
