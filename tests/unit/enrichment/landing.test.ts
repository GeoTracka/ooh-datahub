import { describe, expect, it } from "vitest";
import {
  assertAllowedEnrichmentDownloadUrl,
  sourceReleaseFromHttpHeaders,
} from "../../../src/enrichment/landing";

describe("open enrichment landing policy", () => {
  it("allows only reviewed HTTPS hosts for direct no-key landing", () => {
    expect(assertAllowedEnrichmentDownloadUrl(
      "osm-geofabrik-nigeria",
      "https://download.geofabrik.de/africa/nigeria-latest.osm.pbf",
    ).hostname).toBe("download.geofabrik.de");
    expect(() => assertAllowedEnrichmentDownloadUrl(
      "osm-geofabrik-nigeria",
      "https://example.test/nigeria.osm.pbf",
    )).toThrow("ENRICHMENT_DOWNLOAD_HOST_NOT_ALLOWED");
    expect(() => assertAllowedEnrichmentDownloadUrl(
      "ourairports-airports",
      "http://davidmegginson.github.io/ourairports-data/airports.csv",
    )).toThrow("ENRICHMENT_DOWNLOAD_HTTPS_REQUIRED");
  });

  it("pins a release from explicit review, then Last-Modified, then ETag", () => {
    expect(sourceReleaseFromHttpHeaders("reviewed-r1", {})).toBe("reviewed-r1");
    expect(sourceReleaseFromHttpHeaders(null, {
      lastModified: "Mon, 10 Aug 2026 12:00:00 GMT",
      etag: '"ignored"',
    })).toBe("2026-08-10T12:00:00.000Z");
    expect(sourceReleaseFromHttpHeaders(null, { etag: 'W/"abc"' })).toBe('etag:"abc"');
    expect(() => sourceReleaseFromHttpHeaders(null, {}))
      .toThrow("ENRICHMENT_SOURCE_RELEASE_UNAVAILABLE");
  });
});
