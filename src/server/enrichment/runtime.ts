import "server-only";
import type { GeocodingProvider } from "@/server/enrichment/adapter";
import { createEnrichmentGateway } from "@/server/enrichment/gateway";
import { createGoogleGeocodingProvider } from "@/server/enrichment/providers/googleGeocodingProvider";

function boundedInteger(
  value: string | undefined,
  fallback: number,
  ceiling: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, ceiling)
    : fallback;
}

const liveEnabled = process.env.LIVE_ENRICHMENT_ENABLED === "true";
const geocodingEnabled = process.env.GOOGLE_GEOCODING_V4_ENABLED === "true";
const apiKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim() ?? "";
const preflightSecret = process.env.ENRICHMENT_PREFLIGHT_SECRET?.trim() ?? "";
const enabled =
  liveEnabled &&
  geocodingEnabled &&
  apiKey.length > 0 &&
  preflightSecret.length >= 32;
const disabledGeocoder: GeocodingProvider = {
  geocode: async () => ({ status: "PROVIDER_ERROR", candidates: [] }),
};
const geocoder = enabled
  ? createGoogleGeocodingProvider({
      apiKey,
      now: () => new Date(),
      timeoutMs: boundedInteger(
        process.env.ENRICHMENT_REQUEST_TIMEOUT_MS,
        5_000,
        30_000,
      ),
    })
  : disabledGeocoder;

export const runtimeEnrichmentGateway = createEnrichmentGateway({
  now: () => new Date(),
  geocoder,
  enabled,
  maxRows: boundedInteger(process.env.ENRICHMENT_MAX_ROWS, 50, 50),
  maxCalls: boundedInteger(process.env.ENRICHMENT_MAX_CALLS_PER_RUN, 50, 50),
  signingSecret: preflightSecret,
});
