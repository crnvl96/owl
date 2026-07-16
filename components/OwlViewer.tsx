import {
  areSelectionsEqual,
  type AnnotationSide,
  type CodeViewItem,
  type CodeViewLineSelection,
  type CodeViewOptions,
  type DiffLineAnnotation,
  type LineAnnotation,
  type SelectedLineRange,
  type ThemeTypes,
} from "@pierre/diffs";
import { type CodeViewHandle, useStableCallback } from "@pierre/diffs/react";
import { IconChevronSm } from "@pierre/icons";
import { memo, type RefObject, useMemo, useRef, useState } from "react";

import { DraftAnnotation } from "./DraftAnnotation";
import { ExampleAnnotation } from "./ExampleAnnotation";
import { ThemedCodeView } from "./ThemedCodeView";
import { useChromeThemeProps } from "./useChromeThemeProps";
import { buildAnnotationThemeStyle } from "@/lib/annotationThemeStyle";
import { classifyCommentLineType } from "@/lib/classifyCommentLineType";
import { cn } from "@/lib/cn";
import { CODE_VIEW_CUSTOM_CSS, CODE_VIEW_LAYOUT } from "@/lib/constants";
import { isDiffItem } from "@/lib/isDiffItem";
import { isDraftAnnotation } from "@/lib/isDraftAnnotation";
import { isDraftMetadata } from "@/lib/isDraftMetadata";
import { isSavedAnnotation } from "@/lib/isSavedAnnotation";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type {
  CommentMetadata,
  DraftCommentMetadata,
  OwlDeletedCommentEvent,
  OwlSavedCommentEvent,
} from "@/lib/types";

function getNextItemVersion(item: CodeViewItem<CommentMetadata>): number {
  return typeof item.version === "number" ? item.version + 1 : 1;
}

// Resolves the `side` of a draft/saved comment on a diff item. The
// `SelectedLineRange` carries `side` (and `endSide` for multi-line
// ranges) when the selection was made on a diff, but those fields are
// optional at the type level. For a diff item the draft annotation
// itself was created with a non-optional `side`; using that as the
// fallback guarantees we always hand `classifyCommentLineType` (and
// downstream consumers) a real `AnnotationSide` even if the range's
// `side` is `undefined` for any reason.
function resolveDiffSide(
  range: SelectedLineRange,
  draftAnnotation:
    | DiffLineAnnotation<DraftCommentMetadata>
    | LineAnnotation<DraftCommentMetadata>,
): AnnotationSide {
  if (range.endSide != null) {
    return range.endSide;
  }
  if (range.side != null) {
    return range.side;
  }
  return (draftAnnotation as DiffLineAnnotation<DraftCommentMetadata>).side;
}

// Generic replacement for the old `updateViewerDiffItem` that also
// accepts file items. Both item shapes support `version` + `annotations`
// updates; the updater callback decides what to mutate, and the helper
// only handles the version bump and the `updateItem` call so callers
// stay focused on the annotation logic.
function updateViewerItem(
  viewer: CodeViewHandle<CommentMetadata>,
  itemId: string,
  updateItem: (item: CodeViewItem<CommentMetadata>) => boolean,
): CodeViewItem<CommentMetadata> | undefined {
  const item = viewer.getItem(itemId);
  if (item == null) {
    return undefined;
  }

  if (!updateItem(item)) {
    return undefined;
  }

  item.version = getNextItemVersion(item);
  return viewer.updateItem(item) ? item : undefined;
}

interface ActiveDraftComment {
  itemId: string;
  key: string;
}

interface OwlViewerProps {
  className?: string;
  diffStyle: "split" | "unified";
  onCommentDeleted(comment: OwlDeletedCommentEvent): void;
  onCommentSaved(comment: OwlSavedCommentEvent): void;
  overflow: "wrap" | "scroll";
  scrollRef: RefObject<HTMLDivElement | null>;
  themeType: ThemeTypes;
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>;
  initialItems: CodeViewItem<CommentMetadata>[];
  onLineLinkChange(selection: CodeViewLineSelection | null): void;
  onViewerReady(): void;
}

