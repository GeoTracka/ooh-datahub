"use client";

import { useEffect, useState } from "react";
import { AdvancedMarker, APIProvider, Map as GoogleMap } from "@vis.gl/react-google-maps";
import type { GoogleScene } from "@/contracts/renderer";

type GoogleConfig =
  | { enabled: false }
  | { enabled: true; browserKey: string };

function markerScale(scene: GoogleScene, value: number | null | undefined): number {
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

export function GoogleRenderer({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: GoogleScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
}) {
  const [config, setConfig] = useState<GoogleConfig | null>(null);
  const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
  const center = selected
    ? { lng: selected.coordinate[0], lat: selected.coordinate[1] }
    : { lng: 3.39, lat: 6.53 };
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/maps/google-config", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<GoogleConfig>)
      .then(setConfig)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConfig({ enabled: false });
        }
      });
    return () => controller.abort();
  }, []);

  if (!config) return <div data-testid="google-renderer">Loading Google map…</div>;
  if (!config.enabled) {
    return <div data-testid="google-renderer" aria-label="No-map geocode review">
      <p>Google map is disabled; review the eligible values below.</p>
      {scene.noMapFallback.features.map((feature) => (
        <button key={feature.id} type="button" onClick={() => onFeatureSelect?.(feature.id)}>
          {feature.visual?.label ?? feature.id}
        </button>
      ))}
      {scene.noMapFallback.attributionIds.includes("google-maps") && (
        <span className="map-attribution">Google Maps</span>
      )}
    </div>;
  }
  return (
    <div data-testid="google-renderer" className="map-surface">
      <APIProvider apiKey={config.browserKey}>
        <GoogleMap
          center={center}
          zoom={selected ? 12.5 : 10.5}
          mapId="DEMO_MAP_ID"
          disableDefaultUI
        >
          {scene.features.map((feature) => (
            <AdvancedMarker
              key={feature.id}
              position={{ lng: feature.coordinate[0], lat: feature.coordinate[1] }}
              title={feature.id}
              onClick={() => onFeatureSelect?.(feature.id)}
            >
              <button type="button" className={selectedFeatureId === feature.id ? "map-marker selected" : "map-marker"} aria-pressed={selectedFeatureId === feature.id} style={{ "--marker-scale": markerScale(scene, feature.visual?.value) } as React.CSSProperties} aria-label={feature.visual
                ? `${feature.visual.label}. ${feature.visual.metricLabel}: ${feature.visual.value ?? "unavailable"} ${feature.visual.unit}. ${feature.visual.evidenceLabel}`
                : feature.id}>
                {feature.visual?.value === null || feature.visual?.value === undefined
                  ? "—"
                  : Math.round(feature.visual.value).toLocaleString("en")}
              </button>
            </AdvancedMarker>
          ))}
        </GoogleMap>
      </APIProvider>
      {scene.attributionIds.includes("google-maps") && (
        <span className="map-attribution">Google Maps</span>
      )}
    </div>
  );
}
