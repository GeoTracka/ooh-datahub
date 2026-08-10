# Overture Vector Context (E2A)

E2A adds **destination-presence** and **road-network prominence** context around reviewed T3 site coordinates. It deliberately does not create observed traffic, visitation, footfall, OTS, reach or Planning Fit.

## Runtime boundary

E2A requires PostgreSQL with PostGIS and pgcrypto extensions. CI uses the official PostGIS PostgreSQL 16 image.

PostGIS is used because the context calculations need indexed meter-based point/line distance and radius operations. Application code does not approximate road distance in degrees.

## Inputs

E2A consumes two retained reductions from the **same explicit Overture release and bbox**:

1. Places (`theme=places/type=place`)
2. road Transportation segments (`theme=transportation/type=segment`, `subtype=road`)

A derivation fails closed when the two artifacts do not share a release and bbox.

The reducer never resolves a floating `latest` release. Example:

```bash
pnpm enrichment:reduce:overture -- \
  2026-07-22.0 \
  3.20,6.35,3.75,6.75 \
  /secure/overture/places.geojson \
  /secure/overture/roads.geojson
```

The reducer uses DuckDB `spatial` + `httpfs` against the explicit Overture S3 release and retains:

### Places

- GERS/feature ID and version;
- primary name;
- `basic_category`;
- taxonomy;
- confidence;
- operating status;
- full `sources` array; and
- point geometry.

### Roads

- feature ID/version;
- name;
- road class/subclass;
- connectors;
- full `sources` array; and
- LineString geometry.

The reduced file itself is the OOH Datahub replay boundary. Its exact SHA-256, release, bbox, storage URI and transform version are retained. This avoids depending on old remote release shards remaining available indefinitely.

## Import

```bash
DATABASE_URL='postgresql://...' pnpm enrichment:import:overture -- \
  --kind=places \
  --input=/secure/overture/places.geojson \
  --release=2026-07-22.0 \
  --bbox=3.20,6.35,3.75,6.75 \
  --access-uri='s3://overturemaps-us-west-2/release/2026-07-22.0/theme=places/type=place/' \
  --storage-uri='s3://company-open-data/overture/2026-07-22.0/lagos/places.geojson'
```

and equivalently for `--kind=roads`.

The import keeps Overture `sources` on every normalized feature. Missing per-source license values are measured in the run audit rather than invented; artifact/theme attribution remains separately retained.

Normalized Overture place/road rows are immutable after import.

## Context derivation

```bash
DATABASE_URL='postgresql://...' pnpm data:derive:vector -- \
  --places-sha=<places-artifact-sha> \
  --roads-sha=<roads-artifact-sha> \
  --radii=250,500,1000
```

Default radii are 250 m, 500 m and 1,000 m. Radius inputs are bounded; this is not an unrestricted spatial-query endpoint.

The input fingerprint includes:

- exact Places artifact/release/license/metadata;
- exact Transportation artifact/release/license/metadata;
- every currently eligible confirmed-site MapLibre coordinate assertion and its evidence metadata;
- radii;
- high-confidence threshold;
- destination-status policy;
- major-road class policy; and
- coverage policy.

The resulting snapshot ID is deterministic for those exact governed inputs. Re-running the same input creates another successful audit run but reuses the same immutable context snapshot.

## Multiple approved coordinates

E2A does **not** select one preferred coordinate for a site.

Every approved `maplibre` coordinate assertion attached to a confirmed T3 site is evaluated independently. Outputs therefore include `coordinate_assertion_id`.

This prevents an enrichment calculation from silently selecting whichever coordinate produces the most attractive commercial context.

## Source coverage is not zero

A retained bbox may not fully cover a requested radius. Before counting Places or roads, E2A tests whether the full geodesic radius buffer is covered by that artifact's retained bbox.

Each site/coordinate/radius receives one coverage state:

- `full`
- `places_only`
- `roads_only`
- `uncovered`

Destination rows are emitted only when Places fully covers the radius. Network rows are emitted only when Transportation fully covers it.

Therefore:

> covered + no matching feature = valid zero

while:

> incomplete source coverage = missing context, never zero

This distinction is required for later Overture/Foursquare/GRID3 comparisons.

## Destination semantics

`site_destination_context` records:

- total place features in the covered radius;
- open-or-unknown operating count;
- high-confidence open-or-unknown count;
- temporarily closed count;
- permanently closed count;
- current basic-category counts;
- current taxonomy L0 counts; and
- Shannon taxonomy diversity.

The current destination mix uses only records whose operating status is `open` or unknown. Temporary/permanent closures remain separately visible as source/status evidence.

`high_confidence_count` uses a documented threshold of `0.7`. It is a source-quality/context threshold, **not a visitation probability**.

The database semantic label is:

```text
destination_presence_context_not_visitation
```

## Network semantics

`site_network_context` records:

- road segment count;
- major-road segment count;
- distinct connector count;
- road-class distribution;
- nearest road distance/class; and
- nearest major-road distance/class.

Major classes are explicitly:

```text
motorway, trunk, primary, secondary
```

These metrics describe road hierarchy/topology near a site. They do not claim observed traffic volume or traffic speed.

The database semantic label is:

```text
network_prominence_context_not_observed_traffic
```

## Why connectors are retained

Overture connectors model physical decision/transition points between Transportation segments. E2A uses distinct connector counts only as a local network-complexity proxy. It does not interpret a connector as an observed intersection traffic count.

## Database tables

Raw normalized context inputs:

- `overture_place_features`
- `overture_road_segments`

Governed context runs/snapshots:

- `site_vector_context_runs`
- `site_vector_context_snapshots`
- `site_vector_context_coverage`
- `site_destination_context`
- `site_network_context`
- `site_vector_context_latest`

Every row remains `decision_use='context_only'`.

## Verification

`pnpm test:data-vector-context` runs against a real PostGIS database and proves:

- PostGIS migrations are installed;
- Overture feature/source provenance survives import;
- replay does not duplicate raw features;
- normalized Overture rows are immutable;
- one site can retain multiple approved coordinate assertions;
- covered 250/500/1,000 m radii produce different destination/network context;
- an edge coordinate becomes `uncovered` rather than generating false zeros;
- permanently/temporarily closed Places remain separate from current destination mix;
- road hierarchy and nearest-major-road context remain distinct from traffic claims;
- deterministic snapshot replay; and
- all derived rows remain context-only.

## Next: E2B

The next context mode is **not another radius layer**. GRID3 Nigeria population, settlement and travel-time friction should add separately versioned:

- resident population catchments;
- 5/10/15-minute modelled accessibility;
- settlement core/fringe/morphology; and
- later destination counts inside travel-time catchments.

`euclidean_radius`, `friction_time`, `road_network_time` and any future `transit_network_time` must remain separate modes with separate assumptions/provenance.

No E2 mode closes the independent T5 field-calibration requirements.
