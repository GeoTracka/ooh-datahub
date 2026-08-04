import { describe, expect, it } from "vitest";
import { createGoogleGeocodingProvider } from "@/server/enrichment/providers/googleGeocodingProvider";

describe("createGoogleGeocodingProvider", () => {
  it("calls the v4 endpoint with the right headers and never sends the asset ID", async () => {
    let recorded:
      | { url: string; headers: Record<string, string>; body?: unknown }
      | null = null;
    const provider = createGoogleGeocodingProvider({
      apiKey: "server-key",
      now: () => new Date("2026-08-03T12:00:00Z"),
      timeoutMs: 5000,
      transport: async (request) => {
        recorded = { url: request.url, headers: request.headers };
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                placeId: "ChIJabc123",
                location: { latitude: 6.5158, longitude: 3.3792 },
                granularity: "APPROXIMATE",
                formattedAddress: "Herbert Macaulay Way, Yaba, Lagos, Nigeria",
                postalAddress: { regionCode: "NG", locality: "Lagos" },
                types: ["route"],
                viewport: {},
              },
            ],
          }),
        };
      },
    });
    const result = await provider.geocode({
      assetId: "asset-123",
      address: "Herbert Macaulay Way Yaba",
      expectedCountryCode: "NG",
      languageCode: "en",
    });
    expect(recorded!.url).toBe(
      "https://geocode.googleapis.com/v4/geocode/address/Herbert%20Macaulay%20Way%20Yaba",
    );
    expect(recorded!.headers["X-Goog-Api-Key"]).toBe("server-key");
    expect(recorded!.headers["X-Goog-FieldMask"]).toContain(
      "results.granularity",
    );
    expect(JSON.stringify(recorded)).not.toContain("asset-123");
    expect(result.candidates[0].quality.partialMatch).toBe("UNAVAILABLE_IN_V4");
    expect(result.candidates[0].coordinate.policy.displaySurfaces).not.toContain(
      "MAPLIBRE",
    );
  });
});
