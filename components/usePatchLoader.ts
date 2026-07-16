"use client";

import {
  areSelectionsEqual,
  type CodeViewItem,
  type CodeViewLineSelection,
  processFile,
} from "@pierre/diffs";
import { type CodeViewHandle, useStableCallback } from "@pierre/diffs/react";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { CODE_VIEW_BATCH_COUNT, getInitialBatchSize } from "@/lib/constants";
import {
  appendFileDiffToOwlData,
  buildOwlData,
  createOwlDataAccumulator,
  type OwlItemIdRename,
  snapshotOwlTreeSource,
  takePendingOwlItems,
} from "@/lib/owlDataAccumulator";
import { EMPTY_OWL_FILE_TREE_SOURCE } from "@/lib/emptyOwlFileTreeSource";
import { getPatchTreePathPrefix } from "@/lib/gitPatchMetadata";
import {
  type OwlLineHashTarget,
  formatOwlLineHash,
  parseOwlLineHash,
} from "@/lib/lineHash";
import {
  getStreamedPatchMetadata,
  streamGitPatchFiles,
} from "@/lib/streamGitPatchFiles";
import type {
  CommentMetadata,
  DiffSource,
  OwlCommentFileByItemId,
  OwlDiffStats,
  OwlFileTreeSource,
  OwlSavedCommentItem,
  ViewerLoadState,
} from "@/lib/types";

const STREAM_PUBLISH_INTERVAL_MS = 100;
const STREAM_INITIAL_PUBLISH_INTERVAL_MS = 500;
const STREAM_WORK_BUDGET_MS = 8;
const STREAM_TREE_PUBLISH_FILE_BATCH_SIZE = 1_000;
const STREAM_TREE_PUBLISH_INTERVAL_MS = 1_000;
const GENERIC_PATCH_LOAD_ERROR_MESSAGE =
  "We couldn’t load that diff. Check the URL and try again.";

interface UsePatchLoaderOptions {
  collapseMode: "expanded" | "collapsed";
  onLoadStart(): void;
  source: DiffSource;
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>;
}

interface UsePatchLoaderResult {
  applyCollapseModeToLoaded(mode: "expanded" | "collapsed"): void;
  commentFileByItemId: OwlCommentFileByItemId | null;
  commentSections: OwlSavedCommentItem[];
  diffStats: OwlDiffStats | null;
  errorMessage: string | null;
  initialItems: CodeViewItem<CommentMetadata>[];
  loadState: ViewerLoadState;
  onLineLinkChange(selection: CodeViewLineSelection | null): void;
  onViewerReady(): void;
  retryLoad(): void;
  setCommentSections: Dispatch<SetStateAction<OwlSavedCommentItem[]>>;
  treeSource: OwlFileTreeSource | null;
  viewerKey: number;
}

