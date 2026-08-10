import { productionEnrichmentSource } from "./sourceRegistry";

const allowedDownloadHosts: Record<string, readonly string[]> = {
  "ourairports-airports": ["davidmegginson.github.io", "raw.githubusercontent.com"],
  "osm-geofabrik-nigeria": ["download.geofabrik.de"],
};

export function assertAllowedEnrichmentDownloadUrl(sourceId: string, rawUrl: string): URL {
  productionEnrichmentSource(sourceId);
  const allowedHosts = allowedDownloadHosts[sourceId];
  if (!allowedHosts) throw new Error(`ENRICHMENT_DIRECT_DOWNLOAD_NOT_CONFIGURED:${sourceId}`);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("INVALID_ENRICHMENT_DOWNLOAD_URL");
  }
  if (url.protocol !== "https:") throw new Error("ENRICHMENT_DOWNLOAD_HTTPS_REQUIRED");
  if (url.username || url.password) throw new Error("ENRICHMENT_DOWNLOAD_CREDENTIALS_NOT_ALLOWED");
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`ENRICHMENT_DOWNLOAD_HOST_NOT_ALLOWED:${url.hostname}`);
  }
  return url;
}

export function sourceReleaseFromHttpHeaders(
  explicitRelease: string | null,
  headers: { lastModified?: string | null; etag?: string | null },
): string {
  const explicit = explicitRelease?.trim();
  if (explicit) return explicit;
  const lastModified = headers.lastModified?.trim();
  if (lastModified) {
    const date = new Date(lastModified);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  const etag = headers.etag?.trim();
  if (etag) return `etag:${etag.replace(/^W\//u, "")}`;
  throw new Error("ENRICHMENT_SOURCE_RELEASE_UNAVAILABLE:use --release=<reviewed-release>");
}
