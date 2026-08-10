# Open / Zero-Acquisition-Cost Data Enrichment

This is the governed enrichment layer above the merged T1–T4 data foundation.

```text
reviewed Drive observations
  -> T1 normalized staging
  -> T2 immutable PostgreSQL source revisions
  -> T3 canonical entities / reviewed spatial assertions
  -> T4 historical + FAAN context snapshots

open/public source artifact
  -> immutable landed artifact + exact license/release
  -> optional deterministic derived artifact
  -> source-specific normalization / candidate associations
  -> later site-context features

T4 + open context
  -> context-only planning intelligence
  -> T5 only after independent calibration evidence
```

The enrichment layer **does not create a magic score**. Road prominence, population, accessibility, destination mix, settlement morphology, night activity and inventory-candidate evidence remain separately interpretable signals with source lineage.

No open source in this document is, by itself, proof of billboard footfall, OTS, reach, target reach, influence or Planning Fit.

## Source registry

`src/enrichment/sourceRegistry.ts` is the executable source/license policy.

Every source records:

- acquisition mode;
- release-discovery policy;
- canonical access/documentation locations;
- license / attribution / share-alike policy;
- commercial-use review state;
- whether credentials are required;
- whether the source is production enabled; and
- the feature families it is allowed to inform.

`src/enrichment/artifactContract.ts` fails closed when:

- a source is research-only or not commercially reviewed;
- a mixed/product-specific source has not received an exact artifact-level license review; or
- feature-level licensed data such as Overture Places is normalized without preserving its feature source/license provenance.

The registry is policy, not a claim that the latest remote bytes are reviewed. Every actual artifact is still pinned by SHA-256 and source release.

## Priority stack

### 1. OurAirports — implemented adapter

OurAirports publishes nightly UTF-8 CSV data and releases the data to the Public Domain.

Primary use here:

- add coordinates to canonical FAAN airport references;
- ICAO/GPS, IATA and local codes;
- municipality / administrative reference;
- airport type;
- scheduled-service flag;
- elevation; and later
- runway/frequency reference data.

The first adapter imports Nigerian rows from `airports.csv` into `open_airport_references`.

An exact normalized-name match to a T3 airport creates only an `airport_open_reference_links.link_status='candidate'` association. It does **not** rewrite the original FAAN label or silently confirm airport identity.

Source documentation:

- https://ourairports.com/data/
- https://ourairports.com/help/data-dictionary.html

### 2. OpenStreetMap Nigeria / Geofabrik — implemented advertising-candidate adapter

The Nigeria Geofabrik PBF is a practical bulk source for OSM. It is licensed under ODbL through OpenStreetMap and is suitable for local `osmium` processing.

Do not use public Overpass infrastructure as the bulk production ingestion path.

Current advertising reduction includes objects matching:

```text
advertising=billboard
advertising=screen
advertising=board
advertising=totem
man_made=advertising
```

The adapter preserves arbitrary OSM tags while projecting common OOH clues such as:

- `operator` / `brand`;
- `ref`;
- `display_surface`;
- `orientation` / `direction`;
- `size` / `height`;
- `lit` / `luminous` / `animated`;
- `sides`;
- `visibility`; and
- `message`.

OSM records are **external inventory candidates**, not confirmed OOH inventory.

If a candidate is within 250 m of a confirmed T3 site whose approved coordinate is MapLibre/open-customer eligible, E1 may create an `approved_coordinate_proximity` candidate association. The association remains `candidate` and `context_only` and cannot infer media ownership or confirm site identity.

Source documentation:

- https://download.geofabrik.de/africa/nigeria.html
- https://wiki.openstreetmap.org/wiki/Tag:advertising%3Dbillboard
- https://www.openstreetmap.org/copyright
- https://docs.osmcode.org/osmium/latest/osmium-tags-filter.html
- https://docs.osmcode.org/osmium/latest/osmium-export.html

### 3. GRID3 Nigeria — next Nigeria-specific context adapters

Prefer Nigeria-specific GRID3 products where they provide a materially stronger local signal than generic global layers.

Planned independently auditable features include:

- resident population catchments;
- settlement/urban morphology;
- walking/mixed travel-time accessibility;
- road-network context;
- wards / administrative containment; and
- reviewed market/school/health anchors.

The important distinction is accessibility versus distance. A 1 km radius is not equivalent to a 10-minute catchment. GRID3 friction surfaces allow later features such as `mixed_accessible_population_15min` without pretending those modelled catchments are observed journeys.

