"use client";

import MapView, { Marker } from "@vis.gl/react-maplibre";
import type { MapLibreScene } from "@/contracts/renderer";
import { mapLibreStyle } from "@/maps/mapLibreStyle";

function markerScale(scene: MapLibreScene, value: number | null | undefined): number {
  const values = scene.features.flatMap((feature) =>
    feature.visual?.value === null || feature.visual?.value === undefined
      ? []
      : [feature.visual.value],
  );
  if (value === null || value === undefined || values.length === 0) return 0.5;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return maximum === minimum ? 0.72 : (value - minimum) / (maximum - minimum);
}

export function MapLibreRenderer({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: MapLibreScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
}) {
  const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
  const initialViewState = selected
    ? {
        longitude: selected.coordinate[0],
        latitude: selected.coordinate[1],
        zoom: 12.5,
      }
    : {
        longitude: 3.39,
        latitude: 6.53,
        zoom: 10.5,
      };

  return (
    <div data-testid="maplibre-renderer" className="map-surface">
      <MapView
        key={selectedFeatureId ?? "all"}
        initialViewState={initialViewState}
        mapStyle={mapLibreStyle}
        reuseMaps={false}
      >
        {scene.features.map((feature) => (
          <Marker
            key={feature.id}
            longitude={feature.coordinate[0]}
            latitude={feature.coordinate[1]}
          >
            <button
              type="button"
              className={selectedFeatureId === feature.id ? "map-marker selected" : "map-marker"}
              aria-pressed={selectedFeatureId === feature.id}
              style={{ "--marker-scale": markerScale(scene, feature.visual?.value) } as React.CSSProperties}
              aria-label={feature.visual
                ? `${feature.visual.label}. ${feature.visual.metricLabel}: ${feature.visual.value ?? "unavailable"} ${feature.visual.unit}. ${feature.visual.evidenceLabel}`
                : feature.id}
              onClick={() => onFeatureSelect?.(feature.id)}
            >
              <span>{feature.visual?.value === null || feature.visual?.value === undefined
                ? "—"
                : Math.round(feature.visual.value).toLocaleString("en")}</span>
            </button>
          </Marker>
        ))}
      </MapView>
    </div>
  );
}
