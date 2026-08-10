import Papa from "papaparse";
import { normalizeEntityLiteral, sourceDisplayLiteral } from "../dataResolution/normalize";

export const OUR_AIRPORTS_ADAPTER_VERSION = "ourairports-airports-v1";

export type OurAirportsReference = {
  referenceId: string;
  ident: string;
  airportType: string;
  name: string;
  normalizedName: string;
  latitude: number;
  longitude: number;
  elevationFt: number | null;
  continent: string | null;
  isoCountry: string;
  isoRegion: string | null;
  municipality: string | null;
  scheduledService: boolean;
  gpsCode: string | null;
  iataCode: string | null;
  localCode: string | null;
  homeLink: string | null;
  wikipediaLink: string | null;
  keywords: string | null;
  rawRecord: Record<string, string>;
};

function requiredText(value: unknown, label: string): string {
  const text = sourceDisplayLiteral(value);
  if (!text) throw new Error(`OURAIRPORTS_${label}_REQUIRED`);
  return text;
}

function optionalText(value: unknown): string | null {
  return sourceDisplayLiteral(value);
}

function finiteNumber(value: unknown, label: string): number {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) throw new Error(`OURAIRPORTS_INVALID_${label}`);
  return parsed;
}

function optionalInteger(value: unknown): number | null {
  const text = optionalText(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : null;
}

export function parseOurAirportsCsv(csv: string, isoCountry = "NG"): OurAirportsReference[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`OURAIRPORTS_CSV_PARSE:${first.code}:${first.row ?? "unknown"}`);
  }

  const rows: OurAirportsReference[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data) {
    if (String(raw.iso_country ?? "").trim().toUpperCase() !== isoCountry.toUpperCase()) continue;
    const referenceId = requiredText(raw.id, "ID");
    if (seen.has(referenceId)) throw new Error(`OURAIRPORTS_DUPLICATE_ID:${referenceId}`);
    seen.add(referenceId);
    const name = requiredText(raw.name, "NAME");
    const normalizedName = normalizeEntityLiteral(name);
    if (!normalizedName) throw new Error(`OURAIRPORTS_NORMALIZED_NAME_REQUIRED:${referenceId}`);
    rows.push({
      referenceId,
      ident: requiredText(raw.ident, "IDENT"),
      airportType: requiredText(raw.type, "TYPE"),
      name,
      normalizedName,
      latitude: finiteNumber(raw.latitude_deg, "LATITUDE"),
      longitude: finiteNumber(raw.longitude_deg, "LONGITUDE"),
      elevationFt: optionalInteger(raw.elevation_ft),
      continent: optionalText(raw.continent),
      isoCountry: requiredText(raw.iso_country, "ISO_COUNTRY").toUpperCase(),
      isoRegion: optionalText(raw.iso_region),
      municipality: optionalText(raw.municipality),
      scheduledService: String(raw.scheduled_service ?? "").trim().toLowerCase() === "yes",
      gpsCode: optionalText(raw.gps_code),
      iataCode: optionalText(raw.iata_code),
      localCode: optionalText(raw.local_code),
      homeLink: optionalText(raw.home_link),
      wikipediaLink: optionalText(raw.wikipedia_link),
      keywords: optionalText(raw.keywords),
      rawRecord: raw,
    });
  }
  rows.sort((left, right) => left.referenceId.localeCompare(right.referenceId));
  return rows;
}
