"use client";

import type { ThemesType, ThemeTypes } from "@pierre/diffs";

import { THEME_NAME, THEME_SCHEME } from "@/lib/config";

// The single diff theme pair (pierre-dark-soft for both light and dark slots;
// the active scheme below picks which to render). Kept as a hook so callers
// don't have to know it's a constant.
export function useDiffThemeProps(): {
  theme: ThemesType;
  themeType: ThemeTypes;
} {
  return {
    theme: { dark: THEME_NAME, light: THEME_NAME },
    themeType: THEME_SCHEME,
  };
}
