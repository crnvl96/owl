'use client';

import {
  createThemeResolver,
  type ThemeLike,
  type ThemeResolver,
} from '@pierre/theming';
import { shikiThemes } from '@pierre/theming/themes';
import { useEffect, useState } from 'react';

import { ACTIVE_THEME_NAME } from '@/lib/theme/activeTheme';

// One resolver per process. The Shiki collection carries the theme loaders
// (dynamic imports of each `@shikijs/themes/*` package); registerInto wires
// them into the resolver so resolveTheme('night-owl') knows how to load it.
// createThemeResolver also owns its own resolved-theme cache, so all
// consumers share the same in-flight + cached load.
let sharedResolver: ThemeResolver | undefined;
function getSharedResolver(): ThemeResolver {
  if (sharedResolver == null) {
    sharedResolver = createThemeResolver();
    shikiThemes.registerInto(sharedResolver);
  }
  return sharedResolver;
}

// Returns the resolved `night-owl` theme, or undefined while it's still
// loading. Resolves on first call (synchronous if the resolver already has it
// cached, async otherwise) and re-renders the consumer once it settles.
export function useActiveTheme(): ThemeLike | undefined {
  const resolver = getSharedResolver();
  const [theme, setTheme] = useState<ThemeLike | undefined>(() =>
    resolver.getResolvedTheme(ACTIVE_THEME_NAME)
  );
  useEffect(() => {
    if (theme != null) return;
    let cancelled = false;
    resolver.resolveTheme(ACTIVE_THEME_NAME).then((resolved) => {
      if (!cancelled) setTheme(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [resolver, theme]);
  return theme;
}