export function usePatchLoader({
  collapseMode,
  onLoadStart,
  source,
  viewerRef,
}: UsePatchLoaderOptions): UsePatchLoaderResult {
  const [initialItems, setInitialItems] = useState<CodeViewItem<CommentMetadata>[]>([]);
  // Tree data is intentionally stored separately from items so annotation
  // updates do not cascade into the file tree and trigger needless rebuilds.
  // It is updated by fetch/stream batches in this viewer route.
  const [treeSource, setTreeSource] = useState<OwlFileTreeSource | null>(null);
  const [diffStats, setDiffStats] = useState<OwlDiffStats | null>(null);
  const [commentFileByItemId, setCommentFileByItemId] =
    useState<OwlCommentFileByItemId | null>(null);
  const [commentSections, setCommentSections] = useState<OwlSavedCommentItem[]>([]);
  const [loadState, setLoadState] = useState<ViewerLoadState>("fetching");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [viewerKey, setViewerKey] = useState(0);
  const requestIdRef = useRef(0);
  const appliedLineHashKeyRef = useRef<string | null>(null);
  const viewerKeyRef = useRef(0);
  // Tracks the ids of every item that has been handed to the viewer so we can
  // walk the full set when the user toggles collapse mode. The viewer handle
  // does not expose an enumeration API, so we maintain our own index.
  const loadedItemIdsRef = useRef<Set<string>>(new Set());
  // Mirrors the latest collapse mode so the streaming code path (which lives
  // inside a long-lived effect/closure) can read the live value without us
  // having to re-bind it on every change.
  const collapseModeRef = useRef(collapseMode);
  collapseModeRef.current = collapseMode;

  // Pre-mutates fresh items so they arrive in the viewer matching the current
  // collapse mode, then records their ids for later bulk updates. Diff items
  // are normalized in both directions because the accumulator initializes
  // deleted-file diffs as collapsed by default — without an unconditional
  // overwrite, those would stay collapsed even when the user is in expanded
  // mode.
  const prepareItemsForViewer = (
    items: readonly CodeViewItem<CommentMetadata>[],
  ): void => {
    const targetCollapsed = collapseModeRef.current === "collapsed";
    for (const item of items) {
      loadedItemIdsRef.current.add(item.id);
      if (item.type === "diff") {
        item.collapsed = targetCollapsed;
      }
    }
  };

  const applyCollapseModeToLoaded = useStableCallback(
    (mode: "expanded" | "collapsed") => {
      const targetCollapsed = mode === "collapsed";
      const viewer = viewerRef.current;
      if (viewer == null) {
        // The viewer hasn't mounted yet (e.g. the worker pool is still warming
        // up while the header is already interactive). Rewrite any items
        // already buffered in initialItems so they arrive in the right state
        // once the viewer mounts. New items still streaming in pick up the
        // live collapse mode through prepareItemsForViewer.
        setInitialItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            if (item.type !== "diff" || (item.collapsed === true) === targetCollapsed) {
              return item;
            }
            changed = true;
            return { ...item, collapsed: targetCollapsed };
          });
          return changed ? next : prev;
        });
        return;
      }

      for (const itemId of loadedItemIdsRef.current) {
        const item = viewer.getItem(itemId);
        if (item == null || item.type !== "diff") {
          continue;
        }
        const current = item.collapsed === true;
        if (current === targetCollapsed) {
          continue;
        }
        item.collapsed = targetCollapsed;
        item.version = getNextItemVersion(item);
        viewer.updateItem(item);
      }
    },
  );

  const tryApplyLineHashTarget = useStableCallback(() => {
    const { hash } = window.location;
    const target = parseOwlLineHash(hash);
    if (target == null) {
      return;
    }

    const applyKey = getLineHashApplyKey(viewerKeyRef.current, hash);
    if (appliedLineHashKeyRef.current === applyKey) {
      return;
    }

    const viewer = viewerRef.current;
    if (viewer == null) {
      return;
    }

    if (applyOwlLineHashTarget(viewer, target)) {
      appliedLineHashKeyRef.current = applyKey;
    }
  });

  const handleLineLinkChange = useStableCallback(
    (selection: CodeViewLineSelection | null) => {
      const nextHash = selection == null ? null : formatOwlLineHash(selection);
      appliedLineHashKeyRef.current =
        nextHash == null ? null : getLineHashApplyKey(viewerKeyRef.current, nextHash);
      replaceLocationHash(nextHash);
    },
  );

  useEffect(() => {
    // The diff source drives both the URL we fetch and the cache key the
    // viewer uses to memoize parse results. `loadAttempt` (in the dep array)
    // is what triggers retries — the key just needs to stay stable across
    // them for a given source.
    const patchRequestKey = getPatchRequestKey(source);

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () =>
      requestIdRef.current === requestId && !controller.signal.aborted;

    viewerKeyRef.current = requestId;
    appliedLineHashKeyRef.current = null;
    loadedItemIdsRef.current = new Set();
    setViewerKey(requestId);
    setInitialItems([]);
    setTreeSource(null);
    setDiffStats(null);
    setCommentFileByItemId(null);
    setCommentSections([]);
    onLoadStart();
    setErrorMessage(null);
    setLoadState("fetching");

    async function loadPatch() {
      const apiURL = getDiffSourceApiURL(source);

      async function commitFullPatch(patchContent: string) {
        if (!isCurrentRequest()) {
          return;
        }
        setLoadState("parsing");
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

        if (!isCurrentRequest()) {
          return;
        }
        const loadedData = buildOwlData(patchContent, patchRequestKey);
        if (!isCurrentRequest()) {
          return;
        }

        setTreeSource(loadedData.treeSource);
        setCommentFileByItemId(loadedData.itemIdToFile);
        setCommentSections([]);
        setDiffStats(loadedData.diffStats);
        prepareItemsForViewer(loadedData.items);
        setInitialItems(loadedData.items);
        setLoadState("ready");
        await yieldToBrowser();
        if (isCurrentRequest()) {
          tryApplyLineHashTarget();
        }
      }

      try {
        const cacheKeyPrefix = encodeURIComponent(patchRequestKey);

        const response = await fetch(apiURL, {
          cache: "no-store",
          signal: controller.signal,
        });

        // This only catches route setup errors. GitHub fetch failures are
        // delivered while consuming the stream so the UI can enter the
        // streaming state as soon as the local transport opens.
        if (!response.ok) {
          // 422 from the local-worktree endpoint means "no local changes".
          // That isn't an error — settle into the ready state with an empty
          // file tree so the header / sidebar / system monitor stay visible
          // and the diff content area renders a blank surface. The empty
          // source is a frozen module-level constant, so React state updates
          // are no-ops and downstream effects see a stable reference.
          if (response.status === 422) {
            setTreeSource(EMPTY_OWL_FILE_TREE_SOURCE);
            setCommentFileByItemId(new Map());
            setDiffStats({
              addedLines: 0,
              deletedLines: 0,
              fileCount: 0,
              totalLinesOfCode: 0,
            });
            setInitialItems([]);
            setErrorMessage(null);
            setLoadState("ready");
            return;
          }

          const detail = (await response.text()).trim();
          throw new Error(
            detail.length > 0 ? detail : `Request failed (${response.status}).`,
          );
        }

        if (response.body == null) {
          const patchContent = await response.text();
          await commitFullPatch(patchContent);
          return;
        }

        setLoadState("streaming");
        await yieldToBrowser();
        if (!isCurrentRequest()) {
          return;
        }

        const accumulator = createOwlDataAccumulator();
        let streamPatchIndex = 0;
        let streamTreePathPrefix: string | undefined;
        let pendingPublishFileCount = 0;
        let pendingTreePublishFileCount = 0;
        let hasPublishedTree = false;
        let hasPublishedInitialItems = false;
        let hasReceivedFirstStreamedFile = false;
        let lastPublishTime = performance.now();
        let lastWorkYieldTime = lastPublishTime;
        let lastTreePublishTime = lastPublishTime;
        const initialPublishFileBatchSize = getInitialBatchSize();

        const publishTreeSource = () => {
          if (pendingTreePublishFileCount === 0 || !isCurrentRequest()) {
            return;
          }

          pendingTreePublishFileCount = 0;
          hasPublishedTree = true;
          lastTreePublishTime = performance.now();
          setCommentFileByItemId(accumulator.itemIdToFile);
          setDiffStats({ ...accumulator.diffStats });
          setTreeSource(snapshotOwlTreeSource(accumulator));
        };

        const publishPendingData = async () => {
          if (pendingPublishFileCount === 0 || !isCurrentRequest()) {
            return;
          }

          pendingPublishFileCount = 0;
          lastPublishTime = performance.now();
          const pendingItems = takePendingOwlItems(accumulator);
          prepareItemsForViewer(pendingItems);
          if (hasPublishedInitialItems) {
            const viewer = viewerRef.current;
            if (viewer == null) {
              setInitialItems((prev) => [...prev, ...pendingItems]);
            } else {
              viewer.addItems(pendingItems);
            }
          } else {
            hasPublishedInitialItems = true;
            publishTreeSource();
            setInitialItems(pendingItems);
          }
          await yieldToBrowser();
          if (isCurrentRequest()) {
            tryApplyLineHashTarget();
          }
          lastWorkYieldTime = performance.now();
        };

        const publishPendingDataIfNeeded = async () => {
          if (pendingPublishFileCount === 0) {
            return;
          }

          const elapsed = performance.now() - lastPublishTime;
          const publishFileBatchSize = hasPublishedInitialItems
            ? CODE_VIEW_BATCH_COUNT
            : initialPublishFileBatchSize;
          const publishInterval = hasPublishedInitialItems
            ? STREAM_PUBLISH_INTERVAL_MS
            : STREAM_INITIAL_PUBLISH_INTERVAL_MS;
          if (
            pendingPublishFileCount < publishFileBatchSize &&
            elapsed < publishInterval
          ) {
            return;
          }

          await publishPendingData();
        };
        const shouldDeferInitialPublishForBatchTarget = () => {
          if (hasPublishedInitialItems) {
            return false;
          }

          const elapsed = performance.now() - lastPublishTime;
          return (
            pendingPublishFileCount < initialPublishFileBatchSize &&
            elapsed < STREAM_INITIAL_PUBLISH_INTERVAL_MS
          );
        };
        const publishTreeSourceIfNeeded = () => {
          if (pendingTreePublishFileCount === 0) {
            return;
          }

          const elapsed = performance.now() - lastTreePublishTime;
          if (
            hasPublishedTree &&
            pendingTreePublishFileCount < STREAM_TREE_PUBLISH_FILE_BATCH_SIZE &&
            elapsed < STREAM_TREE_PUBLISH_INTERVAL_MS
          ) {
            return;
          }

          publishTreeSource();
        };
        const appendStreamedFile = async (fileText: string) => {
          if (!hasReceivedFirstStreamedFile) {
            hasReceivedFirstStreamedFile = true;
          }

          const patchMetadata = getStreamedPatchMetadata(fileText);
          if (patchMetadata != null) {
            streamTreePathPrefix = getPatchTreePathPrefix(
              patchMetadata,
              streamPatchIndex++,
            );
          }

          const fileDiff = processFile(fileText, {
            cacheKey: `${cacheKeyPrefix}-0-${accumulator.fileIndex}`,
            isGitDiff: true,
          });
          if (fileDiff == null) {
            return;
          }

          const itemIdRename = appendFileDiffToOwlData(
            accumulator,
            fileDiff,
            streamTreePathPrefix,
          );
          if (itemIdRename != null) {
            applyOwlItemIdRename(viewerRef.current, itemIdRename);
            if (loadedItemIdsRef.current.delete(itemIdRename.oldId)) {
              loadedItemIdsRef.current.add(itemIdRename.newId);
            }
          }
          pendingPublishFileCount++;
          pendingTreePublishFileCount++;
          const elapsedWork = performance.now() - lastWorkYieldTime;
          if (elapsedWork >= STREAM_WORK_BUDGET_MS) {
            if (shouldDeferInitialPublishForBatchTarget()) {
              await yieldToBrowser();
              lastWorkYieldTime = performance.now();
            } else {
              await publishPendingData();
            }
          } else {
            await publishPendingDataIfNeeded();
          }
          publishTreeSourceIfNeeded();
        };

        const fallbackPatchContent = await streamGitPatchFiles(
          response.body,
          appendStreamedFile,
        );
        if (!isCurrentRequest()) {
          return;
        }

        await publishPendingData();
        publishTreeSource();
        if (fallbackPatchContent != null) {
          await commitFullPatch(fallbackPatchContent);
          return;
        }

        setCommentFileByItemId(new Map(accumulator.itemIdToFile));
        setDiffStats({ ...accumulator.diffStats });
        setLoadState("ready");
      } catch {
        if (!isCurrentRequest()) {
          return;
        }
        setErrorMessage(GENERIC_PATCH_LOAD_ERROR_MESSAGE);
        setLoadState("error");
      }
    }

    void loadPatch();

    return () => {
      controller.abort();
    };
  }, [loadAttempt, onLoadStart, source, tryApplyLineHashTarget, viewerRef]);

  useEffect(() => {
    window.addEventListener("hashchange", tryApplyLineHashTarget);
    tryApplyLineHashTarget();
    return () => {
      window.removeEventListener("hashchange", tryApplyLineHashTarget);
    };
  }, [tryApplyLineHashTarget]);

  const retryLoad = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  return {
    applyCollapseModeToLoaded,
    commentFileByItemId,
    commentSections,
    diffStats,
    errorMessage,
    initialItems,
    loadState,
    onLineLinkChange: handleLineLinkChange,
    onViewerReady: tryApplyLineHashTarget,
    retryLoad,
    setCommentSections,
    treeSource,
    viewerKey,
  };
}

