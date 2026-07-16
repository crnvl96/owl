"use client";

import { type CodeViewHandle } from "@pierre/diffs/react";
import { type ReactNode, useCallback, useRef, useState } from "react";

import { OwlBlankArea } from "./OwlBlankArea";
import { OwlSidebar } from "./OwlSidebar";
import { OwlStatusPanel } from "./OwlStatusPanel";
import { OwlViewer } from "./OwlViewer";
import { useIsWorkerPoolReadyOrDisabled } from "@/hooks/useIsWorkerPoolReadyOrDisabled";
import { usePatchLoader } from "@/hooks/usePatchLoader";
import { THEME_SCHEME } from "@/lib/config";
import type { CommentMetadata } from "@/lib/types";

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
    errorMessage,
    initialItems,
    loadState,
    onLineLinkChange,
    onViewerReady,
    retryLoad,
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
  const handleCloseFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const viewerAvailable =
    isWorkerPoolReadyOrDisable &&
    (loadState === "ready" || (loadState === "streaming" && initialItems.length > 0));
  const hasDiffItems = initialItems.length > 0;

  return (
    <ReviewGrid>
      {viewerAvailable && treeSource != null ? (
        <>
          <OwlSidebar
            className="[grid-area:viewer] md:[grid-area:tree]"
            mobileOverlayOpen={fileTreeOverlayOpen}
            onMobileClose={handleCloseFileTreeOverlay}
            scrollRef={scrollRef}
            source={treeSource}
            onSelectItem={handleSelectTreeItem}
          />
          {hasDiffItems ? (
            <OwlViewer
              key={viewerKey}
              className="[grid-area:viewer]"
              scrollRef={scrollRef}
              themeType={THEME_SCHEME}
              viewerRef={viewerRef}
              initialItems={initialItems}
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

interface ReviewGridProps {
  children: ReactNode;
}

function ReviewGrid({ children }: ReviewGridProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden overscroll-contain contain-strict [grid-template-areas:'viewer'] md:grid-cols-[320px_minmax(0,1fr)] md:[grid-template-areas:'tree_viewer']">
      {children}
    </div>
  );
}
