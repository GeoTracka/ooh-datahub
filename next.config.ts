import type { NextConfig } from "next";
import {
  IMMUTABLE_MAP_ASSET_CACHE_CONTROL,
  MAP_CONTEXT_PATH,
  MAP_CONTEXT_REVISION_MATCHER,
  MAPLIBRE_WORKER_PATH,
  MAPLIBRE_WORKER_REVISION_MATCHER,
} from "./src/maps/mapAssets";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: MAP_CONTEXT_PATH,
        has: [{ type: "query" as const, key: "v", value: MAP_CONTEXT_REVISION_MATCHER }],
        headers: [{ key: "Cache-Control", value: IMMUTABLE_MAP_ASSET_CACHE_CONTROL }],
      },
      {
        source: MAPLIBRE_WORKER_PATH,
        has: [{ type: "query" as const, key: "v", value: MAPLIBRE_WORKER_REVISION_MATCHER }],
        headers: [{ key: "Cache-Control", value: IMMUTABLE_MAP_ASSET_CACHE_CONTROL }],
      },
    ];
  },
};

export default nextConfig;
