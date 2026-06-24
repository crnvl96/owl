import type { OwlSavedCommentEntry } from "./types";

export function insertCommentInLineOrder(
  comments: readonly OwlSavedCommentEntry[],
  entry: OwlSavedCommentEntry,
): OwlSavedCommentEntry[] {
  let existingIndex = -1;
  for (let index = 0; index < comments.length; index++) {
    if (comments[index]?.key === entry.key) {
      existingIndex = index;
      break;
    }
  }

  const nextComments =
    existingIndex === -1
      ? [...comments]
      : comments.filter((_, index) => index !== existingIndex);

  let insertIndex = nextComments.length;
  for (let index = 0; index < nextComments.length; index++) {
    const comment = nextComments[index];
    // Sort by the start of each comment's range, not the anchor line, so a
    // multi-line comment (e.g. lines 7-10) is ordered by where the selection
    // begins, matching how it reads in the diff and in the sidebar label.
    if (comment != null && entry.range.start < comment.range.start) {
      insertIndex = index;
      break;
    }
  }

  nextComments.splice(insertIndex, 0, entry);
  return nextComments;
}
