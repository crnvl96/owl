"use client";

import { FileDiff, type FileDiffProps } from "@pierre/diffs/react";
import { useMemo } from "react";

import { useDiffThemeProps } from "@/hooks/useDiffThemeProps";
import { useWorkerDiffTheme } from "@/hooks/useWorkerDiffTheme";

// Sugar over useDiffThemeProps: applies the active theme names + themeType to
// the React <FileDiff> options and keeps the worker pool in step when present.
export function ThemedFileDiff<LAnnotation = undefined>({
  disableWorkerPool = false,
  options,
  ...props
}: FileDiffProps<LAnnotation>) {
  const diffTheme = useDiffThemeProps();
  useWorkerDiffTheme(diffTheme.theme, disableWorkerPool);
  const themedOptions = useMemo(
    () => ({
      ...options,
      theme: diffTheme.theme,
      themeType: options?.themeType ?? diffTheme.themeType,
    }),
    [diffTheme, options],
  );
  return (
    <FileDiff<LAnnotation>
      {...props}
      disableWorkerPool={disableWorkerPool}
      options={themedOptions}
    />
  );
}
