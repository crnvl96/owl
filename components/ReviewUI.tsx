"use client";

import { type CodeViewHandle, useWorkerPool } from "@pierre/diffs/react";
import type { GitStatus } from "@pierre/trees";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { OwlBlankArea } from "./OwlBlankArea";
import { OwlHeader } from "./OwlHeader";
import { OwlSidebar } from "./OwlSidebar";
import { OwlStatusPanel } from "./OwlStatusPanel";
import { OwlViewer } from "./OwlViewer";
import { useAppFontSize } from "./useAppFontSize";
import { usePatchLoader } from "./usePatchLoader";
import {
  APP_FONT_SIZE_DEFAULT,
  type AppFontSizeStep,
  clampAppFontSize,
} from "@/lib/appFontSize";
import type { FileContext } from "@/lib/generateReviewReport";
import { removeSavedCommentSidebarEntry } from "@/lib/removeSavedCommentSidebarEntry";
import { ACTIVE_THEME_SCHEME } from "@/lib/theme/activeTheme";
import type {
  CommentMetadata,
  DiffSource,
  OwlDeletedCommentEvent,
  OwlSavedCommentEntry,
  OwlSavedCommentEvent,
} from "@/lib/types";
import { upsertSavedCommentSidebarEntry } from "@/lib/upsertSavedCommentSidebarEntry";

// The viewer always shows the local worktree's diff. It takes no props and
// draws its palette from the single hardcoded theme (see lib/theme/activeTheme).
export function ReviewUI() {
  return <ReviewUIBody />;
}