function getLineHashApplyKey(viewerKey: number, hash: string): string {
  return `${viewerKey}:${hash}`;
}

function applyOwlLineHashTarget(
  viewer: CodeViewHandle<CommentMetadata>,
  target: OwlLineHashTarget,
): boolean {
  const item = viewer.getItem(target.itemId);
  if (item == null) {
    return false;
  }

  const selectedLines = viewer.getSelectedLines();
  if (
    selectedLines?.id === target.itemId &&
    areSelectionsEqual(selectedLines.range, target.range)
  ) {
    return true;
  }

  if (item.collapsed === true) {
    item.collapsed = false;
    item.version = getNextItemVersion(item);
    if (!viewer.updateItem(item)) {
      return false;
    }
    viewer.getInstance()?.render(true);
  }

  viewer.setSelectedLines({ id: target.itemId, range: target.range });
  viewer.scrollTo({
    type: "range",
    id: target.itemId,
    range: target.range,
    align: "center",
    behavior: "instant",
  });
  return true;
}

function applyOwlItemIdRename(
  viewer: CodeViewHandle<CommentMetadata> | null,
  rename: OwlItemIdRename,
): void {
  viewer?.updateItemId(rename.oldId, rename.newId);
}

function getNextItemVersion(item: { version?: string | number }): number {
  return typeof item.version === "number" ? item.version + 1 : 1;
}

