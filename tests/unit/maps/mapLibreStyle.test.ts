import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapLibreStyle } from "@/maps/mapLibreStyle";

describe("mapLibreStyle", () => {
  it("includes the open-context water and road layers", () => {
    const layerIds = mapLibreStyle.layers.map((layer) => layer.id);

    expect(layerIds).toEqual(expect.arrayContaining([
      "water-fill",
      "major-road-casing",
      "major-roads",
      "secondary-roads",
    ]));
  });

  it("has open-context features for water and major and secondary roads", () => {
    const context = JSON.parse(
      readFileSync("public/map/lagos-open-context.geojson", "utf8"),
    ) as {
      features: Array<{ properties?: { kind?: string } }>;
    };
    const featureKinds = context.features.map((feature) => feature.properties?.kind);

    expect(featureKinds).toEqual(expect.arrayContaining([
      "water",
      "road-major",
      "road-secondary",
    ]));
  });
});
