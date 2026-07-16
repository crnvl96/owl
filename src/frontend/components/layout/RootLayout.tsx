import type { ReactNode } from "react";

import { PreloadHighlighter } from "@/components/layout/PreloadHighlighter";
import { ScrollbarGutterVariables } from "@/components/layout/ScrollbarGutterVariables";
import { Toaster } from "@/components/atoms/Toaster";
import { WorkerPoolContext } from "@/components/layout/WorkerPoolContext";

// Inner layout shell — providers, chrome, and scaffolding. The HTML document
// shell (including font loading and CSS variable setup) lives in index.html.
export function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ScrollbarGutterVariables />
      <WorkerPoolContext>{children}</WorkerPoolContext>
      <Toaster />
      <PreloadHighlighter />
    </>
  );
}
