"use client";

import { useMemo, useState } from "react";

import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";
import type { MapLibreScene } from "@/contracts/renderer";
import { MapCanvas } from "@/maps/MapCanvas";

export default function CampaignMapClient({ siteIds }: { siteIds: string[] }) {
  const [selected, setSelected] = useState<string | null>(siteIds[0] ?? null);
  const sites = useMemo(
    () => siteIds.flatMap((id) => {
      const site = frozenLagosBundle.sites.find((value) => value.id === id);
      return site ? [site] : [];
    }),
    [siteIds],
  );
  const scene: MapLibreScene = {
    kind: "maplibre",
    features: sites.map((site, index) => ({
      id: site.id,
      coordinate: site.coordinate,
      sourceProduct: "Owned inventory",
      visual: {
        label: site.label,
        metricLabel: "Campaign location",
        value: index + 1,
        unit: "rank",
        evidenceLabel: "Current inventory record",
      },
    })),
    attributionIds: [],
  };
  return (
    <div className="ai-map-frame" role="region" aria-label="Campaign map">
      <MapCanvas
        scene={scene}
        selectedFeatureId={selected}
        onFeatureSelect={setSelected}
        ariaLabel="Campaign map"
      />
      <div className="ai-map-legend"><span /> Campaign locations · {sites.length}</div>
    </div>
  );
}
