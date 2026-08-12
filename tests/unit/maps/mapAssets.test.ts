import { describe, expect, it } from "vitest";
import {
  MAP_CONTEXT_PATH,
  MAP_CONTEXT_REVISION,
  MAP_CONTEXT_REVISION_MATCHER,
  MAP_CONTEXT_URL,
  MAPLIBRE_WORKER_PATH,
  MAPLIBRE_WORKER_REVISION,
  MAPLIBRE_WORKER_REVISION_MATCHER,
  MAPLIBRE_WORKER_URL,
} from "@/maps/mapAssets";
import { mapLibreStyle } from "@/maps/mapLibreStyle";

describe("map asset URLs", () => {
  it("uses explicit revision queries for context and worker assets", () => {
    expect(MAP_CONTEXT_URL).toBe(`${MAP_CONTEXT_PATH}?v=${MAP_CONTEXT_REVISION}`);
    expect(MAPLIBRE_WORKER_URL)
      .toBe(`${MAPLIBRE_WORKER_PATH}?v=${MAPLIBRE_WORKER_REVISION}`);
    expect(MAP_CONTEXT_REVISION).toMatch(/^[a-z0-9.-]+$/);
    expect(MAPLIBRE_WORKER_REVISION).toMatch(/^[a-z0-9.-]+$/);
  });

  it("keeps the MapLibre source on the canonical revisioned context URL", () => {
    expect(mapLibreStyle.sources.context).toMatchObject({
      type: "geojson",
      data: MAP_CONTEXT_URL,
    });
  });

  it("escapes revision values for exact Next query regex matching", () => {
    expect(MAP_CONTEXT_REVISION_MATCHER)
      .toBe("lagos-open-context\\.2026-08-12");
    expect(MAPLIBRE_WORKER_REVISION_MATCHER)
      .toBe("maplibre-gl\\.6\\.1\\.0");
  });
});
