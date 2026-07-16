import { DEFAULT_THEMES } from "@pierre/diffs";
import type { CodeViewLayout } from "@pierre/diffs";
import type {
  WorkerInitializationRenderOptions,
  WorkerPoolOptions,
} from "@pierre/diffs/react";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/** The single hardcoded theme used throughout the app. */
export const THEME_NAME = "pierre-dark-soft";
export const THEME_SCHEME = "dark" as const;

// ---------------------------------------------------------------------------
// Mobile detection
// ---------------------------------------------------------------------------

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function isMobileBrowser(): boolean {
  const nav = globalThis.navigator;
  if (nav == null) {
    return false;
  }
  return (
    nav.maxTouchPoints > 0 &&
    globalThis.matchMedia?.(`${MOBILE_MEDIA_QUERY}, (pointer: coarse)`).matches === true
  );
}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------

const MOBILE_POOL_OPTIONS = {
  poolSize: 1,
  totalASTLRUCacheSize: 10,
} as const;

const DESKTOP_POOL_OPTIONS = {
  poolSize: 3,
  totalASTLRUCacheSize: 100,
} as const;

export function getPoolOptions(): WorkerPoolOptions {
  const limits = isMobileBrowser() ? MOBILE_POOL_OPTIONS : DESKTOP_POOL_OPTIONS;
  return {
    poolSize: Math.min(
      Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 1) - 1),
      limits.poolSize,
    ),
    totalASTLRUCacheSize: limits.totalASTLRUCacheSize,
    workerFactory() {
      return new Worker(new URL("@pierre/diffs/worker/worker.js", import.meta.url), { type: "module" });
    },
  };
}

export const HIGHLIGHTER_OPTIONS = {
  theme: DEFAULT_THEMES,
  langs: [
    "cpp",
    "css",
    "go",
    "python",
    "rust",
    "sh",
    "swift",
    "tsx",
    "typescript",
    "zig",
  ],
  preferredHighlighter: "shiki-wasm",
} as const satisfies WorkerInitializationRenderOptions;

// ---------------------------------------------------------------------------
// Stream pipeline (patch loading)
// ---------------------------------------------------------------------------

export const STREAM_PUBLISH_INTERVAL_MS = 100;
export const STREAM_INITIAL_PUBLISH_INTERVAL_MS = 500;
export const STREAM_WORK_BUDGET_MS = 8;
export const STREAM_TREE_PUBLISH_FILE_BATCH_SIZE = 1_000;
export const STREAM_TREE_PUBLISH_INTERVAL_MS = 1_000;
export const GENERIC_PATCH_LOAD_ERROR_MESSAGE =
  "We couldn't load that diff. Check the URL and try again.";

// ---------------------------------------------------------------------------
// Code view
// ---------------------------------------------------------------------------

export const CODE_VIEW_LAYOUT: CodeViewLayout = {
  paddingTop: 0,
  gap: 1,
  paddingBottom: 0,
};

export const CODE_VIEW_CUSTOM_CSS = `
[data-diffs-header] {
  container-type: scroll-state;
  container-name: sticky-header;
}

@container sticky-header scroll-state(stuck: top) {
  [data-diffs-header]::after {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 1px;
    content: '';
    background-color: var(--owl-annotation-border);
  }
}
`;

export const CODE_VIEW_BATCH_COUNT = 25;
export const CODE_VIEW_BATCH_COUNT_MAX = 96;
export const CODE_VIEW_FILE_TREE_ITEM_HEIGHT = 24;

function getViewportHeight(): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  const h = window.visualViewport?.height ?? window.innerHeight;
  return Number.isFinite(h) && h > 0 ? h : null;
}

export function getInitialBatchSize(): number {
  const vh = getViewportHeight();
  if (vh == null) {
    return CODE_VIEW_BATCH_COUNT;
  }
  return Math.min(
    CODE_VIEW_BATCH_COUNT_MAX,
    Math.max(CODE_VIEW_BATCH_COUNT, Math.ceil(vh / CODE_VIEW_FILE_TREE_ITEM_HEIGHT)),
  );
}

// ---------------------------------------------------------------------------
// File tree
// ---------------------------------------------------------------------------

const HIDDEN_SEARCH_UNSAFE_CSS = `
  [data-file-tree-search-container][data-open='false'] {
    display: none;
  }
  [data-file-tree-search-container] {
    padding-bottom: 12px;
    margin-bottom: 12px;
    margin-right: 4px;
    border-bottom: 1px solid var(--color-border);
    padding-inline-start: 1px;
    padding-inline-end: 5px;
  }

  [data-file-tree-sticky-overlay-content] {
    box-shadow: 0 2px 3px -4px rgb(0 0 0 / 1);

    [data-item-section="spacing"] {
      opacity: 0.5;
    }

    > [data-file-tree-sticky-path]:last-of-type {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;

      [data-item-section="spacing"] {
        margin-bottom: 4px;
      }
    }
  }

  @media (prefers-color-scheme: dark) {
    [data-file-tree-sticky-overlay-content] {
      box-shadow: 0 3px 3px -3px rgb(0 0 0 / 80%);

      [data-item-section="spacing"] {
        opacity: 0.6;
      }
    }
  }
`;

const SIDEBAR_VIRTUALIZED_SCROLL_UNSAFE_CSS = `
  [data-file-tree-virtualized-scroll="true"] {
    padding-inline-start: 0;
    padding-inline-end: 2px;
    margin-inline-end: 2px;
  }

  @media (width <= 767px) {
    [data-file-tree-search-container="true"],
    [data-file-tree-virtualized-scroll="true"] {
      padding-inline-start: 14px;
    }

    [data-file-tree-search-container="true"] {
      margin-right: 0;
      padding-inline-end: 14px;
    }

    [data-file-tree-virtualized-scroll="true"] {
      padding-inline-end: max(0px, calc(14px - var(--trees-scrollbar-gutter)));
    }
  }
`;

const SUPPRESS_FOLDER_DOT_UNSAFE_CSS = `
  [data-item-contains-git-change='true'] > [data-item-section='git'] {
    display: none;
  }
`;

const FOLDER_LABEL_UNSAFE_CSS = `
  [data-item-type='folder'] {
    color: color-mix(in lab, light-dark(#000, #fff) 25%, var(--trees-fg));
    font-weight: 500;
  }
`;

import type { FileTreeOptions } from "@pierre/trees";

export const BASE_FILE_TREE_OPTIONS = {
  flattenEmptyDirectories: true,
  id: "gh-code-view-tree",
  initialExpansion: "open",
  presorted: true,
  search: true,
  stickyFolders: true,
  unsafeCSS: `${HIDDEN_SEARCH_UNSAFE_CSS}\n${SIDEBAR_VIRTUALIZED_SCROLL_UNSAFE_CSS}\n${SUPPRESS_FOLDER_DOT_UNSAFE_CSS}\n${FOLDER_LABEL_UNSAFE_CSS}`,
} as const satisfies Omit<FileTreeOptions, "paths" | "preparedInput">;

import type { FileTreeSortComparator } from "@pierre/trees";
import type { CSSProperties } from "react";

export const PRESERVE_INPUT_ORDER_SORT: FileTreeSortComparator = () => 0;

export const FILE_TREE_DENSITY_OVERRIDE_STYLES = {
  "--trees-density-override": 0.8,
  "--trees-padding-inline-override": 8,
  "--trees-git-renamed-color-override": "light-dark(#007aff, #007aff)",
} as CSSProperties;
