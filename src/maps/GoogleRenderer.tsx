"use client";

import { useEffect, useState } from "react";
import { AdvancedMarker, APIProvider, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import type { GoogleScene } from "@/contracts/renderer";
import {
  fitWebMercatorBoundsCamera,
  resolvePackageCameraTarget,
  type MapCameraRequest,
} from "@/maps/mapCamera";

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

function GoogleCameraController({
  scene,
  selectedFeatureId,
  cameraRequest,
}: {
  scene: GoogleScene;
  selectedFeatureId?: string | null;
  cameraRequest?: MapCameraRequest;
}) {
  const map = useMap();
  const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
  const requestedMode = cameraRequest?.mode ?? (selected ? "selected" : "overview");

  useEffect(() => {
    if (!map) return;
    if (requestedMode === "selected" && selected) {
      map.moveCamera({
        center: { lng: selected.coordinate[0], lat: selected.coordinate[1] },
        zoom: 12.5,
      });
      return;
    }

    const target = resolvePackageCameraTarget(
      scene.features.map((feature) => feature.coordinate),
    );
    if (target.kind === "bounds") {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      if (reducedMotion) {
        const mapElement = map.getDiv();
        const camera = fitWebMercatorBoundsCamera(target.bounds, {
          width: mapElement.clientWidth,
          height: mapElement.clientHeight,
        }, 64);
        map.moveCamera({
          center: { lng: camera.center[0], lat: camera.center[1] },
          zoom: camera.zoom,
        });
      } else {
        map.fitBounds({
          west: target.bounds[0][0],
          south: target.bounds[0][1],
          east: target.bounds[1][0],
          north: target.bounds[1][1],
        }, 64);
      }
      return;
    }
    map.moveCamera({
      center: { lng: target.center[0], lat: target.center[1] },
      zoom: target.zoom,
    });
  }, [cameraRequest?.revision, map, requestedMode, scene.features, selected]);

  return null;
}

export function GoogleRenderer({
  scene,
  selectedFeatureId,
  onFeatureSelect,
  cameraRequest,
}: {
  scene: GoogleScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
  cameraRequest?: MapCameraRequest;
}) {
  const [config, setConfig] = useState<GoogleConfig | null>(null);
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
          defaultCenter={{ lng: 3.39, lat: 6.53 }}
          defaultZoom={10.5}
          mapId="DEMO_MAP_ID"
          disableDefaultUI
        >
          <GoogleCameraController
            scene={scene}
            selectedFeatureId={selectedFeatureId}
            cameraRequest={cameraRequest}
          />
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
