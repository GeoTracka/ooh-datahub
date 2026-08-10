#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <nigeria.osm.pbf> <advertising.geojsonseq>" >&2
  exit 2
fi

INPUT="$1"
OUTPUT="$2"

if ! command -v osmium >/dev/null 2>&1; then
  echo "osmium is required (https://osmcode.org/osmium-tool/)" >&2
  exit 2
fi
if [[ ! -f "$INPUT" ]]; then
  echo "input PBF does not exist: $INPUT" >&2
  exit 2
fi

mkdir -p "$(dirname "$OUTPUT")"
TMP_PBF="${OUTPUT}.filtered.osm.pbf"
trap 'rm -f "$TMP_PBF"' EXIT

# Keep referenced nodes so way/relation geometry can be exported. This is an
# offline reduction of the pinned Geofabrik artifact; public Overpass is not a
# production bulk-ingestion dependency.
osmium tags-filter \
  --overwrite \
  --output "$TMP_PBF" \
  "$INPUT" \
  'nwr/advertising=billboard,screen,board,totem' \
  'nwr/man_made=advertising'

# Export original object type/id as @type/@id and suppress RFC8142 record
# separators so the result is newline-delimited JSON that the deterministic
# importer can stream/parse without losing arbitrary OSM tags.
osmium export \
  --overwrite \
  --attributes=type,id \
  --output-format=geojsonseq \
  --format-option=print_record_separator=false \
  --output "$OUTPUT" \
  "$TMP_PBF"

echo "$OUTPUT"
