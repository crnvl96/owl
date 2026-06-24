import type { Metadata, Viewport } from "next";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: false,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "DiffsHub, from Pierre",
    template: "%s",
  },
};

export { RootLayout as default } from "@/components/RootLayout";
