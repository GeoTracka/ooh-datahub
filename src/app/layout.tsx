import type { Metadata } from "next";
import { ModalFocusContainment } from "@/features/ModalFocusContainment";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./explorer.css";
import "./explorer-polish.css";
import "./finetune-polish.css";
import "./drawer-polish.css";

export const metadata: Metadata = {
  title: "OOH Promotion Wizard",
  description: "Evidence-labelled campaign planning demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ModalFocusContainment />
        {children}
      </body>
    </html>
  );
}
