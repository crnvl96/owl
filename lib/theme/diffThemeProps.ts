// → future @pierre/diffs. Names-now mapping: produces the spreadable
// { theme, themeType } pair the diffs package consumes. The pair is built
// from the single hardcoded active theme (see lib/theme/activeTheme); there
// is no per-call override path anymore.
import { type DiffsThemeNames, type ThemesType, type ThemeTypes } from "@pierre/diffs";

import { ACTIVE_THEME_NAME, ACTIVE_THEME_SCHEME } from "./activeTheme";

export function diffThemeProps(): {
  theme: ThemesType;
  themeType: ThemeTypes;
} {
  return {
    theme: {
      dark: ACTIVE_THEME_NAME as DiffsThemeNames,
      light: ACTIVE_THEME_NAME as DiffsThemeNames,
    },
    themeType: ACTIVE_THEME_SCHEME,
  };
}
