"use client";

import { useStableCallback } from "@pierre/diffs/react";
import type { FileTreeBatchOperation, FileTree as FileTreeModel } from "@pierre/trees";
import { useFileTree } from "@pierre/trees/react";
import { memo, useEffect, useRef, useState } from "react";

import { ThemedFileTree } from "@/components/diff/ThemedFileTree";
import {
  BASE_FILE_TREE_OPTIONS,
  CODE_VIEW_FILE_TREE_ITEM_HEIGHT,
  FILE_TREE_DENSITY_OVERRIDE_STYLES,
  getInitialBatchSize,
  PRESERVE_INPUT_ORDER_SORT,
} from "@/lib/config";
import type { OwlFileTreeSource } from "@/lib/types";

interface FileTreeProps {
  // Optional callback invoked with the underlying tree model once it's
  // mounted, and again with `null` on unmount.
  onModelReady?(model: FileTreeModel | null): void;
  onSelectItem(itemId: string): void;
  source: OwlFileTreeSource;
}

export const FileTree = memo(function FileTree({
  onModelReady,
  onSelectItem,
  source,
}: FileTreeProps) {
  const sourceRef = useRef(source);
  const previousSourceRef = useRef(source);
  const [initialVisibleRowCount] = useState(getInitialBatchSize);
  sourceRef.current = source;
  // `source.paths` aliases the streaming accumulator's live array, so it keeps
  // growing on later publishes. The FileTree model consumes its path list
  // exactly once via useFileTree's useState initializer; capture a bounded
  // snapshot here so the first model build uses only what `pathCount`
  // describes and so subsequent streaming re-renders don't re-slice the
  // ever-growing live array.
  const initialPathsRef = useRef<readonly string[] | null>(null);
  initialPathsRef.current ??= source.paths.slice(0, source.pathCount);
  const onSelectionChange = useStableCallback((selectedPaths: readonly string[]) => {
    if (selectedPaths.length !== 1 || onSelectItem == null) {
      return;
    }
    const [path] = selectedPaths;
    const itemId = sourceRef.current.pathToItemId.get(path);
    if (itemId != null) {
      onSelectItem(itemId);
    }
  });

  const { model } = useFileTree({
    ...BASE_FILE_TREE_OPTIONS,
    gitStatus: source.gitStatus,
    paths: initialPathsRef.current,
    sort: PRESERVE_INPUT_ORDER_SORT,
    onSelectionChange,
    itemHeight: CODE_VIEW_FILE_TREE_ITEM_HEIGHT,
    initialVisibleRowCount,
  });

  useEffect(() => {
    const previousSource = previousSourceRef.current;
    if (previousSource === source) {
      return;
    }

    previousSourceRef.current = source;
    // The streaming patch loader links each tree-source snapshot to the prior
    // one through `previousSource`. When the link matches what this component
    // last applied, the new paths array is guaranteed to extend the previous
    // one, so we apply the delta as add() operations instead of asking the
    // model to throw itself away and rebuild against the full path list. This
    // turns tree publishes from O(N) each (where N is the total accumulated
    // path count) into O(delta), which keeps the Diff Stats counter fast as
    // more files stream in.
    //
    // Both snapshots alias the live accumulator's paths array, so we read the
    // delta bounds from each snapshot's captured `pathCount` instead of the
    // shared array's current length.
    if (source.previousSource != null && source.previousSource === previousSource) {
      const previousPathCount = previousSource.pathCount;
      if (source.pathCount > previousPathCount) {
        const operations: FileTreeBatchOperation[] = [];
        for (let index = previousPathCount; index < source.pathCount; index++) {
          operations.push({ type: "add", path: source.paths[index] });
        }
        if (operations.length > 0) {
          model.batch(operations);
        }
      }
    } else {
      model.resetPaths(source.paths.slice(0, source.pathCount));
    }
    // The published @pierre/trees FileTree doesn't expose a delta-based
    // git status patch method, so fall back to the full setGitStatus on
    // each streaming publish. The `gitStatusPatch` field on the source
    // is still built (see owlDataAccumulator) for callers that want
    // it; the component just consumes the full array here.
    model.setGitStatus(source.gitStatus);
  }, [model, source]);

  useEffect(() => {
    onModelReady?.(model);
    return () => onModelReady?.(null);
  }, [model, onModelReady]);

  return (
    <ThemedFileTree
      className="h-full min-h-0 overflow-auto overscroll-contain md:ml-3"
      model={model}
      reconcileForegroundFromChrome
      style={FILE_TREE_DENSITY_OVERRIDE_STYLES}
    />
  );
});
