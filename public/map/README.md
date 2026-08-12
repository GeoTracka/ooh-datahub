# Lagos open map context

`lagos-open-context.geojson` is a checked-in, offline basemap context. It combines OpenStreetMap-derived Lagos road and water geometry with the pre-existing synthetic planning extent, corridors, and zones.

## OpenStreetMap extraction

- Extraction date: 2026-08-11
- Overpass endpoint: `https://overpass-api.de/api/interpreter`
- Bounding box in Overpass order `(south, west, north, east)`: `(6.36, 3.20, 6.70, 3.65)`
- Attribution: © OpenStreetMap contributors
- License: [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/)

The source extracts use these Overpass QL queries and output modes:

```overpass
[out:json];
way["highway"~"^(motorway|trunk|primary|secondary)$"](6.36,3.20,6.70,3.65);
out tags geom;
```

```overpass
[out:json];
(
  way["natural"="water"](6.36,3.20,6.70,3.65);
  way["waterway"~"^(river|canal)$"](6.36,3.20,6.70,3.65);
  way["natural"="coastline"](6.36,3.20,6.70,3.65);
);
out tags geom;
```

```overpass
[out:json];
relation["natural"="water"](6.36,3.20,6.70,3.65);
out geom;
```

## Deterministic transformation recipe

1. Retain the existing features whose `source` is `synthetic_demo`, preserving their order and geometry.
2. Sort each OSM element class by numeric OSM ID. Convert coordinates to GeoJSON `[longitude, latitude]`, round each ordinate to five decimal places, and remove consecutive duplicates introduced by rounding.
3. Convert every selected road way to a `LineString`. Classify `secondary` as `road-secondary`; classify `motorway`, `trunk`, and `primary` as `road-major`.
4. Convert a closed `natural=water` way without a `waterway` tag to a `water` `Polygon`. Convert rivers, canals, coastlines, and unclosed water ways to `water-line` `LineString` features.
5. For each `natural=water` relation, join `outer` member-way geometry by matching endpoints. Emit each closed outer ring as a `water` `Polygon`; emit any incomplete outer chain as a `water-line` `LineString`. Inner members are not included in this compact context layer.
6. Retain only compact provenance properties: feature `id`, `source`, numeric `osmId`, optional `name`, and `highway` for roads. Write a minified `FeatureCollection` with no timestamp-dependent values.

The checked-in file is consumed locally; the application does not query Overpass or request external map tiles at runtime.
