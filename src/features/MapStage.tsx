import { useEffect, useRef, useState } from "react";
import type { MapLibreScene } from "@/contracts/renderer";
import { MapCanvas } from "@/maps/MapCanvas";
import type { MapCameraRequest } from "@/maps/mapCamera";

export function MapStage({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: MapLibreScene;
  selectedFeatureId: string | null;
  onFeatureSelect(featureId: string): void;
}) {
  const previousSelection = useRef(selectedFeatureId);
  const [cameraRequest, setCameraRequest] = useState<MapCameraRequest>({
    mode: selectedFeatureId ? "selected" : "overview",
    revision: 0,
  });
  const legend = scene.features.find((feature) => feature.visual)?.visual ?? null;

  useEffect(() => {
    if (previousSelection.current === selectedFeatureId) return;
    previousSelection.current = selectedFeatureId;
    setCameraRequest((current) => ({
      mode: selectedFeatureId ? "selected" : "overview",
      revision: current.revision + 1,
    }));
  }, [selectedFeatureId]);

  function requestCamera(mode: MapCameraRequest["mode"]) {
    setCameraRequest((current) => ({ mode, revision: current.revision + 1 }));
  }

  return (
    <section className="explorer-map-stage" aria-label="Campaign map">
      <MapCanvas
        scene={scene}
        selectedFeatureId={selectedFeatureId}
        onFeatureSelect={onFeatureSelect}
        cameraRequest={cameraRequest}
      />
      {scene.features.length > 0 && (
        <div className="explorer-map-camera-toolbar" role="group" aria-label="Map camera">
          <button
            type="button"
            aria-pressed={cameraRequest.mode === "overview"}
            onClick={() => requestCamera("overview")}
          >
            Package overview
          </button>
          <button
            type="button"
            aria-pressed={cameraRequest.mode === "selected"}
            disabled={!selectedFeatureId}
            onClick={() => requestCamera("selected")}
          >
            Focus selected zone
          </button>
        </div>
      )}
      <div className="explorer-map-overlays">
        {legend && (
          <aside className="explorer-map-legend" aria-label="Map lens legend">
            <strong>{legend.metricLabel}</strong>
            <span>{legend.evidenceLabel}</span>
            <small>Marker number/size shows the active lens value. Labels identify zones or context sites.</small>
          </aside>
        )}
        <div className="explorer-map-note">
          <span>Planning context · not navigation</span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            Map data © OpenStreetMap contributors
          </a>
        </div>
      </div>
    </section>
  );
}
