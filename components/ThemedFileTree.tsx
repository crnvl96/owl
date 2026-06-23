'use client';

import { FileTree, type FileTreeProps } from '@pierre/trees/react';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';

import { useTreeThemeProps } from './useTreeThemeProps';

interface ThemedFileTreeProps extends FileTreeProps {
  // Preserves the contrast-based foreground upgrade the file rows depend on.
  reconcileForegroundFromChrome?: boolean;
}

// Sugar over useTreeThemeProps: applies the active theme's tree styles to the
// React <FileTree>. Caller `style` (spread after) still wins on key collisions.
export function ThemedFileTree({
  reconcileForegroundFromChrome,
  style,
  ...props
}: ThemedFileTreeProps) {
  const themeProps = useTreeThemeProps({ reconcileForegroundFromChrome });
  const mergedStyle = useMemo(
    () => ({ ...themeProps.style, ...style }) as CSSProperties,
    [themeProps.style, style]
  );
  return <FileTree {...props} style={mergedStyle} />;
}
