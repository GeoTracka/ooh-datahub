import { describe, expect, it } from "vitest";
import { parseOurAirportsCsv } from "../../../src/enrichment/ourAirports";

const header = [
  "id", "ident", "type", "name", "latitude_deg", "longitude_deg", "elevation_ft",
  "continent", "iso_country", "iso_region", "municipality", "scheduled_service",
  "gps_code", "iata_code", "local_code", "home_link", "wikipedia_link", "keywords",
].join(",");

describe("OurAirports adapter", () => {
  it("filters to Nigeria and preserves stable airport identifiers/codes", () => {
    const csv = [
      header,
      '1,DNMM,large_airport,Murtala Muhammed International Airport,6.5774,3.3212,135,AF,NG,NG-LA,Lagos,yes,DNMM,LOS,,,https://example.test/mmia,"Ikeja, Lagos"',
      "2,DGAA,large_airport,Kotoka International Airport,5.6052,-0.1668,205,AF,GH,GH-AA,Accra,yes,DGAA,ACC,,,,",
    ].join("\n");
    const rows = parseOurAirportsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      referenceId: "1",
      ident: "DNMM",
      name: "Murtala Muhammed International Airport",
      normalizedName: "murtala muhammed international airport",
      isoCountry: "NG",
      municipality: "Lagos",
      scheduledService: true,
      gpsCode: "DNMM",
      iataCode: "LOS",
    });
  });

  it("fails closed on duplicate stable IDs", () => {
    const row = "1,DNXX,small_airport,Fixture Airport,6.5,3.4,,AF,NG,NG-LA,Lagos,no,DNXX,,,,,";
    expect(() => parseOurAirportsCsv([header, row, row].join("\n")))
      .toThrow("OURAIRPORTS_DUPLICATE_ID:1");
  });
});
