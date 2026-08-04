import type {
  GoogleScene,
  MapLibreScene,
  RenderedSpatialFeature,
  SpatialFeature,
} from "@/contracts/renderer";
import { canProjectField } from "@/enrichment/policyRules";

function attributions(features: RenderedSpatialFeature[]): string[] {
  return [...new Set(
    features.map((item) => item.attributionId).filter((value): value is string => Boolean(value)),
  )].sort();
}

function flatten(
  features: SpatialFeature[],
  surface: "MAPLIBRE" | "GOOGLE_MAP" | "NO_MAP_WITH_ATTRIBUTION",
  purpose: "LIVE_DISPLAY_CONTEXT" | "GEOCODE_REVIEW",
  now: Date,
): RenderedSpatialFeature[] {
  return features.flatMap((item) => {
    if (!canProjectField(item.coordinateField, surface, purpose, now)) return [];
    const { longitude, latitude } = item.coordinateField.value;
    return [{
      id: item.id,
      coordinate: [longitude, latitude] as [number, number],
      sourceProduct: item.coordinateField.policy.sourceProduct,
      attributionId: item.coordinateField.policy.attributionId,
      visual: item.visual,
    }];
  });
}

export function projectMapLibreScene(
  features: SpatialFeature[],
  now = new Date(),
): MapLibreScene {
  const eligible = flatten(features, "MAPLIBRE", "LIVE_DISPLAY_CONTEXT", now);
  return { kind: "maplibre", features: eligible, attributionIds: attributions(eligible) };
}

export function projectGoogleScene(
  features: SpatialFeature[],
  now = new Date(),
): GoogleScene {
  const eligible = flatten(features, "GOOGLE_MAP", "GEOCODE_REVIEW", now);
  const noMap = flatten(features, "NO_MAP_WITH_ATTRIBUTION", "GEOCODE_REVIEW", now);
  return {
    kind: "google",
    features: eligible,
    attributionIds: attributions(eligible),
    noMapFallback: {
      features: noMap,
      attributionIds: attributions(noMap),
    },
  };
}
