'use client';

import { type CSSProperties, useMemo } from 'react';

import { useActiveTheme } from './useActiveTheme';
import {
  type ChromeMapping,
  chromeThemeProps,
} from '@/lib/theme/chromeThemeProps';

export type { ChromeMapping };

// Returns the spreadable chrome style props for the active (night-owl) theme,
// mapped to the app's CSS variables by the supplied mapping. Empty object
// until the theme has resolved.
export function useChromeThemeProps(
  mapping: ChromeMapping
): { style: CSSProperties } {
  const theme = useActiveTheme();
  return useMemo(
    () => (theme != null ? chromeThemeProps({ theme, colorScheme: 'dark' }, mapping) : { style: {} }),
    [theme, mapping]
  );
}
