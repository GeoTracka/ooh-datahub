"use client";

import { useEffect, useRef } from "react";
import MapView, { Marker, type MapRef } from "@vis.gl/react-maplibre";
import type { MapLibreScene } from "@/contracts/renderer";
import { mapLibreStyle } from "@/maps/mapLibreStyle";

const overview = {
  longitude: 3.39,
  latitude: 6.53,
  zoom: 10.5,
};

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

function markerValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) < 1_000) return Math.round(value).toLocaleString("en");
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
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
  const mapRef = useRef<MapRef | null>(null);
  const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
  const targetLongitude = selected?.coordinate[0] ?? overview.longitude;
  const targetLatitude = selected?.coordinate[1] ?? overview.latitude;
  const targetZoom = selected ? 12.5 : overview.zoom;

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    mapRef.current?.flyTo({
      center: [targetLongitude, targetLatitude],
      zoom: targetZoom,
      duration: reducedMotion ? 0 : 400,
    });
  }, [targetLatitude, targetLongitude, targetZoom]);

  return (
    <div data-testid="maplibre-renderer" className="map-surface">
      <MapView
        ref={mapRef}
        initialViewState={overview}
        mapStyle={mapLibreStyle}
        reuseMaps={false}
      >
        {scene.features.map((feature) => (
          <Marker
            key={feature.id}
            longitude={feature.coordinate[0]}
            latitude={feature.coordinate[1]}
          >
            <div className="map-marker-wrap">
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
                <span>{markerValue(feature.visual?.value)}</span>
              </button>
              {feature.visual && (
                <span className="map-marker-caption" aria-hidden="true">
                  {feature.visual.label}
                </span>
              )}
            </div>
          </Marker>
        ))}
      </MapView>
    </div>
  );
}
