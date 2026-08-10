import { describe, expect, it } from "vitest";
import {
  haversineDistanceM,
  parseOsmAdvertisingGeoJsonSequence,
} from "../../../src/enrichment/osmAdvertising";

describe("OSM advertising adapter", () => {
  it("preserves osmium attributes and billboard metadata", () => {
    const feature = {
      type: "Feature",
      properties: {
        "@type": "node",
        "@id": 123,
        advertising: "billboard",
        operator: "Example Outdoor",
        ref: "NG-LAG-001",
        lit: "yes",
        direction: "90",
      },
      geometry: { type: "Point", coordinates: [3.3212, 6.5774] },
    };
    const rows = parseOsmAdvertisingGeoJsonSequence(`\u001e${JSON.stringify(feature)}\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      osmType: "node",
      osmId: "123",
      advertisingType: "billboard",
      operatorName: "Example Outdoor",
      sourceRef: "NG-LAG-001",
      lit: "yes",
      direction: "90",
      representativeMethod: "point",
      latitude: 6.5774,
      longitude: 3.3212,
    });
  });

  it("keeps other features out and supports geometry representatives without claiming centroids", () => {
    const nonAdvertising = {
      type: "Feature",
      properties: { "@type": "node", "@id": 1, amenity: "bank" },
      geometry: { type: "Point", coordinates: [3.3, 6.5] },
    };
    const board = {
      type: "Feature",
      properties: { "@type": "way", "@id": 2, advertising: "screen" },
      geometry: { type: "LineString", coordinates: [[3.3, 6.5], [3.4, 6.6]] },
    };
    const rows = parseOsmAdvertisingGeoJsonSequence(
      `${JSON.stringify(nonAdvertising)}\n${JSON.stringify(board)}\n`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      osmType: "way",
      osmId: "2",
      advertisingType: "screen",
      representativeMethod: "vertex_mean",
      latitude: 6.55,
      longitude: 3.35,
    });
  });

  it("computes proximity in metres without turning proximity into identity", () => {
    expect(haversineDistanceM(
      { latitude: 6.5774, longitude: 3.3212 },
      { latitude: 6.5774, longitude: 3.3212 },
    )).toBe(0);
    expect(haversineDistanceM(
      { latitude: 6.5774, longitude: 3.3212 },
      { latitude: 6.5780, longitude: 3.3212 },
    )).toBeGreaterThan(50);
  });
});