function ReviewUIBody() {
  const isWorkerPoolReadyOrDisable = useIsWorkerPoolReadyOrDisabled();
  const [diffStyle, setDiffStyle] = useState<"split" | "unified">("split");
  const [collapseMode, setCollapseMode] = useState<"expanded" | "collapsed">(
    "expanded",
  );
  const [fileTreeOverlayOpen, setFileTreeOverlayOpen] = useState(false);
  const [overflow, setOverflow] = useState<"wrap" | "scroll">("scroll");
  // User-adjustable global font size. The header control drives this and
  // the value is mirrored onto <html> as `--owl-app-font-size`; `body` in
  // globals.css reads it, so Tailwind v4's rem-based typography scale
  // scales proportionally. Reset to APP_FONT_SIZE_DEFAULT on reload.
  const [appFontSize, setAppFontSize] =
    useState<AppFontSizeStep>(APP_FONT_SIZE_DEFAULT);
  useAppFontSize(appFontSize);
  // `worktree` is the default per the spec; `pastCommit` requires the user
  // to pick a hash from the dropdown. The viewer pipeline and the patch
  // loader both react to this via the `source` prop.
  const [diffSource, setDiffSource] = useState<DiffSource>({
    kind: "worktree",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CodeViewHandle<CommentMetadata> | null>(null);
  const handlePatchLoadStart = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const {
    applyCollapseModeToLoaded,
    commentFileByItemId,
    commentSections,
    diffStats,
    errorMessage,
    initialItems,
    loadState,
    onLineLinkChange,
    onViewerReady,
    retryLoad,
    setCommentSections,
    treeSource,
    viewerKey,
  } = usePatchLoader({
    collapseMode,
    onLoadStart: handlePatchLoadStart,
    source: diffSource,
    viewerRef,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileState = (matches: boolean) => {
      setDiffStyle(matches ? "unified" : "split");
      if (!matches) {
        setFileTreeOverlayOpen(false);
      }
    };
    const handleChange = (event: MediaQueryListEvent) => {
      updateMobileState(event.matches);
    };

    updateMobileState(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  const handleSelectTreeItem = useCallback((itemId: string) => {
    setFileTreeOverlayOpen(false);
    const viewer = viewerRef.current;
    if (viewer == null) {
      return;
    }
    const item = viewer.getItem(itemId);
    if (item != null && item.collapsed === true) {
      item.collapsed = false;
      item.version = typeof item.version === "number" ? item.version + 1 : 1;
      viewer.updateItem(item);
    }
    viewer.scrollTo({
      type: "item",
      id: itemId,
      align: "start",
      behavior: "smooth",
    });
  }, []);
  const handleToggleCollapseMode = useCallback(() => {
    const next = collapseMode === "expanded" ? "collapsed" : "expanded";
    setCollapseMode(next);
    applyCollapseModeToLoaded(next);
  }, [applyCollapseModeToLoaded, collapseMode]);
  const handleCommentSaved = useCallback(
    (comment: OwlSavedCommentEvent) => {
      setCommentSections((prev) =>
        upsertSavedCommentSidebarEntry(prev, commentFileByItemId, comment),
      );
    },
    [commentFileByItemId, setCommentSections],
  );
  const handleCommentDeleted = useCallback(
    (comment: OwlDeletedCommentEvent) => {
      setCommentSections((prev) => removeSavedCommentSidebarEntry(prev, comment));
    },
    [setCommentSections],
  );
  const handleToggleFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen((open) => !open);
  }, []);
  const handleCloseFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const handleSelectComment = useCallback((comment: OwlSavedCommentEntry) => {
    setFileTreeOverlayOpen(false);
    viewerRef.current?.setSelectedLines({
      id: comment.itemId,
      range: comment.range,
    });
    viewerRef.current?.scrollTo({
      type: "line",
      id: comment.itemId,
      lineNumber: comment.range.end,
      side: comment.range.endSide ?? comment.range.side,
      align: "center",
      behavior: "smooth-auto",
    });
  }, []);
  const viewerAvailable =
    isWorkerPoolReadyOrDisable &&
    (loadState === "ready" || (loadState === "streaming" && initialItems.length > 0));
  // `treeSource` is now an empty-but-valid file tree source (not null) once
  // the worktree is clean, so the chrome stays mounted. We render the viewer
  // only when there are diff items to show; otherwise a blank area takes its
  // grid slot so the user sees a consistent UI shell.
  const hasDiffItems = initialItems.length > 0;
  // Joins the file tree's git-status array with the viewer items' hunk
  // boundaries so the review-report generator can stamp each file section
  // with a `[A]/[M]/[R]/[D]` tag and a `@@ -X,Y +A,B @@` hunk header.
  // Built once per (initialItems, treeSource) pair so the generator's
  // pure `O(1)` lookups don't pay a re-walk cost on every render.
  const fileContextByItemId = useMemo<ReadonlyMap<string, FileContext>>(() => {
    const map = new Map<string, FileContext>();
    if (treeSource == null) {
      return map;
    }
    const statusByPath = new Map<string, GitStatus>();
    for (const entry of treeSource.gitStatus) {
      statusByPath.set(entry.path, entry.status);
    }
    for (const item of initialItems) {
      if (item.type !== "diff") {
        continue;
      }
      // Default to `modified` when the tree hasn't reported a status for
      // this path (e.g. a file appeared in the diff stream before the
      // tree's status snapshot caught up). The tag is metadata, not
      // load-bearing, so a conservative default keeps the report usable.
      const status: GitStatus = statusByPath.get(item.fileDiff.name) ?? "modified";
      map.set(item.id, {
        status,
        hunks: item.fileDiff.hunks.map((hunk) => ({
          additionCount: hunk.additionCount,
          additionStart: hunk.additionStart,
          deletionCount: hunk.deletionCount,
          deletionStart: hunk.deletionStart,
        })),
      });
    }
    return map;
  }, [initialItems, treeSource]);

  return (
    <ReviewGrid>
      <OwlHeader
        className="[grid-area:header]"
        appFontSize={appFontSize}
        collapseMode={collapseMode}
        commentSections={commentSections}
        diffSource={diffSource}
        diffStyle={diffStyle}
        fileContextByItemId={fileContextByItemId}
        overflow={overflow}
        fileTreeOverlayOpen={fileTreeOverlayOpen}
        fileTreeAvailable={treeSource != null}
        onChangeAppFontSize={(next) =>
          setAppFontSize(clampAppFontSize(next) as AppFontSizeStep)
        }
        onSelectDiffSource={setDiffSource}
        onToggleCollapseMode={handleToggleCollapseMode}
        onToggleFileTreeOverlay={handleToggleFileTreeOverlay}
        setDiffStyle={setDiffStyle}
        setOverflow={setOverflow}
      />
      {viewerAvailable && treeSource != null ? (
        <>
          <OwlSidebar
            className="[grid-area:viewer] md:[grid-area:tree]"
            commentSections={commentSections}
            diffStats={diffStats}
            mobileOverlayOpen={fileTreeOverlayOpen}
            onMobileClose={handleCloseFileTreeOverlay}
            onSelectComment={handleSelectComment}
            scrollRef={scrollRef}
            source={treeSource}
            streaming={loadState === "streaming"}
            onSelectItem={handleSelectTreeItem}
          />
          {hasDiffItems ? (
            <OwlViewer
              key={viewerKey}
              className="[grid-area:viewer]"
              diffStyle={diffStyle}
              overflow={overflow}
              scrollRef={scrollRef}
              themeType={ACTIVE_THEME_SCHEME}
              viewerRef={viewerRef}
              initialItems={initialItems}
              onCommentDeleted={handleCommentDeleted}
              onCommentSaved={handleCommentSaved}
              onLineLinkChange={onLineLinkChange}
              onViewerReady={onViewerReady}
            />
          ) : (
            <OwlBlankArea />
          )}
        </>
      ) : (
        <OwlStatusPanel
          errorMessage={errorMessage}
          onRetry={retryLoad}
          state={loadState}
        />
      )}
    </ReviewGrid>
  );
}

function useIsWorkerPoolReadyOrDisabled() {
  const workerPool = useWorkerPool();
  const [isReady, setIsReady] = useState(() => workerPool?.isInitialized() ?? true);
  const isReadyRef = useRef(isReady);
  useEffect(() => {
    // The callback will always be fired immediately with the new state, so we
    // don't need to check for it in the effect
    return workerPool?.subscribeToStatChanges((stats) => {
      const newIsReady = stats.managerState === "initialized";
      if (newIsReady !== isReadyRef.current) {
        setIsReady(newIsReady);
        isReadyRef.current = newIsReady;
      }
    });
  }, [workerPool]);
  return isReady;
}

interface ReviewGridProps {
  children: ReactNode;
}

function ReviewGrid({ children }: ReviewGridProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden overscroll-contain contain-strict [grid-template-areas:'header''viewer'] md:grid-cols-[320px_minmax(0,1fr)] md:[grid-template-areas:'header_header''tree_viewer']">
      {children}
    </div>
  );
}
