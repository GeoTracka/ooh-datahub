import "server-only";
import type { GeocodeResponse } from "@/contracts/enrichment";

export type GeocodeRequest = {
  assetId: string;
  address: string;
  expectedCountryCode: "NG";
  expectedLocality?: string;
  languageCode: "en";
};

export interface GeocodingProvider {
  geocode(request: GeocodeRequest): Promise<GeocodeResponse>;
}
