import type { GitStatus } from "@pierre/trees";

import { formatCommentLineLabel } from "./formatCommentLineLabel";
import type { DiffSource, OwlSavedCommentEntry, OwlSavedCommentItem } from "./types";

// Compact summary of a hunk's boundaries, extracted from the full
// `FileDiffMetadata.hunks` array on the loaded diff items. We only keep
// the four numbers the unified-diff `@@ -X,Y +A,B @@` header needs; the
// full `Hunk` carries token-level diff data we don't need for the report.
export interface HunkSummary {
  additionCount: number;
  additionStart: number;
  deletionCount: number;
  deletionStart: number;
}

// Per-file metadata the report generator needs that isn't already on
// `OwlSavedCommentItem`. The map is keyed by `itemId` so the report
// can look up the right file's context in O(1) while iterating sections.
export interface FileContext {
  hunks: readonly HunkSummary[];
  status: GitStatus;
}

interface GenerateReviewReportInput {
  fileContextByItemId: ReadonlyMap<string, FileContext>;
  // Path to a temp file on disk where the report's source content lives,
  // populated only for the clipboard source. The report's header echoes
  // it so an agent reading the markdown can `cat` the original to get more
  // context (the spec asks for this on the clipboard flow specifically;
  // diff sources never produce a file path).
  importedFilePath?: string;
  sections: readonly OwlSavedCommentItem[];
  source: DiffSource;
}

// Each saved comment is bucketed by which side(s) of the diff its range
// touches, so the report surfaces the categories an agent needs to act on
// (remove, add, rewrite across both) without the agent having to re-derive
// them from the diff:
type CommentBucket = "removed" | "added" | "mixed" | "context";

// Bucket display order in the report. Kept as a separate constant so the
// order is obvious at a glance and the bucket-to-header map stays a plain
// Record.
const BUCKET_ORDER: readonly CommentBucket[] = ["removed", "added", "mixed", "context"];

const BUCKET_HEADERS: Record<CommentBucket, string> = {
  removed: "Removed",
  added: "Added",
  mixed: "Mixed",
  context: "Context",
};

// Short tag prefix for the file header. `untracked` collapses to `A` because
// the agent only cares that the file is new; `ignored` shouldn't ever appear
// in a diff's git status. Anything missing from this map falls back to `M`
// in `formatFileStatusTag`.
const STATUS_TAGS: Partial<Record<GitStatus, string>> = {
  added: "A",
  deleted: "D",
  modified: "M",
  renamed: "R",
  untracked: "A",
};

function formatFileStatusTag(status: GitStatus): string {
  return STATUS_TAGS[status] ?? "M";
}

function formatHunkHeader(hunk: HunkSummary): string {
  return `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`;
}

function categorizeComment(entry: OwlSavedCommentEntry): CommentBucket {
  const startSide = entry.range.side;
  const endSide = entry.range.endSide ?? entry.range.side;
  if (startSide == null && endSide == null) {
    return "context";
  }
  if (startSide === "deletions" && endSide === "deletions") {
    return "removed";
  }
  if (startSide === "additions" && endSide === "additions") {
    return "added";
  }
  return "mixed";
}

function describeDiffSource(source: DiffSource): string {
  switch (source.kind) {
    case "worktree":
      return "Worktree (uncommitted changes)";
    case "pastCommit":
      // Short hash is enough for an agent to resolve the commit via
      // `git show <hash>` or the host's commit picker; the full hash
      // would just bloat every report.
      return `Past commit ${source.hash.slice(0, 7)}`;
    case "branchCompare":
      return `Branch compare: ${source.branch}`;
    case "clipboard":
      return "Imported from clipboard";
  }
}

// Returns the subset of hunks that contain at least one comment in the
// given section, preserving the hunks' original (file-order) sequence so
// the report reads top-to-bottom the way the diff does. Each comment's
// start line is checked against both sides of the hunk — context comments
// don't carry a side, and any change-side comment is also "in" the same
// hunk on the other side as long as the line falls in range.
function findHunksForSection(
  hunks: readonly HunkSummary[],
  comments: readonly OwlSavedCommentEntry[],
): HunkSummary[] {
  const usedHunkIndices = new Set<number>();
  for (const comment of comments) {
    const startLine = comment.range.start;
    for (let index = 0; index < hunks.length; index++) {
      const hunk = hunks[index];
      if (hunk == null || usedHunkIndices.has(index)) {
        continue;
      }
      const isInHunk =
        (startLine >= hunk.additionStart &&
          startLine < hunk.additionStart + hunk.additionCount) ||
        (startLine >= hunk.deletionStart &&
          startLine < hunk.deletionStart + hunk.deletionCount);
      if (isInHunk) {
        usedHunkIndices.add(index);
      }
    }
  }
  return hunks.filter((_, index) => usedHunkIndices.has(index));
}

