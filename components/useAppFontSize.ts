"use client";

import { useEffect } from "react";

import { APP_FONT_SIZE_CSS_VARIABLE } from "@/lib/appFontSize";

// Mirrors the value onto <html> as a CSS custom property, so the
// `html { font-size: var(--owl-app-font-size, 16px) }` rule in globals.css
// picks it up. Setting the size on the root (not the body) is what makes
// Tailwind v4's rem-based typography scale follow the user's choice — `rem`
// resolves against the root element's font-size. globals.css also derives
// `--diffs-font-size`, `--diffs-line-height`, and
// `--trees-font-size-override` from this variable, so the diff body and
// the file tree scale proportionally too. Runs once on mount (with the
// initial value) and on every subsequent change.
export function useAppFontSize(value: number): void {
  useEffect(() => {
    document.documentElement.style.setProperty(
      APP_FONT_SIZE_CSS_VARIABLE,
      `${value}px`,
    );
  }, [value]);
}
