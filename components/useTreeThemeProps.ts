"use client";

import type { TreeThemeStyles } from "@pierre/trees";
import { useMemo } from "react";

import { useActiveTheme } from "./useActiveTheme";
import { treeThemeProps, type TreeThemePropsOptions } from "@/lib/theme/treeThemeProps";

// Returns the spreadable FileTree style props for the active (pierre-dark-soft)
// theme. Pass reconcileForegroundFromChrome to preserve the contrast-based
// foreground upgrade the file rows depend on.
export function useTreeThemeProps(options?: TreeThemePropsOptions): {
  style: TreeThemeStyles;
} {
  const theme = useActiveTheme();
  const reconcile = options?.reconcileForegroundFromChrome ?? false;
  return useMemo(
    () =>
      theme == null
        ? { style: {} as TreeThemeStyles }
        : treeThemeProps(
            { theme, colorScheme: "dark" },
            { reconcileForegroundFromChrome: reconcile },
          ),
    [theme, reconcile],
  );
}
