"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, type MapRef } from "@vis.gl/react-maplibre";
import { setWorkerUrl, type MapSourceDataEvent } from "maplibre-gl";
import type { MapLibreScene } from "@/contracts/renderer";
import { useDelayedVisibility } from "@/hooks/useDelayedVisibility";
import { MAPLIBRE_WORKER_URL } from "@/maps/mapAssets";
import {
  LAGOS_PACKAGE_OVERVIEW,
  resolvePackageCameraTarget,
  type MapCameraRequest,
} from "@/maps/mapCamera";
import { mapLibreStyle } from "@/maps/mapLibreStyle";
import { mapOrientationLabels } from "@/maps/orientationLabels";

setWorkerUrl(MAPLIBRE_WORKER_URL);

type ContextState = "loading" | "loaded" | "error";

const SOURCELESS_CONTEXT_NETWORK_ERRORS = [
  /^Failed to fetch$/i,
  /^NetworkError when attempting to fetch resource\.?$/i,
  /^Load failed$/i,
] as const;

function isContextLoadError(event: { error: Error; sourceId?: string }): boolean {
  if (event.sourceId) return event.sourceId === "context";
  const message = event.error.message.trim();
  return SOURCELESS_CONTEXT_NETWORK_ERRORS.some((pattern) => pattern.test(message));
}

const overview = {
  longitude: LAGOS_PACKAGE_OVERVIEW.center[0],
  latitude: LAGOS_PACKAGE_OVERVIEW.center[1],
  zoom: LAGOS_PACKAGE_OVERVIEW.zoom,
};


function packageCameraPadding(degraded: boolean): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const mobile = window.matchMedia?.("(max-width: 767px)").matches ?? false;
  if (degraded) {
    return mobile
      ? { top: 196, right: 32, bottom: 32, left: 32 }
      : { top: 188, right: 64, bottom: 60, left: 64 };
  }
  return mobile
    ? { top: 148, right: 32, bottom: 56, left: 32 }
    : { top: 124, right: 64, bottom: 80, left: 64 };
}

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
  cameraRequest,
  ariaLabel = "Map",
}: {
  scene: MapLibreScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
  cameraRequest?: MapCameraRequest;
  ariaLabel?: string;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [contextState, setContextState] = useState<ContextState>("loading");
  const [rendererRevision, setRendererRevision] = useState(0);
  const [appliedRequestKey, setAppliedRequestKey] = useState<string | null>(null);
  const degradedCamera = contextState === "error";
  const showLoadingStatus = useDelayedVisibility(contextState === "loading");
  const selected = scene.features.find((feature) => feature.id === selectedFeatureId);
  const requestedMode = cameraRequest?.mode ?? (selected ? "selected" : "overview");
  const selectedTarget = requestedMode === "selected" ? selected : undefined;
  const packageTarget = useMemo(
    () => resolvePackageCameraTarget(scene.features.map((feature) => feature.coordinate)),
    [scene.features],
  );
  const requestRevision = cameraRequest?.revision ?? 0;
  const targetId = selectedTarget?.id ?? "overview";
  const requestKey = `${targetId}:${requestRevision}`;
  const cameraFocusState = appliedRequestKey === requestKey
    ? (targetId === "overview" ? "overview" : "selected")
    : "pending";

  const assignMapRef = useCallback((map: MapRef | null) => {
    mapRef.current = map;
    setMapReady(Boolean(map));
    if (!map) {
      setAppliedRequestKey(null);
    }
  }, []);

  const handleSourceData = useCallback((event: MapSourceDataEvent) => {
    if (event.sourceId === "context" && event.isSourceLoaded) setContextState("loaded");
  }, []);

  const handleError = useCallback((event: { error: Error; sourceId?: string }) => {
    setContextState((current) =>
      current === "loading" && isContextLoadError(event) ? "error" : current,
    );
  }, []);

  const retryContext = useCallback(() => {
    setContextState("loading");
    setRendererRevision((current) => current + 1);
  }, []);

  const focusCurrentTarget = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const duration = reducedMotion || degradedCamera ? 0 : 400;
    if (selectedTarget) {
      map.flyTo({
        center: [selectedTarget.coordinate[0], selectedTarget.coordinate[1]],
        zoom: 12.5,
        duration,
      });
    } else if (packageTarget.kind === "bounds") {
      map.fitBounds([
        [packageTarget.bounds[0][0], packageTarget.bounds[0][1]],
        [packageTarget.bounds[1][0], packageTarget.bounds[1][1]],
      ], {
        padding: packageCameraPadding(degradedCamera),
        maxZoom: 11.5,
        duration,
      });
    } else {
      map.flyTo({
        center: [packageTarget.center[0], packageTarget.center[1]],
        zoom: packageTarget.zoom,
        duration,
      });
    }
    setAppliedRequestKey(requestKey);
  }, [degradedCamera, packageTarget, requestKey, selectedTarget]);

  useEffect(() => {
    if (!mapReady) return;
    focusCurrentTarget();
  }, [focusCurrentTarget, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    mapRef.current?.getCanvas().setAttribute("aria-label", ariaLabel);
  }, [ariaLabel, mapReady]);

  return (
    <div
      data-testid="maplibre-renderer"
      data-camera-focus-state={cameraFocusState}
      data-context-state={contextState}
      aria-busy={contextState === "loading"}
      className="map-surface"
    >
      <MapView
        key={rendererRevision}
        ref={assignMapRef}
        initialViewState={overview}
        mapStyle={mapLibreStyle}
        reuseMaps={false}
        onLoad={focusCurrentTarget}
        onSourceData={handleSourceData}
        onError={handleError}
      >
        {mapOrientationLabels.map((label) => (
          <Marker
            key={label.name}
            longitude={label.coordinate[0]}
            latitude={label.coordinate[1]}
            anchor="center"
          >
            <span
              className="map-orientation-label"
              data-kind={label.kind}
              data-map-orientation-label={label.name}
              aria-hidden="true"
            >
              {label.name}
            </span>
          </Marker>
        ))}
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
                <span
                  className={selectedFeatureId === feature.id
                    ? "map-marker-caption selected"
                    : "map-marker-caption"}
                  aria-hidden="true"
                >
                  {feature.visual.label}
                </span>
              )}
            </div>
          </Marker>
        ))}
      </MapView>
      {showLoadingStatus && (
        <div className="map-context-status" role="status" aria-live="polite">
          Loading Lagos planning context…
        </div>
      )}
      {contextState === "error" && (
        <div className="map-context-status map-context-status-error" role="alert">
          <span>Lagos planning context is unavailable. Package locations remain available.</span>
          <button type="button" onClick={retryContext}>Retry map context</button>
        </div>
      )}
    </div>
  );
}
