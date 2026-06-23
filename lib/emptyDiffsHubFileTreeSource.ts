import type { DiffsHubFileTreeSource } from './types';

// A stable, module-level empty file tree source. Used by the clean-worktree
// state (HTTP 422 from /api/local-worktree-diff) so the sidebar can mount
// with an empty file tree body and the chrome (tabs, search, diff stats,
// system monitor) stays visible.
//
// Frozen so consumers can rely on its identity never changing — passing the
// same reference to React state / props across renders avoids spurious
// re-renders and re-runs of the tree's effect.
export const EMPTY_DIFFSHUB_FILE_TREE_SOURCE: DiffsHubFileTreeSource = {
  gitStatus: [],
  pathCount: 0,
  paths: [],
  pathToItemId: new Map(),
};
