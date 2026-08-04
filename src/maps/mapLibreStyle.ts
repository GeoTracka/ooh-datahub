import type { StyleSpecification } from "maplibre-gl";

export const mapLibreStyle: StyleSpecification = {
  version: 8,
  sources: {
    context: {
      type: "geojson",
      data: "/map/lagos-open-context.geojson",
    },
  },
  layers: [{
    id: "context-fill",
    type: "fill",
    source: "context",
    paint: { "fill-color": "#dce6e2", "fill-opacity": 0.65 },
  }],
};
