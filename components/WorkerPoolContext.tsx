"use client";

import {
  type WorkerInitializationRenderOptions,
  WorkerPoolContextProvider,
  type WorkerPoolOptions,
} from "@pierre/diffs/react";
import type { ReactNode } from "react";

import { getPoolOptions, HIGHLIGHTER_OPTIONS } from "@/lib/config";

interface WorkerPoolProps {
  children: ReactNode;
  highlighterOptions?: WorkerInitializationRenderOptions;
  poolOptions?: WorkerPoolOptions;
}

export function WorkerPoolContext({
  children,
  highlighterOptions = HIGHLIGHTER_OPTIONS,
  poolOptions = getPoolOptions(),
}: WorkerPoolProps) {
  return (
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={highlighterOptions}
    >
      {children}
    </WorkerPoolContextProvider>
  );
}
