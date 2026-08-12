export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const MAP_CONTEXT_PATH = "/map/lagos-open-context.geojson";
export const MAP_CONTEXT_REVISION = "lagos-open-context.2026-08-12";
export const MAP_CONTEXT_REVISION_MATCHER = escapeRegexLiteral(MAP_CONTEXT_REVISION);
export const MAP_CONTEXT_URL = `${MAP_CONTEXT_PATH}?v=${MAP_CONTEXT_REVISION}`;

export const MAPLIBRE_WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";
export const MAPLIBRE_WORKER_REVISION = "maplibre-gl.6.1.0";
export const MAPLIBRE_WORKER_REVISION_MATCHER = escapeRegexLiteral(MAPLIBRE_WORKER_REVISION);
export const MAPLIBRE_WORKER_URL = `${MAPLIBRE_WORKER_PATH}?v=${MAPLIBRE_WORKER_REVISION}`;

export const IMMUTABLE_MAP_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
