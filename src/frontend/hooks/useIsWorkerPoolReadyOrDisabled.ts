"use client";

import { useWorkerPool } from "@pierre/diffs/react";
import { useEffect, useRef, useState } from "react";

export function useIsWorkerPoolReadyOrDisabled() {
  const workerPool = useWorkerPool();
  const [isReady, setIsReady] = useState(() => workerPool?.isInitialized() ?? true);
  const isReadyRef = useRef(isReady);
  useEffect(() => {
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
