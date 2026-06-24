import type { AnnotationSide, SelectedLineRange } from "@pierre/diffs";
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

// What the viewer is currently rendering. The four kinds are mutually
// exclusive: `worktree` shows the local uncommitted changes of the resolved
// worktree, `pastCommit` shows the diff introduced by a specific commit
// resolved from the same worktree's object database, `branchCompare` shows
// the diff between the current branch and another branch (three-dot:
// changes on HEAD since the merge base), and `clipboard` renders a single
// non-diff file built from text the user pasted from outside Owl. The
// clipboard kind is the only one that does not consult git — it renders a
// `CodeViewFileItem` instead of a `CodeViewDiffItem` and lets the user
// comment on it the same way they would on a diff. Both `pastCommit` and
// `branchCompare` are independent of the working tree (git reads from the
// object database), so a dirty worktree does not gate switching between
// modes; `clipboard` is independent of git entirely.
export type DiffSource =
  | { kind: "worktree" }
  | { kind: "pastCommit"; hash: string }
  | { kind: "branchCompare"; branch: string }
  | { kind: "clipboard"; content: string; fileName?: string };

export interface SavedCommentMetadata {
  kind: "saved";
  key: string;
  message: string;
  range: SelectedLineRange;
}

export interface DraftCommentMetadata {
  kind: "draft";
  key: string;
  message: string;
  range: SelectedLineRange;
}

export type CommentMetadata = SavedCommentMetadata | DraftCommentMetadata;

export interface OwlCommentSidebarFile {
  fileOrder: number;
  path: string;
}

export type OwlCommentFileByItemId = ReadonlyMap<string, OwlCommentSidebarFile>;

// Whether the line the comment is anchored to is a real addition/deletion or
// an unchanged context line shown in the diff. Tracked so the sidebar can
// render "Line N" without a misleading + / - sigil for context lines.
export type CommentLineType = "change" | "context";

export interface OwlSavedCommentEvent {
  itemId: string;
  key: string;
  lineNumber: number;
  lineType: CommentLineType;
  message: string;
  range: SelectedLineRange;
  // `side` is `undefined` for comments anchored on a single-file
  // (clipboard) item, where there is no addition/deletion distinction.
  // Diff-mode comments always populate it. Mirrors the same field on
  // `OwlSavedCommentEntry` so the two stay in sync.
  side?: AnnotationSide;
}

export interface OwlDeletedCommentEvent {
  itemId: string;
  key: string;
}

export interface OwlSavedCommentEntry {
  itemId: string;
  key: string;
  lineNumber: number;
  lineType: CommentLineType;
  message: string;
  range: SelectedLineRange;
  // `side` is `undefined` for comments anchored on a single-file (clipboard)
  // item, where there is no addition/deletion distinction. Diff-mode
  // comments always populate it. The type is the same `SelectedLineRange`
  // used by the rest of the pipeline, which already models `side` as
  // optional; making the field optional here too lets the same `CommentMetadata`
  // shape flow through both rendering modes without a parallel struct.
  side?: AnnotationSide;
}

export interface OwlSavedCommentItem {
  comments: OwlSavedCommentEntry[];
  fileOrder: number;
  itemId: string;
  path: string;
}

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
