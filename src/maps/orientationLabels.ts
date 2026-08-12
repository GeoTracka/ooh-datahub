import type { MapCoordinate } from "@/maps/mapCamera";

export type MapOrientationLabel = {
  name: "Third Mainland Bridge" | "Ikorodu Road" | "Lagos-Ibadan Expressway" | "Lagos Lagoon";
  kind: "road" | "water";
  coordinate: MapCoordinate;
};

/**
 * Derived from `public/map/lagos-open-context.geojson` on 2026-08-12.
 * Road coordinates are the geodesic midpoint of the longest matching named
 * LineString. The lagoon coordinate is the area-weighted centroid of its
 * exterior Polygon ring. Source OSM IDs respectively: 134222253, 133879446,
 * 135186125, and 2116203. Keeping these values compiled avoids another
 * client-side fetch/parse and ensures every visible name exists in the asset.
 */
export const mapOrientationLabels = [
  {
    name: "Third Mainland Bridge",
    kind: "road",
    coordinate: [3.402335529, 6.502454434],
  },
  {
    name: "Ikorodu Road",
    kind: "road",
    coordinate: [3.366882411, 6.547262369],
  },
  {
    name: "Lagos-Ibadan Expressway",
    kind: "road",
    coordinate: [3.404106278, 6.66448033],
  },
  {
    name: "Lagos Lagoon",
    kind: "water",
    coordinate: [3.580362413, 6.539812449],
  },
] as const satisfies readonly MapOrientationLabel[];
