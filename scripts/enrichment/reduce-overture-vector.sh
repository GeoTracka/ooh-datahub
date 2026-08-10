#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <release> <west,south,east,north> <places.geojson> <roads.geojson>" >&2
  exit 2
fi

RELEASE="$1"
BBOX="$2"
PLACES_OUTPUT="$3"
ROADS_OUTPUT="$4"

if ! command -v duckdb >/dev/null 2>&1; then
  echo "duckdb is required (https://duckdb.org/)" >&2
  exit 2
fi

if [[ ! "$RELEASE" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}\.[0-9]+$ ]]; then
  echo "invalid Overture release: $RELEASE" >&2
  exit 2
fi

IFS=',' read -r WEST SOUTH EAST NORTH EXTRA <<< "$BBOX"
if [[ -n "${EXTRA:-}" || -z "${WEST:-}" || -z "${SOUTH:-}" || -z "${EAST:-}" || -z "${NORTH:-}" ]]; then
  echo "bbox must be west,south,east,north" >&2
  exit 2
fi

for VALUE in "$WEST" "$SOUTH" "$EAST" "$NORTH"; do
  if [[ ! "$VALUE" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; then
    echo "invalid numeric bbox component: $VALUE" >&2
    exit 2
  fi
done

if ! awk -v w="$WEST" -v s="$SOUTH" -v e="$EAST" -v n="$NORTH" 'BEGIN { exit !(w >= -180 && e <= 180 && s >= -90 && n <= 90 && w < e && s < n) }'; then
  echo "invalid bbox extent: $BBOX" >&2
  exit 2
fi

for OUTPUT in "$PLACES_OUTPUT" "$ROADS_OUTPUT"; do
  if [[ "$OUTPUT" == *"'"* ]]; then
    echo "output paths may not contain single quotes" >&2
    exit 2
  fi
  mkdir -p "$(dirname "$OUTPUT")"
done

PLACES_PATH="s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*"
ROADS_PATH="s3://overturemaps-us-west-2/release/${RELEASE}/theme=transportation/type=segment/*"

# The output is the immutable replay boundary retained by OOH Datahub. The
# release and bbox are explicit inputs: deterministic rebuilds never query a
# floating "latest" Overture release.
duckdb -c "
INSTALL spatial;
LOAD spatial;
INSTALL httpfs;
LOAD httpfs;
SET s3_region='us-west-2';
COPY (
  SELECT
    id,
    version,
    names.primary AS name,
    basic_category,
    CAST(taxonomy AS JSON) AS taxonomy,
    confidence,
    operating_status,
    CAST(sources AS JSON) AS sources,
    geometry
  FROM read_parquet('${PLACES_PATH}', filename=true, hive_partitioning=1)
  WHERE bbox.xmin BETWEEN ${WEST} AND ${EAST}
    AND bbox.ymin BETWEEN ${SOUTH} AND ${NORTH}
) TO '${PLACES_OUTPUT}' WITH (FORMAT GDAL, DRIVER 'GeoJSON', SRS 'EPSG:4326');
"

duckdb -c "
INSTALL spatial;
LOAD spatial;
INSTALL httpfs;
LOAD httpfs;
SET s3_region='us-west-2';
COPY (
  SELECT
    id,
    version,
    names.primary AS name,
    COALESCE(class, 'unknown') AS class,
    subclass,
    CAST(connectors AS JSON) AS connectors,
    CAST(sources AS JSON) AS sources,
    geometry
  FROM read_parquet('${ROADS_PATH}', filename=true, hive_partitioning=1)
  WHERE subtype='road'
    AND bbox.xmin < ${EAST}
    AND bbox.ymin < ${NORTH}
    AND bbox.xmax > ${WEST}
    AND bbox.ymax > ${SOUTH}
) TO '${ROADS_OUTPUT}' WITH (FORMAT GDAL, DRIVER 'GeoJSON', SRS 'EPSG:4326');
"

printf '{\n  "schemaVersion": 1,\n  "transformId": "overture-duckdb-bbox-reduction",\n  "transformVersion": "v1",\n  "release": "%s",\n  "bbox": [%s, %s, %s, %s],\n  "placesPath": "%s",\n  "roadsPath": "%s"\n}\n' \
  "$RELEASE" "$WEST" "$SOUTH" "$EAST" "$NORTH" "$PLACES_OUTPUT" "$ROADS_OUTPUT" \
  > "${PLACES_OUTPUT}.reduction-manifest.json"

echo "$PLACES_OUTPUT"
echo "$ROADS_OUTPUT"
