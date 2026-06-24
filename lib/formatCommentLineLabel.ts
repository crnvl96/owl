import type { SelectedLineRange, SelectionSide } from "@pierre/diffs";

import type { CommentLineType } from "./types";

// Renders a comment's "Line N" / "Line +N" / "Lines N..M" / "Lines +N..+M"
// label from the saved range, so a multi-line comment is shown as the full
// range it covers (with per-side sigils when start and end are on different
// sides of the diff) instead of being collapsed to a single anchor line.
//
// The range separator is `..` (not `-`) so a same-side range like
// `-42..-45` is visually unambiguous — the `-` sigil can no longer run
// into the separator and produce `Lines -42--45`, which an agent might
// mis-tokenize as `-42` + `--` + `45`. `..` is also used by Python, Rust,
// and jq for ranges, so it parses naturally for code-oriented models.
//
// Shared between the sidebar (DiffsHubCommentsList) and the review report
// generator (generateReviewReport) so the line label an agent sees in the
// markdown paste matches exactly what the user saw in the UI.
export function formatCommentLineLabel(
  range: SelectedLineRange,
  lineType: CommentLineType,
): string {
  const startSide = range.side;
  const endSide = range.endSide ?? range.side;
  const isSingleLine = range.start === range.end && startSide === endSide;

  if (isSingleLine) {
    return `Line ${formatLineNumber(range.start, startSide, lineType)}`;
  }

  const startLabel = formatLineNumber(range.start, startSide, lineType);
  const endLabel = formatLineNumber(range.end, endSide, lineType);
  return `Lines ${startLabel}..${endLabel}`;
}

function formatLineNumber(
  lineNumber: number,
  side: SelectionSide | undefined,
  lineType: CommentLineType,
): string {
  if (lineType === "context" || side == null) {
    return `${lineNumber}`;
  }
  const sigil = side === "additions" ? "+" : "-";
  return `${sigil}${lineNumber}`;
}