export const OwlViewer = memo(function OwlViewer({
  className,
  diffStyle,
  onCommentDeleted,
  onCommentSaved,
  overflow,
  scrollRef,
  themeType,
  viewerRef,
  initialItems,
  onLineLinkChange,
  onViewerReady,
}: OwlViewerProps) {
  const nextCommentKeyRef = useRef(0);
  const activeDraftRef = useRef<ActiveDraftComment | null>(null);
  const [selectedLines, setSelectedLines] = useState<CodeViewLineSelection | null>(
    null,
  );
  const { style: chromeStyle } = useChromeThemeProps(owlChromeMapping);
  // Preserve the previous `undefined`-means-not-resolved contract that
  // buildAnnotationThemeStyle and the className fallbacks depend on.
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

  const handleToggleCommentSelection = useStableCallback(
    (selection: CodeViewLineSelection) => {
      setSelectedLines((prev) =>
        prev?.id === selection.id && areSelectionsEqual(prev.range, selection.range)
          ? null
          : selection,
      );
    },
  );

  const handleLineSelectionEnd = useStableCallback(
    (range: SelectedLineRange | null, item: CodeViewItem<CommentMetadata>) => {
      // The line-hash deep link is meaningful for both diff and file items:
      // it lets the user share a URL anchored at a specific line. Clear
      // the link only when the selection itself was cleared.
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

  const handleCreateDraftComment = useStableCallback(
    (range: SelectedLineRange, itemId: string) => {
      const lineNumber = range.end;
      const commentKey = `draft-${nextCommentKeyRef.current++}`;
      const { current: viewer } = viewerRef;
      if (viewer == null) {
        return;
      }

      // Look up the target item so we can pick the right annotation shape.
      // Diff items need a `side` (validated by the CodeView's diff gutter);
      // file items get a plain `LineAnnotation` because there is no
      // left/right distinction. The viewer handle is the only source of
      // truth for the current item type, since the type can change between
      // renders for the same id.
      const targetItem = viewer.getItem(itemId);
      if (targetItem == null) {
        return;
      }

      let draftAnnotation:
        | DiffLineAnnotation<CommentMetadata>
        | LineAnnotation<CommentMetadata>;
      if (isDiffItem(targetItem)) {
        const side = range.endSide ?? range.side;
        if (side == null) {
          return;
        }
        draftAnnotation = {
          side,
          lineNumber,
          metadata: {
            kind: "draft",
            key: commentKey,
            message: "",
            range,
          },
        };
      } else {
        // File items: no `side` on the range, no `side` on the annotation.
        // The metadata is otherwise identical so the rest of the pipeline
        // (save, render, sidebar) can be shared.
        draftAnnotation = {
          lineNumber,
          metadata: {
            kind: "draft",
            key: commentKey,
            message: "",
            range,
          },
        };
      }

      const { current: activeDraft } = activeDraftRef;
      if (activeDraft != null && activeDraft.itemId !== itemId) {
        updateViewerItem(viewer, activeDraft.itemId, (item) => {
          if (item.annotations == null) {
            return false;
          }

          const nextAnnotations = item.annotations.filter(
            (annotation) => annotation.metadata.key !== activeDraft.key,
          );
          if (nextAnnotations.length === item.annotations.length) {
            return false;
          }

          item.annotations = nextAnnotations;
          return true;
        });
      }

      const updatedItem = updateViewerItem(viewer, itemId, (item) => {
        const nonDraftAnnotations = (item.annotations ?? []).filter(
          (annotation) => !isDraftMetadata(annotation.metadata),
        );
        item.annotations = [...nonDraftAnnotations, draftAnnotation];
        return true;
      });

      if (updatedItem != null) {
        activeDraftRef.current = { itemId, key: commentKey };
      }
    },
  );

  const handleRemoveComment = useStableCallback((itemId: string, key: string) => {
    const { current: viewer } = viewerRef;
    if (viewer == null) {
      return;
    }
    const existingItem = viewer.getItem(itemId);
    // Annotations live on the item regardless of whether it's a diff or
    // a file item, so the lookup is type-agnostic. The returned annotation
    // is whatever shape the viewer stored (DiffLineAnnotation or
    // LineAnnotation); we only need it to detect a saved vs draft remove.
    const removedAnnotation = existingItem?.annotations?.find(
      (annotation) => annotation.metadata.key === key,
    );

    updateViewerItem(viewer, itemId, (item) => {
      if (item.annotations == null) {
        return false;
      }

      const nextAnnotations = item.annotations.filter(
        (annotation) => annotation.metadata.key !== key,
      );

      if (nextAnnotations.length === item.annotations.length) {
        return false;
      }

      item.annotations = nextAnnotations;
      return true;
    });

    const { current: activeDraft } = activeDraftRef;
    if (activeDraft?.itemId === itemId && activeDraft.key === key) {
      activeDraftRef.current = null;
    }

    setSelectedLines(null);
    onLineLinkChange(null);
    if (removedAnnotation != null && isSavedAnnotation(removedAnnotation)) {
      onCommentDeleted({ itemId, key });
    }
  });

  const handleSaveDraftComment = useStableCallback(
    (itemId: string, key: string, message: string) => {
      const trimmedMessage = message.trim();
      const { current: viewer } = viewerRef;
      if (trimmedMessage.length === 0 || viewer == null) {
        return;
      }

      const existingItem = viewer.getItem(itemId);
      if (existingItem == null) {
        return;
      }

      const draftAnnotation = existingItem.annotations?.find(
        (annotation) => annotation.metadata.key === key,
      );
      if (draftAnnotation == null || !isDraftAnnotation(draftAnnotation)) {
        return;
      }

      // The annotation upgrade (draft -> saved) needs to preserve the
      // shape of the surrounding annotations array, which differs by item
      // type: diff items hold `DiffLineAnnotation<CommentMetadata>[]`
      // (with `side`), file items hold `LineAnnotation<CommentMetadata>[]`
      // (without). The upgrade is structurally identical otherwise, so
      // we branch on the item type and only assert the new annotation's
      // shape in the case where TypeScript can't infer it through a
      // spread of a `Draft` variant back into a `Saved` variant.
      const upgradeMetadata = {
        kind: "saved" as const,
        key,
        message: trimmedMessage,
        range: draftAnnotation.metadata.range,
      };

      const updatedItem = updateViewerItem(viewer, itemId, (item) => {
        if (isDiffItem(item)) {
          // Diff items: `item.annotations` is `DiffLineAnnotation<CommentMetadata>[] | undefined`.
          // The `null` check narrows it to the array form, and the map
          // callback's explicit return annotation prevents the spread +
          // new metadata from widening the element type to a union.
          const annotations = item.annotations;
          if (annotations == null) {
            return false;
          }
          const nextAnnotations: DiffLineAnnotation<CommentMetadata>[] =
            annotations.map((annotation): DiffLineAnnotation<CommentMetadata> => {
              if (annotation.metadata.key !== key || !isDraftAnnotation(annotation)) {
                return annotation;
              }
              return {
                ...annotation,
                metadata: upgradeMetadata,
              };
            });
          if (nextAnnotations.every((a, i) => a === annotations[i])) {
            return false;
          }
          item.annotations = nextAnnotations;
          return true;
        }

        // File items: `LineAnnotation<CommentMetadata>[] | undefined`. No
        // `side` to preserve. Same upgrade shape, no `side` in the
        // return.
        const annotations = item.annotations;
        if (annotations == null) {
          return false;
        }
        const nextAnnotations: LineAnnotation<CommentMetadata>[] = annotations.map(
          (annotation): LineAnnotation<CommentMetadata> => {
            if (annotation.metadata.key !== key || !isDraftAnnotation(annotation)) {
              return annotation;
            }
            return {
              ...annotation,
              metadata: upgradeMetadata,
            };
          },
        );
        if (nextAnnotations.every((a, i) => a === annotations[i])) {
          return false;
        }
        item.annotations = nextAnnotations;
        return true;
      });

      if (updatedItem == null) {
        return;
      }

      const { current: activeDraft } = activeDraftRef;
      if (activeDraft?.itemId === itemId && activeDraft.key === key) {
        activeDraftRef.current = null;
      }

      setSelectedLines(null);
      onLineLinkChange(null);
      // The annotation box is anchored at `range.end` so it sits at the last
      // line of the selection, but the saved comment's `lineNumber` is the
      // start of the range — that's the line the sidebar lists the comment
      // under and the line that drives sort order, so it should reflect
      // where the selection begins rather than where the annotation is
      // rendered. The full range is preserved in `range` for display and
      // for re-selecting on click.
      const savedRange = draftAnnotation.metadata.range;
      const startLine = savedRange.start;
      // File items don't have an addition/deletion distinction, so their
      // comments are always classified as `context` (no `+`/`-` sigil in
      // the sidebar label). Diff items go through the hunk-aware
      // classifier to decide whether the line is an actual change or a
      // context line in the diff. We narrow on `isDiffItem` so the
      // `fileDiff` access type-checks correctly, and cast the
      // `draftAnnotation` once we know it's a diff-side annotation
      // (its `side` is the one the viewer used to render it).
      const lineType: OwlSavedCommentEvent["lineType"] = isDiffItem(existingItem)
        ? classifyCommentLineType(
            existingItem.fileDiff,
            resolveDiffSide(savedRange, draftAnnotation),
            startLine,
          )
        : "context";
      // `side` is only meaningful for diff items. For file items, the
      // `OwlSavedCommentEvent` type models it as optional and the report
      // generator + sidebar both already handle the `undefined` case, so
      // we just leave it off.
      const side: OwlSavedCommentEvent["side"] = isDiffItem(existingItem)
        ? (draftAnnotation as DiffLineAnnotation<DraftCommentMetadata>).side
        : undefined;

      onCommentSaved({
        itemId,
        key,
        lineNumber: startLine,
        lineType,
        message: trimmedMessage,
        range: savedRange,
        side,
      });
    },
  );

  const handleToggleItemCollapsed = useStableCallback((itemId: string) => {
    const { current: viewerHandle } = viewerRef;
    const viewer = viewerHandle?.getInstance();
    const item = viewerHandle?.getItem(itemId);
    if (viewerHandle == null || viewer == null || item == null) {
      return;
    }

    // NOTE(amadeus): If the top of the item is before the scrollTop, then
    // we'll want to apply a scroll fix on the next render to ensure we
    // keep the collapsed file in view and anchored.
    const itemTop = viewer.getTopForItem(itemId);
    item.collapsed = item.collapsed !== true;
    item.version = getNextItemVersion(item);
    if (!viewerHandle.updateItem(item)) {
      return;
    }

    if (itemTop != null && itemTop < viewer.getScrollTop()) {
      viewer.scrollTo({
        type: "item",
        id: item.id,
        align: "start",
      });
    }
  });

  const renderCommentAnnotation = useStableCallback(
    (
      annotation: DiffLineAnnotation<CommentMetadata> | LineAnnotation<CommentMetadata>,
      item: CodeViewItem<CommentMetadata>,
    ) => {
      // The viewer hands us a `DiffLineAnnotation` for diff items and a
      // `LineAnnotation` for file items. The shape is internally consistent
      // (the metadata is identical), so the same draft/saved components
      // render either. We only need to early-return for unknown item types
      // (defensive — the viewer doesn't currently produce any).
      if (item.type !== "diff" && item.type !== "file") {
        return null;
      }

      if (isDraftAnnotation(annotation)) {
        return (
          <DraftAnnotation
            annotation={annotation}
            itemId={item.id}
            onCancel={handleRemoveComment}
            onSave={handleSaveDraftComment}
          />
        );
      }

      if (!isSavedAnnotation(annotation)) {
        return null;
      }

      return (
        <ExampleAnnotation
          annotation={annotation}
          itemId={item.id}
          onDelete={handleRemoveComment}
          onToggleSelection={handleToggleCommentSelection}
        />
      );
    },
  );

  const renderHeaderPrefix = useStableCallback(
    (item: CodeViewItem<CommentMetadata>) => {
      if (item.type !== "diff") {
        return null;
      }

      return (
        <CollapseDiffButton
          disabled={
            item.fileDiff.splitLineCount === 0 && item.fileDiff.unifiedLineCount === 0
          }
          collapsed={item.collapsed}
          onToggle={() => handleToggleItemCollapsed(item.id)}
        />
      );
    },
  );

  // NOTE(amadeus): For some insane reason, the react compiler did not know how
  // to properly memoize this, so we pulled it into a `useMemo` for safety...
  // Backgrounds and line numbers are always on; diff indicators are always
  // off — the only toggle left in the display-settings dropdown is word wrap.
  const options: CodeViewOptions<CommentMetadata> = useMemo(
    () =>
      ({
        // Use this to validate itemMetrics when changing layout with unsafeCSS.
        // __devOnlyValidateItemHeights: true,
        layout: CODE_VIEW_LAYOUT,
        themeType,
        diffStyle,
        diffIndicators: "none",
        overflow,
        disableBackground: false,
        disableLineNumbers: false,
        lineHoverHighlight: "number",
        // hunkSeparators: 'line-info-basic',
        enableLineSelection: true,
        enableGutterUtility: true,
        stickyHeaders: true,
        unsafeCSS: CODE_VIEW_CUSTOM_CSS,
        onGutterUtilityClick(range, context) {
          // The gutter utility is wired up for both diff and file items.
          // File items need the same + button to open a draft comment;
          // the `handleCreateDraftComment` callback picks the right
          // annotation shape based on the item type.
          if (context.item.type !== "diff" && context.item.type !== "file") {
            return;
          }
          handleCreateDraftComment(range, context.item.id);
        },
        onLineSelectionEnd(range, context) {
          handleLineSelectionEnd(range, context.item);
        },
      }) satisfies CodeViewOptions<CommentMetadata>,
    [diffStyle, handleCreateDraftComment, handleLineSelectionEnd, overflow, themeType],
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
      renderAnnotation={renderCommentAnnotation}
      renderHeaderPrefix={renderHeaderPrefix}
    />
  );
});

interface CollapseDiffButtonProps {
  disabled?: boolean;
  collapsed?: boolean;
  onToggle(): void;
}

function CollapseDiffButton({
  disabled = false,
  collapsed = false,
  onToggle,
}: CollapseDiffButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={!disabled && !collapsed}
      aria-hidden={disabled}
      aria-label={disabled ? undefined : collapsed ? "Expand diff" : "Collapse diff"}
      className="text-muted-foreground hover:bg-muted hover:text-foreground ml-[-8px] inline-flex size-6 cursor-pointer items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-50"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <IconChevronSm
        aria-hidden="true"
        className={cn(
          "size-4 transition-transform",
          (disabled || collapsed) && "-rotate-90",
        )}
      />
    </button>
  );
}
