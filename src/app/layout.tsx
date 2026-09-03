import type { Metadata } from "next";
import { ModalFocusContainment } from "@/features/ModalFocusContainment";
import "./globals.css";
import { PUBLIC_COPY } from "@/content/plainLanguage";

export const metadata: Metadata = {
  title: PUBLIC_COPY.metadata.title,
  description: PUBLIC_COPY.metadata.description,
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
