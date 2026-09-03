"use client";

import dynamic from "next/dynamic";
import { Layers3 } from "lucide-react";

import { frozenLagosBundle } from "@/bundle/loadFrozenBundle";

const CampaignMapClient = dynamic(() => import("./CampaignMapClient"), {
  ssr: false,
  loading: () => <div className="ai-map-loading">Loading campaign map…</div>,
});

export function CampaignMapView({ siteIds }: { siteIds: string[] }) {
  const sites = siteIds.flatMap((id) => {
    const site = frozenLagosBundle.sites.find((value) => value.id === id);
    return site ? [site] : [];
  });
  return (
    <section className="ai-map-view">
      <header><div><span className="ai-eyebrow">Real inventory</span><h2>Campaign locations</h2></div><button className="ai-icon-text"><Layers3 size={16} />Map layers</button></header>
      {sites.length ? <CampaignMapClient siteIds={siteIds} /> : <p>The map is unavailable, but your selected locations are still listed below.</p>}
      <table aria-label="Campaign locations">
        <thead><tr><th>Location</th><th>Area</th><th>Format</th><th>Planned cost</th></tr></thead>
        <tbody>{sites.map((site) => <tr key={site.id}><td>{site.label}</td><td>{frozenLagosBundle.zones.find((zone) => zone.id === site.zoneId)?.label}</td><td>{site.format === "dooh" ? "Digital" : "Static"}</td><td>₦{site.rateNgn.toLocaleString("en-NG")}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
