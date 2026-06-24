import type { DiffLineAnnotation, LineAnnotation } from "@pierre/diffs";

import type { CommentMetadata, SavedCommentMetadata } from "./types";

// Companion to `isDraftAnnotation` — narrows the union of file/diff
// annotations to the saved variant. Same rationale: a saved comment
// retains its `range` and `message` regardless of whether it was anchored
// on a diff line (with side) or a file line (without side).
export function isSavedAnnotation(
  annotation: DiffLineAnnotation<CommentMetadata> | LineAnnotation<CommentMetadata>,
): annotation is
  | DiffLineAnnotation<SavedCommentMetadata>
  | LineAnnotation<SavedCommentMetadata> {
  return annotation.metadata.kind === "saved";
}
