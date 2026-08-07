import type { StyleSpecification } from "maplibre-gl";

export const mapLibreStyle: StyleSpecification = {
  version: 8,
  sources: {
    context: {
      type: "geojson",
      data: "/map/lagos-open-context.geojson",
    },
  },
  layers: [
    {
      id: "planning-extent",
      type: "fill",
      source: "context",
      filter: ["==", ["get", "kind"], "extent"],
      paint: {
        "fill-color": "#f2efe9",
        "fill-opacity": 0.92,
      },
    },
    {
      id: "planning-corridors-shadow",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "corridor"],
      paint: {
        "line-color": "#ffffff",
        "line-width": 8,
        "line-opacity": 0.85,
      },
    },
    {
      id: "planning-corridors",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "corridor"],
      paint: {
        "line-color": "#aebbb6",
        "line-width": 3,
        "line-opacity": 0.85,
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "seeded-zone-context",
      type: "circle",
      source: "context",
      filter: ["==", ["get", "kind"], "zone"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#8aa49d",
        "circle-stroke-width": 2,
      },
    },
  ],
};
