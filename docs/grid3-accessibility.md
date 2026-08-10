# GRID3 Resident Population + Accessibility (E2B1)

E2B1 adds Nigeria-specific **resident population** and **modelled physical accessibility** context around reviewed OOH site coordinates.

It is intentionally narrow and high-impact:

- resident population in audit radii;
- 5/10/15-minute walking-accessible population; and
- 5/10/15-minute mixed motorized/walking-accessible population.

All outputs are `decision_use='context_only'`.

They are **not** observed journeys, traffic, footfall, OTS, reach, target reach, influence or Planning Fit.

## Reviewed source contracts

E2B1 expects three separately retained GeoTIFF artifacts.

### Population

- source ID: `grid3-nigeria-population`
- role: `population`
- reviewed product: GRID3 / WorldPop Nigeria Population v3.0
- release family: August 2025
- CRS: EPSG:4326
- approximate grid: 3 arc-seconds / ~100 m
- values: modelled fractional population counts per source cell
- reviewed license: CC BY 4.0

The product is an operational model, not official government population statistics. Fractional source values are preserved.

### Walking friction

- source ID: `grid3-nigeria-friction`
- role: `walking_friction`
- reviewed product: GRID3 Nigeria Travel Time Friction Surface v1.0
- release family: October 2025
- CRS: EPSG:32632 / UTM zone 32N
- approximate grid: 30 m
- units: minutes per meter
- reviewed license: CC BY-SA 4.0

### Mixed friction

- source ID: `grid3-nigeria-friction`
- role: `mixed_friction`
- same product/version/CRS/grid/unit/license as walking;
- distinct artifact bytes from the walking surface.

Walking and mixed rasters must have the same deterministic grid signature. A shifted, resampled or otherwise differently aligned surface is rejected rather than silently combined.

Every actual production artifact is still pinned independently by SHA-256 and exact retained metadata. A later GRID3 release is not automatically treated as v3.0/v1.0 merely because it comes from the same publisher.

## Architecture

```text
retained population GeoTIFF ─┐
retained walking GeoTIFF ────┼─> GDAL/NumPy offline worker
retained mixed GeoTIFF ──────┘          │
                                        ├─ radius population context
reviewed T3 coordinates ────────────────┼─ walking least-cost population
                                        └─ mixed least-cost population
                                                 │
                                                 v
                                    immutable PostgreSQL snapshots
```

PostGIS remains the vector engine. E2B1 does **not** load the national 30 m friction surface into PostGIS Raster or expand it into relational rows.

GDAL/NumPy are data-processing dependencies only; they are not web-app/browser runtime dependencies.

## Registering raster artifacts

Registration inspects the actual bytes before they can participate in a snapshot.

Example population registration:

```bash
DATABASE_URL='postgresql://...' \
  pnpm enrichment:register:grid3-raster -- \
  --role=population \
  --input=/secure/grid3/nga_population_v3.tif \
  --release=2025-08-v3.0 \
  --access-uri='https://<reviewed-source-location>' \
  --storage-uri='s3://company-open-data/grid3/population/<sha>/nga.tif'
```

Walking and mixed are registered separately:

```bash
DATABASE_URL='postgresql://...' \
  pnpm enrichment:register:grid3-raster -- \
  --role=walking_friction \
  --input=/secure/grid3/nga_friction_walking_v1.tif \
  --release=2025-10-v1.0 \
  --access-uri='https://<reviewed-source-location>' \
  --storage-uri='s3://company-open-data/grid3/friction/<sha>/walking.tif'

DATABASE_URL='postgresql://...' \
  pnpm enrichment:register:grid3-raster -- \
  --role=mixed_friction \
  --input=/secure/grid3/nga_friction_mixed_v1.tif \
  --release=2025-10-v1.0 \
  --access-uri='https://<reviewed-source-location>' \
  --storage-uri='s3://company-open-data/grid3/friction/<sha>/mixed.tif'
```

Registration records:

- SHA-256 and byte size;
- exact release/access/storage metadata;
- product role/version/citation/limitations;
- license/commercial-use policy;
- CRS/EPSG;
- raster dimensions and data type;
- geotransform and pixel size;
- explicit NoData value;
- native and WGS84 extent; and
- deterministic raster grid signature.

Raster metadata drift for the same source/hash fails closed.

## Deriving site accessibility

```bash
DATABASE_URL='postgresql://...' \
  pnpm data:derive:accessibility -- \
  --population=/secure/grid3/nga_population_v3.tif \
  --walking=/secure/grid3/nga_friction_walking_v1.tif \
  --mixed=/secure/grid3/nga_friction_mixed_v1.tif \
  --population-sha=<registered-population-sha> \
  --walking-sha=<registered-walking-sha> \
  --mixed-sha=<registered-mixed-sha> \
  --radii=250,500,1000 \
  --thresholds=5,10,15 \
  --max-search-radius-m=30000
```

