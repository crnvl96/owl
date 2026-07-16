import {
  type CodeViewItem,
  type CodeViewLineSelection,
  type CodeViewOptions,
  type SelectedLineRange,
  type ThemeTypes,
} from "@pierre/diffs";
import { type CodeViewHandle, useStableCallback } from "@pierre/diffs/react";
import { memo, type RefObject, useMemo, useState } from "react";

import { ThemedCodeView } from "./ThemedCodeView";
import { useChromeThemeProps } from "./useChromeThemeProps";
import { buildAnnotationThemeStyle } from "@/lib/annotationThemeStyle";
import { cn } from "@/lib/cn";
import { CODE_VIEW_CUSTOM_CSS, CODE_VIEW_LAYOUT } from "@/lib/constants";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type { CommentMetadata } from "@/lib/types";

interface OwlViewerProps {
  className?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  themeType: ThemeTypes;
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>;
  initialItems: CodeViewItem<CommentMetadata>[];
  onLineLinkChange(selection: CodeViewLineSelection | null): void;
  onViewerReady(): void;
}

export const OwlViewer = memo(function OwlViewer({
  className,
  scrollRef,
  themeType,
  viewerRef,
  initialItems,
  onLineLinkChange,
  onViewerReady,
}: OwlViewerProps) {
  const [selectedLines, setSelectedLines] = useState<CodeViewLineSelection | null>(
    null,
  );
  const { style: chromeStyle } = useChromeThemeProps(owlChromeMapping);
  const themeChromeStyle =
    Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined;
  const annotationThemeStyle = useMemo(
    () => buildAnnotationThemeStyle(themeChromeStyle),
    [themeChromeStyle],
  );

  const handleSetSelection = useStableCallback(
    (selection: CodeViewLineSelection | null) => {
      setSelectedLines(selection);
    },
  );

  const handleLineSelectionEnd = useStableCallback(
    (range: SelectedLineRange | null, item: CodeViewItem<CommentMetadata>) => {
      // The line-hash deep link lets the user share a URL anchored at a
      // specific line. Clear the link only when the selection itself was
      // cleared.
      if (range == null) {
        onLineLinkChange(null);
      } else {
        onLineLinkChange({ id: item.id, range });
      }
    },
  );

  const handleViewerRef = useStableCallback(
    (viewer: CodeViewHandle<CommentMetadata> | null) => {
      viewerRef.current = viewer;
      if (viewer != null) {
        onViewerReady();
      }
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
      className={cn(
        className,
        "cv-scrollbar relative h-full min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-clip overscroll-contain border-b border-border w-full [contain:strict] [overflow-anchor:none] [will-change:scroll-position] md:border-b-0 [&_diffs-container]:overflow-clip [&_diffs-container]:[contain:layout_paint_style] [&_diffs-container]:shadow-[0_-1px_0_var(--owl-diff-separator,var(--color-border-opaque)),0_1px_0_var(--owl-diff-separator,var(--color-border-opaque))]",
      )}
      options={options}
      style={annotationThemeStyle}
      selectedLines={selectedLines}
      onSelectedLinesChange={handleSetSelection}
    />
  );
});
