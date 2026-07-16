import type { GitStatusEntry } from "@pierre/trees";

// The workspace version of @pierre/trees exported this type and a
// corresponding FileTree.applyGitStatusPatch method. The published
// 1.0.0-beta.4 does not, so the type is defined here. Consumers fall back
// to FileTree.setGitStatus with the full GitStatusEntry array; this
// interface is still useful for documenting the diff format the
// accumulator builds.
export interface FileTreeGitStatusPatch {
  remove?: readonly string[];
  set?: readonly GitStatusEntry[];
}

export type ViewerLoadState = "fetching" | "streaming" | "parsing" | "ready" | "error";

// The viewer always shows the local uncommitted changes of the resolved
// worktree.
export type DiffSource = { kind: "worktree" };

// Annotation metadata carried on CodeView items. No annotations are
// created in the current viewer; the type exists to satisfy the
// `@pierre/diffs` generic parameter.
export type CommentMetadata = never;

export interface OwlCommentSidebarFile {
  fileOrder: number;
  path: string;
}

export type OwlCommentFileByItemId = ReadonlyMap<string, OwlCommentSidebarFile>;

// The fully pre-computed input this tree needs for a given fetch. It is built
// once at fetch time by snapshotOwlTreeSource and stored alongside the
// viewer items, so later per-item annotation updates do not feed into the
// tree and do not cause it to rebuild.
//
// Streamed publishes link successive snapshots through `previousSource` so the
// tree consumer can recognize append-only growth and apply the delta as
// `model.batch` adds instead of rebuilding the entire path store. The link is
// present only on snapshots that share the same underlying accumulator; the
// initial publish and any non-streamed source leave it undefined and force a
// full reset.
//
// `paths` and `pathToItemId` may alias the live accumulator state for
// streamed sources, so consumers must treat them as read-only and must use
// `pathCount` (captured at snapshot time) as the exclusive upper bound when
// iterating `paths`. The `readonly` markers and ReadonlyMap type enforce the
// read-only side; pathCount is what keeps later in-place growth invisible to
// this snapshot.
export interface OwlFileTreeSource {
  gitStatus: readonly GitStatusEntry[];
  gitStatusPatch?: FileTreeGitStatusPatch;
  pathCount: number;
  paths: readonly string[];
  pathToItemId: ReadonlyMap<string, string>;
  previousSource?: OwlFileTreeSource;
}

export interface OwlDiffStats {
  addedLines: number;
  deletedLines: number;
  fileCount: number;
  totalLinesOfCode: number;
}
