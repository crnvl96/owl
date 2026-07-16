import {
  type CodeViewItem,
  type CodeViewLineSelection,
  type CodeViewOptions,
  type SelectedLineRange,
  type ThemeTypes,
} from "@pierre/diffs";
import { type CodeViewHandle, useStableCallback } from "@pierre/diffs/react";
import { memo, type RefObject, useMemo, useState } from "react";

import { ThemedCodeView } from "@/components/diff/ThemedCodeView";
import { useChromeThemeProps } from "@/hooks/useChromeThemeProps";
import { buildAnnotationThemeStyle } from "@/lib/annotationThemeStyle";
import { CODE_VIEW_CUSTOM_CSS, CODE_VIEW_LAYOUT } from "@/lib/config";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type { CommentMetadata } from "@/lib/types";
import styles from "./Viewer.module.css";

interface ViewerProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  themeType: ThemeTypes;
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>;
  initialItems: CodeViewItem<CommentMetadata>[];
  onLineLinkChange(selection: CodeViewLineSelection | null): void;
  onViewerReady(): void;
}

export const Viewer = memo(function Viewer({
  scrollRef,
  themeType,
  viewerRef,
  initialItems,
  onLineLinkChange,
  onViewerReady,
}: ViewerProps) {
  const [selectedLines, setSelectedLines] = useState<CodeViewLineSelection | null>(null);
  const { style: chromeStyle } = useChromeThemeProps(owlChromeMapping);
  const themeChromeStyle = Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined;
  const annotationThemeStyle = useMemo(
    () => buildAnnotationThemeStyle(themeChromeStyle),
    [themeChromeStyle],
  );

  const handleSetSelection = useStableCallback(
    (selection: CodeViewLineSelection | null) => setSelectedLines(selection),
  );

  const handleLineSelectionEnd = useStableCallback(
    (range: SelectedLineRange | null, item: CodeViewItem<CommentMetadata>) => {
      onLineLinkChange(range == null ? null : { id: item.id, range });
    },
  );

  const handleViewerRef = useStableCallback(
    (viewer: CodeViewHandle<CommentMetadata> | null) => {
      viewerRef.current = viewer;
      if (viewer != null) onViewerReady();
    },
  );

  const options: CodeViewOptions<CommentMetadata> = useMemo(
    () =>
      ({
        layout: CODE_VIEW_LAYOUT,
        themeType,
        diffStyle: "unified",
        diffIndicators: "none",
        overflow: "scroll",
        disableBackground: false,
        disableLineNumbers: false,
        lineHoverHighlight: "number",
        enableLineSelection: true,
        stickyHeaders: true,
        unsafeCSS: CODE_VIEW_CUSTOM_CSS,
        onLineSelectionEnd(range, context) {
          handleLineSelectionEnd(range, context.item);
        },
      }) satisfies CodeViewOptions<CommentMetadata>,
    [handleLineSelectionEnd, themeType],
  );

  return (
    <ThemedCodeView<CommentMetadata>
      ref={handleViewerRef}
      containerRef={scrollRef}
      initialItems={initialItems}
      className={styles.viewer}
      options={options}
      style={annotationThemeStyle}
      selectedLines={selectedLines}
      onSelectedLinesChange={handleSetSelection}
    />
  );
});