Every GRID3 artifact must use the exact product/release license. Do not copy a license from one GRID3 layer onto another.

Source entry point:

- https://grid3.org/
- https://data.grid3.org/

### 4. Overture Maps — next vector-context adapters

Use Overture primarily for:

- Places / destination context;
- Transportation topology and network-prominence proxies;
- Buildings / built-form context;
- Divisions / administrative reconciliation; and
- stable entity identifiers where useful.

Do not collapse Transportation into “traffic.” Examples of allowed features are `nearest_major_road_m`, road class, connector degree, road density and junction density. These are network/topology proxies until independently calibrated against observed movement.

Overture Places is multi-source. Preserve each feature's `sources`/license lineage. Buildings and Transportation can carry ODbL obligations. Raw mixed-license data must not become one anonymous redistributable database.

Source documentation:

- https://docs.overturemaps.org/guides/places/
- https://docs.overturemaps.org/guides/transportation/
- https://docs.overturemaps.org/guides/buildings/
- https://docs.overturemaps.org/attribution/

### 5. WorldPop — demographic composition

Use high-resolution Nigeria population products as supplementary demographic context, especially age/sex composition. The exact product license must be pinned because some products that incorporate OSM-derived data may carry ODbL rather than plain CC BY.

Do not infer income/class from population density.

Source:

- https://www.worldpop.org/datacatalog/

### 6. VIIRS monthly nighttime lights — night/economic-intensity proxy

Potential features:

- median/mean radiance around a site;
- month-to-month night-activity context;
- radiance trend; and
- valid-observation coverage.

Always retain cloud-free observation coverage. A zero radiance value without valid observations is not proof of darkness. Monthly VIIRS is also not direct footfall.

Source documentation:

- https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG

### 7. Google Open Buildings Temporal — built form / growth

Potential features:

- building density;
- fractional building count;
- height distribution;
- built footprint intensity; and
- 2016–2023 growth trajectory.

These are morphology/growth signals, not occupancy truth.

Source documentation:

- https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1

### 8. Nigeria Federal Health Facility Registry — authoritative but access/terms gated

The national HFR is a high-value authoritative health-facility anchor, but API access requires a key and commercial reuse terms should be explicitly reviewed before enabling the source in production.

The source registry therefore keeps it disabled until that review is complete.

### Explicit research-only exclusion

Ookla open Speedtest tiles are useful for research/validation but carry a non-commercial Creative Commons license in the current open-data program. They must not become a required production signal for this commercial planner.

OpenCellID is likewise optional rather than foundational because practical API/download access has contribution/key conditions.

## Artifact model

### Immutable artifacts

`enrichment_artifacts` stores:

- `source_id`;
- exact SHA-256;
- source release;
- file name/type/byte size;
- original access URI;
- retained storage URI;
- retrieval timestamp;
- exact license/attribution;
- share-alike/commercial-use state; and
- source-specific metadata.

Artifact rows are immutable. A new remote revision becomes a new artifact hash, never an in-place edit.

### Derived artifacts

`enrichment_artifact_derivations` links child bytes to exact parent bytes plus:

- transform ID;
- transform version; and
- deterministic transform parameters.

For OSM advertising, this means:

```text
Geofabrik Nigeria PBF @ SHA A
  --osmium-advertising-reduction/v1-->
Advertising GeoJSONSeq @ SHA B
  -> normalized OSM advertising candidates
```

PostgreSQL rejects `osm-geofabrik-nigeria` advertising candidate rows whose child artifact has no registered `osmium-advertising-reduction` lineage.

## Commands

### Land a reviewed no-key source

The no-key downloader is intentionally host allow-listed and HTTPS-only.

```bash
pnpm enrichment:land -- \
  --source=ourairports-airports \
  --out-dir=/secure/ooh-open-data
```

Or:

```bash
pnpm enrichment:land -- \
  --source=osm-geofabrik-nigeria \
  --out-dir=/secure/ooh-open-data
```

It streams the response, computes SHA-256 without loading a large PBF into memory, retains response revision headers, and writes `artifact-manifest.json` beside the landed bytes.

The downloader does not run in deterministic CI.

### Register an immutable artifact

