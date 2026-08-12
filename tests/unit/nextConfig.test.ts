import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";
import {
  IMMUTABLE_MAP_ASSET_CACHE_CONTROL,
  MAP_CONTEXT_PATH,
  MAP_CONTEXT_REVISION,
  MAP_CONTEXT_REVISION_MATCHER,
  MAP_CONTEXT_URL,
  MAPLIBRE_WORKER_PATH,
  MAPLIBRE_WORKER_REVISION,
  MAPLIBRE_WORKER_REVISION_MATCHER,
  MAPLIBRE_WORKER_URL,
} from "@/maps/mapAssets";

describe("Next map asset headers", () => {
  it("marks only exact revisioned public asset requests immutable", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toEqual(expect.arrayContaining([
      {
        source: MAP_CONTEXT_PATH,
        has: [{ type: "query", key: "v", value: MAP_CONTEXT_REVISION_MATCHER }],
        headers: [{ key: "Cache-Control", value: IMMUTABLE_MAP_ASSET_CACHE_CONTROL }],
      },
      {
        source: MAPLIBRE_WORKER_PATH,
        has: [{ type: "query", key: "v", value: MAPLIBRE_WORKER_REVISION_MATCHER }],
        headers: [{ key: "Cache-Control", value: IMMUTABLE_MAP_ASSET_CACHE_CONTROL }],
      },
    ]));
    expect(headers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/map/:path*" }),
      expect.objectContaining({ source: "/maplibre/:path*" }),
    ]));
  });

  it("applies immutable caching only to exact revision query values", async () => {
    async function cacheControl(url: string): Promise<string | null> {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://ooh.example${url}`,
        nextConfig,
      });
      return response.headers.get("cache-control");
    }

    expect(await cacheControl(MAP_CONTEXT_URL))
      .toBe(IMMUTABLE_MAP_ASSET_CACHE_CONTROL);
    expect(await cacheControl(MAP_CONTEXT_PATH)).toBeNull();
    expect(await cacheControl(`${MAP_CONTEXT_PATH}?v=wrong-revision`)).toBeNull();
    expect(await cacheControl(
      `${MAP_CONTEXT_PATH}?v=${MAP_CONTEXT_REVISION.replaceAll(".", "X")}`,
    )).toBeNull();

    expect(await cacheControl(MAPLIBRE_WORKER_URL))
      .toBe(IMMUTABLE_MAP_ASSET_CACHE_CONTROL);
    expect(await cacheControl(
      `${MAPLIBRE_WORKER_PATH}?v=${MAPLIBRE_WORKER_REVISION.replaceAll(".", "X")}`,
    )).toBeNull();
  });
});
