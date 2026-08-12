import type { StyleSpecification } from "maplibre-gl";
import { MAP_CONTEXT_URL } from "@/maps/mapAssets";

export const mapLibreStyle: StyleSpecification = {
  version: 8,
  sources: {
    context: {
      type: "geojson",
      data: MAP_CONTEXT_URL,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f5f0e7",
      },
    },
    {
      id: "planning-extent",
      type: "fill",
      source: "context",
      filter: ["==", ["get", "kind"], "extent"],
      paint: {
        "fill-color": "#f8f4ec",
        "fill-opacity": 0.96,
      },
    },
    {
      id: "water-fill",
      type: "fill",
      source: "context",
      filter: ["==", ["get", "kind"], "water"],
      paint: {
        "fill-color": "#b9ddea",
        "fill-opacity": 0.88,
        "fill-outline-color": "#91c8da",
      },
    },
    {
      id: "water-lines",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "water-line"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#86bfd3",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 12, 1.5, 15, 3],
        "line-opacity": 0.82,
      },
    },
    {
      id: "major-road-casing",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "road-major"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#fffaf1",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 12, 5.2, 15, 10],
        "line-opacity": 0.96,
      },
    },
    {
      id: "secondary-road-casing",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "road-secondary"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#fffaf1",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.5, 12, 3.6, 15, 7],
        "line-opacity": 0.92,
      },
    },
    {
      id: "major-roads",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "road-major"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#c87552",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 12, 3.2, 15, 6.4],
        "line-opacity": 0.92,
      },
    },
    {
      id: "secondary-roads",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "road-secondary"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#dcae72",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 2.1, 15, 4.4],
        "line-opacity": 0.88,
      },
    },
    {
      id: "planning-corridors-shadow",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "corridor"],
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 5, 12, 8, 15, 12],
        "line-opacity": 0.9,
      },
    },
    {
      id: "planning-corridors",
      type: "line",
      source: "context",
      filter: ["==", ["get", "kind"], "corridor"],
      paint: {
        "line-color": "#2f7770",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 3.2, 15, 5],
        "line-opacity": 0.94,
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
        "circle-stroke-color": "#2f7770",
        "circle-stroke-width": 2,
      },
    },
  ],
};
