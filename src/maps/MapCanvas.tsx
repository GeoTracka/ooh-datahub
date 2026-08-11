"use client";

import type { GoogleScene, MapLibreScene } from "@/contracts/renderer";
import { GoogleRenderer } from "@/maps/GoogleRenderer";
import { MapLibreRenderer } from "@/maps/MapLibreRenderer";

export function MapCanvas({
  scene,
  selectedFeatureId,
  onFeatureSelect,
  ariaLabel,
}: {
  scene: GoogleScene | MapLibreScene;
  selectedFeatureId?: string | null;
  onFeatureSelect?(featureId: string): void;
  ariaLabel?: string;
}) {
  return scene.kind === "google"
    ? <GoogleRenderer key="google" scene={scene} selectedFeatureId={selectedFeatureId} onFeatureSelect={onFeatureSelect} />
    : <MapLibreRenderer key="maplibre" scene={scene} selectedFeatureId={selectedFeatureId} onFeatureSelect={onFeatureSelect} ariaLabel={ariaLabel} />;
}
