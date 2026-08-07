import "server-only";
import type {
  EnrichedField,
  EnrichedFieldPolicy,
  GeocodeCandidate,
  GeocodeResponse,
} from "@/contracts/enrichment";
import type {
  GeocodeRequest,
  GeocodingProvider,
} from "@/server/enrichment/adapter";

const endpoint = "https://geocode.googleapis.com/v4/geocode/address/";
const fieldMask = [
  "results.placeId",
  "results.location",
  "results.granularity",
  "results.formattedAddress",
  "results.postalAddress",
  "results.addressComponents",
  "results.types",
  "results.viewport",
  "results.bounds",
].join(",");

type Transport = (input: {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal;
}) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

type GoogleResult = {
  placeId?: string;
  location?: { latitude?: number; longitude?: number };
  granularity?: string;
  formattedAddress?: string;
  postalAddress?: { regionCode?: string; locality?: string };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  types?: string[];
  viewport?: unknown;
  bounds?: unknown;
};

const granularities = new Set<GeocodeCandidate["granularity"]["value"]>([
  "ROOFTOP",
  "RANGE_INTERPOLATED",
  "GEOMETRIC_CENTER",
  "APPROXIMATE",
  "GRANULARITY_UNSPECIFIED",
]);

function component(result: GoogleResult, type: string) {
  return result.addressComponents?.find((item) => item.types?.includes(type));
}

function normalized(value: string | undefined): string | undefined {
  return value?.trim().toLocaleLowerCase("en");
}

export function createGoogleGeocodingProvider(input: {
  apiKey: string;
  now(): Date;
  timeoutMs: number;
  transport?: Transport;
}): GeocodingProvider {
  if (!input.apiKey.trim()) throw new Error("GOOGLE_GEOCODING_KEY_MISSING");
  const transport: Transport =
    input.transport ??
    (async (request) =>
      fetch(request.url, {
        headers: request.headers,
        signal: request.signal,
      }));

  return {
    async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const response = await transport({
          url: endpoint + encodeURIComponent(request.address),
          headers: {
            "X-Goog-Api-Key": input.apiKey,
            "X-Goog-FieldMask": fieldMask,
            "Accept-Language": request.languageCode,
          },
          signal: controller.signal,
        });
        if (!response.ok)
          return { status: "PROVIDER_ERROR", candidates: [] };
        const payload = (await response.json()) as { results?: GoogleResult[] };
        const results = Array.isArray(payload.results) ? payload.results : [];
        const usable = results.filter(
          (
            result,
          ): result is GoogleResult & {
            placeId: string;
            location: { latitude: number; longitude: number };
          } =>
            Boolean(
              result.placeId &&
                Number.isFinite(result.location?.latitude) &&
                Number.isFinite(result.location?.longitude),
            ),
        );
        if (results.length > 0 && usable.length === 0) {
          return { status: "PROVIDER_ERROR", candidates: [] };
        }
        const now = input.now();
        const receivedAt = now.toISOString();
        const expiresAt = new Date(
          now.getTime() + 30 * 24 * 60 * 60_000,
        ).toISOString();
        const contentPolicy = (sourceField: string): EnrichedFieldPolicy => ({
          sourceProduct: "google.geocoding.v4",
          sourceField,
          contentClass: "GOOGLE_MAPS_CONTENT",
          allowedPurposes: ["GEOCODE_REVIEW", "LIVE_DISPLAY_CONTEXT"],
          displaySurfaces: ["GOOGLE_MAP", "NO_MAP_WITH_ATTRIBUTION"],
          persistence: { kind: "DELETE_AT", expiresAt },
          attributionId: "google-maps",
          policyVersion: process.env.ENRICHMENT_POLICY_VERSION ?? "2026-08-03",
          receivedAt,
        });
        const wrap = <T,>(value: T, sourceField: string): EnrichedField<T> => ({
          value,
          policy: contentPolicy(sourceField),
        });
        return {
          status: usable.length === 0 ? "NO_RESULTS" : "REVIEW_REQUIRED",
          candidates: usable.map((result, index) => {
            const rawGranularity = result.granularity ?? "GRANULARITY_UNSPECIFIED";
            const granularity = granularities.has(
              rawGranularity as GeocodeCandidate["granularity"]["value"],
            )
              ? (rawGranularity as GeocodeCandidate["granularity"]["value"])
              : "GRANULARITY_UNSPECIFIED";
            const countryCode =
              result.postalAddress?.regionCode ??
              component(result, "country")?.shortText;
            const locality =
              result.postalAddress?.locality ??
              component(result, "locality")?.longText;
            return {
              candidateToken: "candidate-" + index,
              providerPlaceId: {
                value: result.placeId,
                policy: {
                  ...contentPolicy("results.placeId"),
                  persistence: { kind: "INDEFINITE_PLACE_ID" },
                },
              },
              coordinate: wrap(
                {
                  latitude: result.location.latitude,
                  longitude: result.location.longitude,
                },
                "results.location",
              ),
              granularity: wrap(granularity, "results.granularity"),
              formattedAddress: wrap(
                result.formattedAddress ?? "",
                "results.formattedAddress",
              ),
              resultTypes: wrap(result.types ?? [], "results.types"),
              quality: {
                resultOrdinal: index,
                resultCount: usable.length,
                countryMatches: countryCode === request.expectedCountryCode,
                localityMatches: request.expectedLocality
                  ? normalized(locality) === normalized(request.expectedLocality)
                  : "NOT_CHECKED",
                viewportAmbiguous: !result.bounds && Boolean(result.viewport),
                partialMatch: "UNAVAILABLE_IN_V4",
              },
            };
          }),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
