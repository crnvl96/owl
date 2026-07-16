import { type CodeViewHandle } from "@pierre/diffs/react";
import { type ReactNode, useCallback, useRef, useState } from "react";

import { BlankArea } from "./BlankArea";
import { Sidebar } from "./Sidebar";
import { StatusPanel } from "./StatusPanel";
import { Viewer } from "./Viewer";
import { useIsWorkerPoolReadyOrDisabled } from "@/hooks/useIsWorkerPoolReadyOrDisabled";
import { usePatchLoader } from "@/hooks/usePatchLoader";
import { THEME_SCHEME } from "@/lib/config";
import type { CommentMetadata } from "@/lib/types";
import styles from "./ReviewUI.module.css";

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
  } = usePatchLoader({ onLoadStart: handlePatchLoadStart, viewerRef });

  const handleSelectTreeItem = useCallback((itemId: string) => {
    setFileTreeOverlayOpen(false);
    const viewer = viewerRef.current;
    if (viewer == null) return;
    const item = viewer.getItem(itemId);
    if (item != null && item.collapsed === true) {
      item.collapsed = false;
      item.version = typeof item.version === "number" ? item.version + 1 : 1;
      viewer.updateItem(item);
    }
    viewer.scrollTo({ type: "item", id: itemId, align: "start", behavior: "smooth" });
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
          <Sidebar
            mobileOverlayOpen={fileTreeOverlayOpen}
            onMobileClose={handleCloseFileTreeOverlay}
            scrollRef={scrollRef}
            source={treeSource}
            onSelectItem={handleSelectTreeItem}
          />
          {hasDiffItems ? (
            <Viewer
              key={viewerKey}
              scrollRef={scrollRef}
              themeType={THEME_SCHEME}
              viewerRef={viewerRef}
              initialItems={initialItems}
              onLineLinkChange={onLineLinkChange}
              onViewerReady={onViewerReady}
            />
          ) : (
            <BlankArea />
          )}
        </>
      ) : (
        <StatusPanel errorMessage={errorMessage} onRetry={retryLoad} state={loadState} />
      )}
    </ReviewGrid>
  );
}

function ReviewGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
