import type { Metadata } from "next";
import { ModalFocusContainment } from "@/features/ModalFocusContainment";
import { MAP_CONTEXT_URL } from "@/maps/mapAssets";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { PUBLIC_COPY } from "@/content/plainLanguage";
import "./explorer.css";
import "./explorer-polish.css";
import "./package-options.css";
import "./finetune-polish.css";
import "./drawer-polish.css";
import "./recovery-polish.css";
import "./transition-polish.css";

export const metadata: Metadata = {
  title: PUBLIC_COPY.metadata.title,
  description: PUBLIC_COPY.metadata.description,
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
