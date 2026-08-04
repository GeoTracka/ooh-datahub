import type { EnrichedField } from "@/contracts/enrichment";

export type MapLens = "plan" | "activity" | "reach" | "influence";
export type DrawerTarget =
  | { kind: "package"; metric: "reach" | "influence" }
  | { kind: "pillar"; id: "A" | "D" | "C" | "P" | "E"; metric: "reach" | "influence" }
  | { kind: "zone"; id: string; metric: "reach" | "influence" }
  | { kind: "site"; id: string; metric: "reach" | "influence" }
  | {
      kind: "evidence";
      id: string;
      siteId: string;
      metric: "reach" | "influence";
    };

export type SpatialFeature = {
  id: string;
  coordinateField: EnrichedField<{ longitude: number; latitude: number }>;
  visual?: {
    label: string;
    metricLabel: string;
    value: number | null;
    unit: "rank" | "index_0_100" | "people" | "percentage_points" | "none";
    range?: { low: number; base: number; high: number };
    evidenceLabel: string;
  };
};

export type RenderedSpatialFeature = Omit<SpatialFeature, "coordinateField"> & {
  coordinate: [number, number];
  sourceProduct: string;
  attributionId?: string;
};

export type MapLibreScene = {
  kind: "maplibre";
  features: RenderedSpatialFeature[];
  attributionIds: string[];
};

export type GoogleScene = {
  kind: "google";
  features: RenderedSpatialFeature[];
  attributionIds: string[];
  noMapFallback: {
    features: RenderedSpatialFeature[];
    attributionIds: string[];
  };
};
