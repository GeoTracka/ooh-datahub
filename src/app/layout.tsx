import type { Metadata } from "next";
import { ModalFocusContainment } from "@/features/ModalFocusContainment";
import { MAP_CONTEXT_URL } from "@/maps/mapAssets";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./explorer.css";
import "./explorer-polish.css";
import "./package-options.css";
import "./finetune-polish.css";
import "./drawer-polish.css";
import "./recovery-polish.css";
import "./transition-polish.css";

export const metadata: Metadata = {
  title: "OOH Promotion Wizard",
  description: "Evidence-labelled campaign planning demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href={MAP_CONTEXT_URL}
          as="fetch"
          type="application/geo+json"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ModalFocusContainment />
        {children}
      </body>
    </html>
  );
}