function replaceLocationHash(hash: string | null): void {
  const { pathname, search } = window.location;
  const nextHash = hash ?? "";
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${search}${nextHash}`,
  );
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    let didResolve = false;
    const resolveOnce = () => {
      if (didResolve) {
        return;
      }

      didResolve = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(resolveOnce, 50);
    window.requestAnimationFrame(resolveOnce);
  });
}

// Maps a DiffSource to the API route that serves its unified-diff body.
// Kept as a free function so the URL logic stays in one place; the viewer
// pipeline (fetch + stream) is identical for all diff sources.
function getDiffSourceApiURL(source: DiffSource): string {
  if (source.kind === "worktree") {
    return "/api/local-worktree-diff";
  }
  if (source.kind === "branchCompare") {
    return `/api/branch-comparison-diff?branch=${encodeURIComponent(source.branch)}`;
  }
  return `/api/past-commit-diff?hash=${encodeURIComponent(source.hash)}`;
}

// Stable cache key for the given source. Used by `@pierre/diffs` to memoize
// parsed file diffs so a re-visit (or a back-and-forth toggle) doesn't redo
// the parse. Includes the full hash so different commits don't share a key.
function getPatchRequestKey(source: DiffSource): string {
  if (source.kind === "worktree") {
    return "local-worktree";
  }
  if (source.kind === "branchCompare") {
    return `branch-compare:${source.branch}`;
  }
  return `past-commit:${source.hash}`;
}
