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
import styles from "./FileTree.module.css";

interface FileTreeProps {
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

  const initialPathsRef = useRef<readonly string[] | null>(null);
  initialPathsRef.current ??= source.paths.slice(0, source.pathCount);

  const onSelectionChange = useStableCallback((selectedPaths: readonly string[]) => {
    if (selectedPaths.length !== 1 || onSelectItem == null) return;
    const [path] = selectedPaths;
    const itemId = sourceRef.current.pathToItemId.get(path);
    if (itemId != null) onSelectItem(itemId);
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
    if (previousSource === source) return;
    previousSourceRef.current = source;

    if (source.previousSource != null && source.previousSource === previousSource) {
      const previousPathCount = previousSource.pathCount;
      if (source.pathCount > previousPathCount) {
        const operations: FileTreeBatchOperation[] = [];
        for (let index = previousPathCount; index < source.pathCount; index++) {
          operations.push({ type: "add", path: source.paths[index] });
        }
        if (operations.length > 0) model.batch(operations);
      }
    } else {
      model.resetPaths(source.paths.slice(0, source.pathCount));
    }
    model.setGitStatus(source.gitStatus);
  }, [model, source]);

  useEffect(() => {
    onModelReady?.(model);
    return () => onModelReady?.(null);
  }, [model, onModelReady]);

  return (
    <ThemedFileTree
      className={styles.tree}
      model={model}
      reconcileForegroundFromChrome
      style={FILE_TREE_DENSITY_OVERRIDE_STYLES}
    />
  );
});