// Indents continuation lines by two spaces so multi-line messages stay part
// of the same markdown list item instead of breaking into separate items
// (which would lose the line-range label on the continuation lines).
function formatMessage(message: string): string {
  return message
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .join("\n  ");
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

// Builds a structured markdown report of all saved comments for the current
// diff, grouped per file with per-side subsections. The report is meant to
// be pasted into an AI agent chat, so the format is optimized for
// unambiguous parsing: file paths are bare (no `inline code` wrapping that
// the agent would have to strip), line labels use the same `Line +N` /
// `Lines +N-+M` notation the sidebar already shows, and each comment is a
// single bullet with the line label as a bold lead-in.
export function generateReviewReport(input: GenerateReviewReportInput): string {
  const { fileContextByItemId, importedFilePath, sections, source } = input;
  const generatedAt = new Date().toISOString();

  let totalComments = 0;
  for (const section of sections) {
    totalComments += section.comments.length;
  }

  const output: string[] = [];
  output.push("# Code Review Report");
  output.push("");
  output.push(`- **Diff source:** ${describeDiffSource(source)}`);
  // Emitted only when the report came from the clipboard source. The
  // path is the temp file written at report-generation time, so the
  // agent can resolve the file the user was reviewing without having
  // to re-derive it from the comments.
  if (importedFilePath != null) {
    output.push(`- **File path:** ${importedFilePath}`);
  }
  output.push(`- **Generated:** ${generatedAt}`);
  output.push(`- **Files with comments:** ${sections.length}`);
  output.push(`- **Total comments:** ${totalComments}`);
  output.push("");
  output.push("---");
  output.push("");

  for (const section of sections) {
    const fileContext = fileContextByItemId.get(section.itemId);
    // Status tags (`[A]/[M]/[D]/[R]`) are git-diff vocabulary and only
    // make sense for diff sources. The clipboard source produces a
    // single synthetic file saved under `importedFilePath`; tagging it
    // `[M]` would actively mislead an agent into thinking the file
    // exists in the worktree. So we omit the tag for clipboard sources
    // and keep the existing `M` fallback for diff sources when context
    // is missing (e.g. a comment added before the tree finished
    // hydrating).
    const statusTag =
      source.kind === "clipboard"
        ? null
        : fileContext == null
          ? "M"
          : formatFileStatusTag(fileContext.status);
    // Section file name: for the clipboard source, use the full on-disk
    // path verbatim so the section header is self-sufficient — the
    // agent shouldn't have to combine information from two lines (the
    // `**File path:**` header above and this section header) to find
    // the file. The synthetic name the viewer used (`clipboard.md`)
    // does not exist on disk, so naming the section after it would be
    // misleading in the same way the `[M]` tag was.
    const sectionFileName =
      source.kind === "clipboard" && importedFilePath != null
        ? importedFilePath
        : section.path;

    const buckets = new Map<CommentBucket, OwlSavedCommentEntry[]>();
    for (const comment of section.comments) {
      const bucket = categorizeComment(comment);
      let entries = buckets.get(bucket);
      if (entries == null) {
        entries = [];
        buckets.set(bucket, entries);
      }
      entries.push(comment);
    }

    const fileTotal = section.comments.length;
    const fileHeader =
      statusTag == null
        ? `## ${sectionFileName} (${fileTotal} ${pluralize(fileTotal, "comment", "comments")})`
        : `## [${statusTag}] ${sectionFileName} (${fileTotal} ${pluralize(fileTotal, "comment", "comments")})`;
    output.push(fileHeader);
    output.push("");

    if (fileContext != null) {
      const hunksWithComments = findHunksForSection(
        fileContext.hunks,
        section.comments,
      );
      if (hunksWithComments.length > 0) {
        // List the hunks that actually contain a comment, in file order,
        // so the agent can match each line label back to a hunk without
        // having to re-derive the diff just to find the boundaries.
        const hunkHeaders = hunksWithComments.map(formatHunkHeader).join(", ");
        output.push(`Hunks: ${hunkHeaders}`);
        output.push("");
      }
    }

    for (const bucket of BUCKET_ORDER) {
      const entries = buckets.get(bucket);
      // Omit empty buckets per the spec: showing "Removed (0)" for files
      // that only have additions would force the agent to skim four
      // subsections per file to find the one that matters.
      if (entries == null || entries.length === 0) {
        continue;
      }

      const bucketCount = entries.length;
      output.push(
        `### ${BUCKET_HEADERS[bucket]} (${bucketCount} ${pluralize(bucketCount, "comment", "comments")})`,
      );
      output.push("");

      for (const entry of entries) {
        const label = formatCommentLineLabel(entry.range, entry.lineType);
        const message = formatMessage(entry.message);
        output.push(`- **${label}:** ${message}`);
      }
      output.push("");
    }
  }

  return output.join("\n").trimEnd() + "\n";
}
