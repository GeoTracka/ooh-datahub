"use client";

import type { GoogleScene, MapLibreScene } from "@/contracts/renderer";
import { GoogleRenderer } from "@/maps/GoogleRenderer";
import { MapLibreRenderer } from "@/maps/MapLibreRenderer";
import type { MapCameraRequest } from "@/maps/mapCamera";

export function MapCanvas({
  scene,
  selectedFeatureId,
  onFeatureSelect,
  cameraRequest,
  ariaLabel,
}: {
  scene: GoogleScene | MapLibreScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
  cameraRequest?: MapCameraRequest;
  ariaLabel?: string;
}) {
  return scene.kind === "google"
    ? <GoogleRenderer key="google" scene={scene} selectedFeatureId={selectedFeatureId} onFeatureSelect={onFeatureSelect} cameraRequest={cameraRequest} />
    : <MapLibreRenderer key="maplibre" scene={scene} selectedFeatureId={selectedFeatureId} onFeatureSelect={onFeatureSelect} cameraRequest={cameraRequest} ariaLabel={ariaLabel} />;
}
