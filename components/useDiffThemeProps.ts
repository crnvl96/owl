"use client";

import type { ThemesType, ThemeTypes } from "@pierre/diffs";

import { ACTIVE_THEME_NAME, ACTIVE_THEME_SCHEME } from "@/lib/theme/activeTheme";

// The single diff theme pair (pierre-dark-soft for both light and dark slots;
// the active scheme below picks which to render). Kept as a hook so callers
// don't have to know it's a constant.
export function useDiffThemeProps(): {
  theme: ThemesType;
  themeType: ThemeTypes;
} {
  return {
    theme: { dark: ACTIVE_THEME_NAME, light: ACTIVE_THEME_NAME },
    themeType: ACTIVE_THEME_SCHEME,
  };
}
