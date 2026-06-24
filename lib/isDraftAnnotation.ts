import type { DiffLineAnnotation, LineAnnotation } from "@pierre/diffs";

import { isDraftMetadata } from "./isDraftMetadata";
import type { CommentMetadata, DraftCommentMetadata } from "./types";

// Used for both diff and file items. The viewer creates a
// `DiffLineAnnotation<CommentMetadata>` when a draft is opened on a diff
// (line + side) and a plain `LineAnnotation<CommentMetadata>` when the draft
// is on a single-file (clipboard) item (line only). The metadata shape is
// identical between the two, so the predicate just narrows on
// `metadata.kind` and the return type is a union to match the input.
export function isDraftAnnotation(
  annotation: DiffLineAnnotation<CommentMetadata> | LineAnnotation<CommentMetadata>,
): annotation is
  | DiffLineAnnotation<DraftCommentMetadata>
  | LineAnnotation<DraftCommentMetadata> {
  return isDraftMetadata(annotation.metadata);
}
