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
  const legend = scene.features.find((feature) => feature.visual)?.visual ?? null;
  return (
    <section className="explorer-map-stage" aria-label="Campaign map">
      <MapCanvas
        scene={scene}
        selectedFeatureId={selectedFeatureId}
        onFeatureSelect={onFeatureSelect}
      />
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
