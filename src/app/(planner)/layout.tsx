import { MAP_CONTEXT_URL } from "@/maps/mapAssets";
import "maplibre-gl/dist/maplibre-gl.css";
import "../explorer.css";
import "../explorer-polish.css";
import "../package-options.css";
import "../finetune-polish.css";
import "../drawer-polish.css";
import "../recovery-polish.css";
import "../transition-polish.css";

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="preload"
        href={MAP_CONTEXT_URL}
        as="fetch"
        type="application/geo+json"
        crossOrigin="anonymous"
      />
      {children}
    </>
  );
}