```bash
DATABASE_URL='postgresql://...' pnpm enrichment:register -- \
  --source=osm-geofabrik-nigeria \
  --input=/secure/ooh-open-data/osm-geofabrik-nigeria/<sha>/nigeria-latest.osm.pbf \
  --release='2026-08-10T00:00:00.000Z' \
  --access-uri='https://download.geofabrik.de/africa/nigeria-latest.osm.pbf' \
  --storage-uri='s3://company-open-data/osm/nigeria/<sha>/nigeria.osm.pbf' \
  --content-type='application/vnd.openstreetmap.data+pbf' \
  --artifact-kind=raw_pbf
```

Mixed/product-specific licenses use `--license-review-json=/secure/review.json`; registration fails closed without it.

### Reduce OSM advertising locally

```bash
pnpm enrichment:reduce:osm -- \
  /secure/ooh-open-data/.../nigeria-latest.osm.pbf \
  /secure/ooh-derived/nigeria-advertising.geojsonseq
```

The reducer uses:

1. `osmium tags-filter` to keep relevant advertising objects and required references; then
2. `osmium export --attributes=type,id --output-format=geojsonseq`.

Register the reduced child artifact, then bind it to the raw PBF:

```bash
DATABASE_URL='postgresql://...' pnpm enrichment:register -- \
  --source=osm-geofabrik-nigeria \
  --input=/secure/ooh-derived/nigeria-advertising.geojsonseq \
  --release='<same pinned OSM release>' \
  --access-uri='file:///secure/ooh-derived/nigeria-advertising.geojsonseq' \
  --storage-uri='s3://company-open-data/osm/derived/<child-sha>/nigeria-advertising.geojsonseq' \
  --content-type='application/geo+json-seq; charset=utf-8' \
  --artifact-kind=derived_osmium_advertising

DATABASE_URL='postgresql://...' pnpm enrichment:link -- \
  --child-source=osm-geofabrik-nigeria \
  --child-sha=<child-sha> \
  --parent-source=osm-geofabrik-nigeria \
  --parent-sha=<raw-pbf-sha> \
  --transform-id=osmium-advertising-reduction \
  --transform-version=v1
```

Only then import the child:

```bash
DATABASE_URL='postgresql://...' pnpm enrichment:import -- \
  --source=osm-geofabrik-nigeria \
  --input=/secure/ooh-derived/nigeria-advertising.geojsonseq \
  --release='<same pinned OSM release>' \
  --access-uri='file:///secure/ooh-derived/nigeria-advertising.geojsonseq' \
  --storage-uri='s3://company-open-data/osm/derived/<child-sha>/nigeria-advertising.geojsonseq'
```

### Import OurAirports

The CSV is already a source artifact, so no derivation step is needed:

```bash
DATABASE_URL='postgresql://...' pnpm enrichment:import -- \
  --source=ourairports-airports \
  --input=/secure/ooh-open-data/.../airports.csv \
  --release='<pinned nightly release>' \
  --access-uri='https://davidmegginson.github.io/ourairports-data/airports.csv' \
  --storage-uri='s3://company-open-data/ourairports/<sha>/airports.csv'
```

## Database outputs in E1 tranche 1

- `enrichment_artifacts`
- `enrichment_artifact_derivations`
- `enrichment_runs`
- `open_airport_references`
- `airport_open_reference_links`
- `osm_advertising_candidates`
- `site_open_candidate_matches`
- `open_enrichment_attribution`
- `open_enrichment_artifact_lineage`

Every normalized/candidate table is hard-constrained to `context_only`.

## Licensing architecture

License is a schema concern, not a README footnote.

Rules:

1. keep raw landed bytes source-specific;
2. pin exact source release + SHA-256;
3. preserve artifact-level attribution/license;
4. preserve feature-level upstream source/license when required;
5. never anonymously merge ODbL, CC BY-SA and permissive/public-domain raw databases into a newly redistributed raw database;
6. retain contributing artifact IDs/licenses on later derived site features; and
7. make UI/export attribution possible from stored provenance.

## Next adapters after E1 tranche 1

The next highest-yield implementation order is:

1. **GRID3 population + travel-time friction + settlements** — Nigeria-specific resident/accessibility/morphology context;
2. **Overture Transportation + Places** — network prominence and destination mix;
3. **WorldPop age/sex** — demographic composition;
4. **VIIRS monthly nightlights** — quality-aware night/economic intensity;
5. **Open Buildings Temporal** — built-form and urban-growth context;
6. reviewed GRID3/HFR markets, schools and health anchors; then
7. terrain/land cover only where they add independent explanatory value.

This remains parallel to T5. Open enrichment can make recommendations substantially more context-aware, but independent field calibration is still required before upgrading measurement claims.
