'use client';

import { type CodeViewHandle, useWorkerPool } from '@pierre/diffs/react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { DiffsHubBlankArea } from './DiffsHubBlankArea';
import { DiffsHubHeader } from './DiffsHubHeader';
import { DiffsHubSidebar } from './DiffsHubSidebar';
import { DiffsHubStatusPanel } from './DiffsHubStatusPanel';
import { DiffsHubViewer } from './DiffsHubViewer';
import { usePatchLoader } from './usePatchLoader';
import { ACTIVE_THEME_SCHEME } from '@/lib/theme/activeTheme';
import { removeSavedCommentSidebarEntry } from '@/lib/removeSavedCommentSidebarEntry';
import type {
  CommentMetadata,
  DiffSource,
  DiffsHubDeletedCommentEvent,
  DiffsHubSavedCommentEntry,
  DiffsHubSavedCommentEvent,
} from '@/lib/types';
import { upsertSavedCommentSidebarEntry } from '@/lib/upsertSavedCommentSidebarEntry';

// The viewer always shows the local worktree's diff. It takes no props and
// draws its palette from the single hardcoded theme (see lib/theme/activeTheme).
export function ReviewUI() {
  return <ReviewUIBody />;
}

function ReviewUIBody() {
  const isWorkerPoolReadyOrDisable = useIsWorkerPoolReadyOrDisabled();
  const [diffStyle, setDiffStyle] = useState<'split' | 'unified'>('split');
  const [collapseMode, setCollapseMode] = useState<'expanded' | 'collapsed'>(
    'expanded'
  );
  const [fileTreeOverlayOpen, setFileTreeOverlayOpen] = useState(false);
  const [overflow, setOverflow] = useState<'wrap' | 'scroll'>('scroll');
  // `worktree` is the default per the spec; `pastCommit` requires the user
  // to pick a hash from the dropdown. The viewer pipeline and the patch
  // loader both react to this via the `source` prop.
  const [diffSource, setDiffSource] = useState<DiffSource>({
    kind: 'worktree',
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
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMobileState = (matches: boolean) => {
      setDiffStyle(matches ? 'unified' : 'split');
      if (!matches) setFileTreeOverlayOpen(false);
    };
    const handleChange = (event: MediaQueryListEvent) => {
      updateMobileState(event.matches);
    };

    updateMobileState(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
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
      item.version = typeof item.version === 'number' ? item.version + 1 : 1;
      viewer.updateItem(item);
    }
    viewer.scrollTo({
      type: 'item',
      id: itemId,
      align: 'start',
      behavior: 'smooth',
    });
  }, []);
  const handleToggleCollapseMode = useCallback(() => {
    const next = collapseMode === 'expanded' ? 'collapsed' : 'expanded';
    setCollapseMode(next);
    applyCollapseModeToLoaded(next);
  }, [applyCollapseModeToLoaded, collapseMode]);
  const handleCommentSaved = useCallback(
    (comment: DiffsHubSavedCommentEvent) => {
      setCommentSections((prev) =>
        upsertSavedCommentSidebarEntry(prev, commentFileByItemId, comment)
      );
    },
    [commentFileByItemId, setCommentSections]
  );
  const handleCommentDeleted = useCallback(
    (comment: DiffsHubDeletedCommentEvent) => {
      setCommentSections((prev) =>
        removeSavedCommentSidebarEntry(prev, comment)
      );
    },
    [setCommentSections]
  );
  const handleToggleFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen((open) => !open);
  }, []);
  const handleCloseFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const handleSelectComment = useCallback(
    (comment: DiffsHubSavedCommentEntry) => {
      setFileTreeOverlayOpen(false);
      viewerRef.current?.setSelectedLines({
        id: comment.itemId,
        range: comment.range,
      });
      viewerRef.current?.scrollTo({
        type: 'line',
        id: comment.itemId,
        lineNumber: comment.range.end,
        side: comment.range.endSide ?? comment.range.side,
        align: 'center',
        behavior: 'smooth-auto',
      });
    },
    []
  );
  const viewerAvailable =
    isWorkerPoolReadyOrDisable &&
    (loadState === 'ready' ||
      (loadState === 'streaming' && initialItems.length > 0));
  // `treeSource` is now an empty-but-valid file tree source (not null) once
  // the worktree is clean, so the chrome stays mounted. We render the viewer
  // only when there are diff items to show; otherwise a blank area takes its
  // grid slot so the user sees a consistent UI shell.
  const hasDiffItems = initialItems.length > 0;

  return (
    <ReviewGrid>
      <DiffsHubHeader
        className="[grid-area:header]"
        collapseMode={collapseMode}
        diffSource={diffSource}
        diffStyle={diffStyle}
        overflow={overflow}
        fileTreeOverlayOpen={fileTreeOverlayOpen}
        fileTreeAvailable={treeSource != null}
        onSelectDiffSource={setDiffSource}
        onToggleCollapseMode={handleToggleCollapseMode}
        onToggleFileTreeOverlay={handleToggleFileTreeOverlay}
        setDiffStyle={setDiffStyle}
        setOverflow={setOverflow}
      />
      {viewerAvailable && treeSource != null ? (
        <>
          <DiffsHubSidebar
            className="[grid-area:viewer] md:[grid-area:tree]"
            commentSections={commentSections}
            diffStats={diffStats}
            mobileOverlayOpen={fileTreeOverlayOpen}
            onMobileClose={handleCloseFileTreeOverlay}
            onSelectComment={handleSelectComment}
            scrollRef={scrollRef}
            source={treeSource}
            streaming={loadState === 'streaming'}
            onSelectItem={handleSelectTreeItem}
          />
          {hasDiffItems ? (
            <DiffsHubViewer
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
            <DiffsHubBlankArea />
          )}
        </>
      ) : (
        <DiffsHubStatusPanel
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
  const [isReady, setIsReady] = useState(
    () => workerPool?.isInitialized() ?? true
  );
  const isReadyRef = useRef(isReady);
  useEffect(() => {
    // The callback will always be fired immediately with the new state, so we
    // don't need to check for it in the effect
    return workerPool?.subscribeToStatChanges((stats) => {
      const isReady = stats.managerState === 'initialized';
      if (isReady !== isReadyRef.current) {
        setIsReady(isReady);
        isReadyRef.current = isReady;
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
