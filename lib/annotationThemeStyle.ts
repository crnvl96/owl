import type { CSSProperties } from "react";

const ANNOTATION_THEME_STYLE_KEYS = [
  "--owl-annotation-bg",
  "--owl-annotation-border",
  "--owl-annotation-fg",
  "--owl-annotation-hover-border",
  "--owl-annotation-shadow",
  "--owl-popover-muted-fg",
  // Inter-file separator hairline. Carries the themed border-opaque value
  // (same weight as the header/sidebar chrome borders) so it stays visible
  // on any theme without reading darker than the surrounding chrome.
  "--owl-diff-separator",
  // Main scrollbar thumb + gutter tint; this element is the cv-scrollbar host.
  "--owl-scrollbar-thumb-bg",
  "--owl-scrollbar-track-bg",
] as const;

export function buildAnnotationThemeStyle(
  themeChromeStyle: CSSProperties | undefined,
): CSSProperties | undefined {
  if (themeChromeStyle == null) {
    return undefined;
  }

  const source = themeChromeStyle as CSSProperties &
    Partial<Record<(typeof ANNOTATION_THEME_STYLE_KEYS)[number], string>>;
  const style: Record<string, string> = {};
  for (const key of ANNOTATION_THEME_STYLE_KEYS) {
    const value = source[key];
    if (typeof value === "string") {
      style[key] = value;
    }
  }

  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}
