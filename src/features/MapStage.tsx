import type { MapLibreScene } from "@/contracts/renderer";
import { MapCanvas } from "@/maps/MapCanvas";

export function MapStage({
  scene,
  selectedFeatureId,
  onFeatureSelect,
}: {
  scene: MapLibreScene;
  selectedFeatureId: string | null;
  onFeatureSelect(featureId: string): void;
}) {
  return (
    <section className="explorer-map-stage" aria-label="Campaign map">
      <MapCanvas
        scene={scene}
        selectedFeatureId={selectedFeatureId}
        onFeatureSelect={onFeatureSelect}
      />
      <div className="explorer-map-note">
        Planning context · not navigation
      </div>
    </section>
  );
}
