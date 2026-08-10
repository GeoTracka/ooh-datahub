import { describe, expect, it } from "vitest";
import {
  parseOverturePlacesGeoJson,
  parseOvertureRoadsGeoJson,
  sourceLicenseCoverage,
} from "../../../src/enrichment/overture";

describe("Overture vector adapters", () => {
  it("preserves place taxonomy/status and feature-level source provenance", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        id: "place-1",
        properties: {
          id: "place-1",
          version: 3,
          name: "Example Market",
          basic_category: "market",
          taxonomy: JSON.stringify({ hierarchy: ["retail", "market"], primary: "market" }),
          confidence: 0.91,
          operating_status: "open",
          sources: JSON.stringify([
            { property: "/", dataset: "example-open-source", license: "CDLA-Permissive-2.0", record_id: "1" },
            { property: "/names", dataset: "example-name-source", record_id: "n1" },
          ]),
        },
        geometry: { type: "Point", coordinates: [3.35, 6.60] },
      }],
    };
    const rows = parseOverturePlacesGeoJson(JSON.stringify(geojson));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      featureId: "place-1",
      featureVersion: 3,
      name: "Example Market",
      basicCategory: "market",
      confidence: 0.91,
      operatingStatus: "open",
      longitude: 3.35,
      latitude: 6.60,
    });
    expect(rows[0].taxonomy).toEqual({ hierarchy: ["retail", "market"], primary: "market" });
    expect(rows[0].sources).toHaveLength(2);
    expect(sourceLicenseCoverage(rows[0].sources)).toEqual({
      sourceCount: 2,
      licensedSourceCount: 1,
      missingLicenseCount: 1,
    });
  });

  it("normalizes road topology fields without converting them into traffic", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {
          id: "road-1",
          version: 7,
          name: "Example Road",
          class: "primary",
          subclass: "link",
          connectors: JSON.stringify([
            { connector_id: "c1", at: 0 },
            { connector_id: "c2", at: 1 },
          ]),
          sources: JSON.stringify([{ dataset: "OpenStreetMap", license: "ODbL-1.0" }]),
        },
        geometry: { type: "LineString", coordinates: [[3.34, 6.60], [3.36, 6.60]] },
      }],
    };
    const rows = parseOvertureRoadsGeoJson(JSON.stringify(geojson));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      featureId: "road-1",
      featureVersion: 7,
      name: "Example Road",
      roadClass: "primary",
      subclass: "link",
    });
    expect(rows[0].connectors.map((item) => item.connector_id)).toEqual(["c1", "c2"]);
    expect(rows[0].coordinates).toEqual([[3.34, 6.60], [3.36, 6.60]]);
  });

  it("fails closed when Overture feature source provenance is absent", () => {
    const raw = {
      type: "Feature",
      properties: {
        id: "place-no-source",
        version: 1,
        basic_category: "bank",
        sources: [],
      },
      geometry: { type: "Point", coordinates: [3.35, 6.6] },
    };
    expect(() => parseOverturePlacesGeoJson(JSON.stringify(raw)))
      .toThrow("OVERTURE_SOURCES_REQUIRED:place-no-source");
  });
});
