import { Geist } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { PreloadHighlighter } from "@/components/PreloadHighlighter";
import { ScrollbarGutterVariables } from "@/components/ScrollbarGutterVariables";
import { Toaster } from "@/components/Toaster";
import { WorkerPoolContext } from "@/components/WorkerPoolContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const berkeleyMono = localFont({
  src: "../public/fonts/BerkeleyMonoVariable.woff2",
  variable: "--font-berkeley-mono",
});

export function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    // `dark` is hardcoded — night-owl is the only theme. globals.css scopes
    // its dark tokens to `.dark`, so this is what makes the body pick them up.
    <html lang="en" className={`dark ${berkeleyMono.variable} ${geistSans.variable}`}>
      <body className="owl">
        <ScrollbarGutterVariables />
        <WorkerPoolContext>{children}</WorkerPoolContext>
        <Toaster />
        <PreloadHighlighter />
      </body>
    </html>
  );
}
