"use client";

import { type CodeViewHandle, useWorkerPool } from "@pierre/diffs/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { OwlBlankArea } from "./OwlBlankArea";
import { OwlHeader } from "./OwlHeader";
import { OwlSidebar } from "./OwlSidebar";
import { OwlStatusPanel } from "./OwlStatusPanel";
import { OwlViewer } from "./OwlViewer";
import { usePatchLoader } from "./usePatchLoader";
import { removeSavedCommentSidebarEntry } from "@/lib/removeSavedCommentSidebarEntry";
import { ACTIVE_THEME_SCHEME } from "@/lib/theme/activeTheme";
import type {
  CommentMetadata,
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
  const [fileTreeOverlayOpen, setFileTreeOverlayOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CodeViewHandle<CommentMetadata> | null>(null);
  const handlePatchLoadStart = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const {
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
    onLoadStart: handlePatchLoadStart,
    viewerRef,
  });

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

  return (
    <ReviewGrid>
      <OwlHeader
        className="[grid-area:header]"
        fileTreeOverlayOpen={fileTreeOverlayOpen}
        fileTreeAvailable={treeSource != null}
        onToggleFileTreeOverlay={handleToggleFileTreeOverlay}
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
