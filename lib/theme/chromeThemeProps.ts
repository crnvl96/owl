// Stays app-local. Pure mapping from the resolved active theme to a chrome CSS
// style. Runs deriveChromeTokens on the active theme and hands the derived
// tokens to a caller-supplied mapping (diffshub uses diffshubChromeMapping).
// Returns a spreadable { style } that is an empty object until a theme resolves.
import type { ColorScheme, ThemeLike } from "@pierre/theming";
import type { CSSProperties } from "react";

import { deriveChromeTokens } from "./deriveChromeTokens";
import type { ChromeMapping } from "./diffshubChromeMapping";

export type { ChromeMapping };

// The minimal shape the chrome mapper needs from a theme snapshot. Slimmed
// down from the old ActiveThemeSnapshot once the source/provider abstraction
// went away — every consumer now passes the same {theme, colorScheme} pair.
export interface ChromeThemeInput {
  colorScheme: ColorScheme;
  theme: ThemeLike;
}

export function chromeThemeProps(
  active: ChromeThemeInput,
  mapping: ChromeMapping,
): { style: CSSProperties } {
  const { theme } = active;
  if (theme == null) return { style: {} };
  return { style: mapping(deriveChromeTokens(theme), theme) ?? {} };
}