The local files are re-hashed before calculation. A local path whose bytes no longer match the registered artifact is rejected.

Every confirmed T3 site coordinate that is:

- `assertion_status='approved'`;
- `renderer_eligibility='maplibre'`; and
- `planning_use='context_only'`

is evaluated independently. The enrichment layer does not choose a preferred coordinate based on which one produces a stronger result.

## Radius population semantics

`site_population_radius_context` is an audit/reference mode, not the primary accessibility model.

For each requested radius, E2B1:

1. keeps the original population raster grid;
2. calculates the WGS84 cell-center distance to the site;
3. includes the full original fractional population cell when its **cell center** lies inside the radius; and
4. records candidate, valid and NoData population-cell counts.

The semantic label is:

```text
resident_population_model_context
```

This policy deliberately avoids claiming sub-cell population precision that the source raster does not provide.

## Friction-time semantics

Travel-time accessibility is computed on the projected friction grid, not in longitude/latitude degrees.

### Least-cost traversal

The worker uses bounded 8-neighbour Dijkstra traversal.

For each edge:

```text
edge_minutes =
  mean(current_friction_min_per_m, neighbour_friction_min_per_m)
  × projected_cell_center_distance_m
```

Orthogonal and diagonal center distances are therefore distinct and deterministic.

Walking and mixed friction are calculated independently.

### Mapping to population

The resulting travel-time surface is nearest-resampled to population **cell centers**. A population cell's complete fractional value is included when the mapped travel time is at or below the requested threshold.

The stored worker settings explicitly fingerprint these policies:

- `8_neighbor`;
- arithmetic-mean endpoint friction edge cost;
- population-cell-center radius inclusion;
- nearest-neighbour travel-time mapping to population cell centers; and
- full fractional source-cell aggregation.

Changing any of those assumptions requires a new algorithm/version fingerprint rather than silently changing old outputs.

The accessibility semantic label is:

```text
friction_accessible_population_context_not_observed_travel
```

## Coverage and failure policy

Missing coverage is never converted to a low population estimate.

E2B1 records:

- source/raster extent coverage;
- valid vs NoData population cells;
- population cells with unavailable friction context;
- reached friction-cell counts;
- source-boundary contact; and
- maximum reached travel time.

`coverage_status` is either:

- `complete`; or
- `partial_source_coverage`.

If the configured local search window itself is reached before the requested travel-time frontier is exhausted, `searchTruncated=true`. Such output is rejected before durable insertion. Increase `--max-search-radius-m` rather than treating truncated accessibility as a valid estimate.

The hard supported maximum is 50 km.

## Database boundary

Governed outputs:

- `site_raster_context_runs`
- `site_raster_context_snapshots`
- `site_population_radius_context`
- `site_accessible_population_context`
- `site_raster_context_latest`
- `site_accessible_population_latest`

Snapshot creation is database-guarded. The database independently requires:

- correct GRID3 source IDs and roles;
- reviewed product versions (`population v3.0`, `friction v1.0`);
- expected inspection worker version;
- `CC-BY-4.0` population licensing;
- `CC-BY-SA-4.0` friction licensing;
- `commercial_use_status='permitted'`; and
- identical walking/mixed grid signatures.

Derived snapshots and result rows are immutable.

## Deterministic snapshot identity

The fingerprint binds:

- exact population/walking/mixed artifact hashes, releases, licenses and raster metadata;
- all eligible coordinate assertions and their evidence metadata;
- radii;
- travel-time thresholds;
- maximum search radius;
- worker settings/version; and
- context algorithm version.

Re-running identical governed inputs produces another run audit but reuses the same immutable snapshot.

## Verification

`pnpm test:data-accessibility` creates tiny synthetic real GeoTIFFs and proves, using GDAL + PostgreSQL/PostGIS, that:

- raster registration and snapshot replay are idempotent;
- fractional population is retained;
- Euclidean radius population and least-cost accessibility differ;
- walking and mixed travel-time context can materially differ;
- NoData remains explicit;
- source-edge coverage becomes partial rather than false zero;
- a half-cell-shifted friction raster is rejected; and
- failed derivations remain audited.

Deterministic CI does not download production GRID3 data.

## Current scope boundary

E2B1 deliberately excludes:

- GRID3 Settlement Extents v4.1 morphology/admin context;
- Foursquare OS Places;
- VIIRS nightlights;
- transit/GTFS;
- field movement counts;
- observed footfall/traffic; and
- Evidence-C promotion.

Settlement morphology is the next high-value enrichment tranche only after this accessibility core is stable. Production measurement promotion remains governed separately by the T5 calibration evidence gate.
