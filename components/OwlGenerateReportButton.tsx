"use client";

import { useStableCallback } from "@pierre/diffs/react";
import { IconCheck, IconFileExport } from "@pierre/icons";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CHROME_ICON_BUTTON_CLASS } from "./chromeButtonStyles";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { generateReviewReport, type FileContext } from "@/lib/generateReviewReport";
import type { DiffSource, OwlSavedCommentItem } from "@/lib/types";

type CopyState = "idle" | "copied" | "failed";

// How long the "Copied!" confirmation stays visible. Short enough to feel
// responsive if the user generates a second report quickly, long enough to
// be noticeable without becoming a sticky state.
const COPIED_DURATION_MS = 1600;

interface ClipboardSnapshotSuccessResponse {
  path: string;
}

interface OwlGenerateReportButtonProps {
  className?: string;
  fileContextByItemId: ReadonlyMap<string, FileContext>;
  sections: readonly OwlSavedCommentItem[];
  source: DiffSource;
}

// Icon button in the header that generates a markdown review report from
// the current diff's saved comments and copies it to the clipboard.
//
// Disabled when there are no comments (nothing to report). After a
// successful copy the icon swaps to a checkmark and the title changes to
// "Copied!" for COPIED_DURATION_MS, then both revert. A clipboard failure
// (insecure context, permission denied) leaves the title on "Copy failed"
// for the same window so the user gets a clear signal that nothing was
// written, without throwing or surfacing a dialog.
//
// The clipboard source has a slightly different flow: before assembling
// the report, the button asks the server to write the imported content
// to a fresh file in the OS temp directory, then includes that file's
// absolute path in the report header. The temp file is the artifact the
// agent reads to recover the original content the user was reviewing.
export function OwlGenerateReportButton({
  className,
  fileContextByItemId,
  sections,
  source,
}: OwlGenerateReportButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop any pending revert-to-idle timer if the button unmounts mid-window
  // (e.g. the user navigates away before the 1.6s elapses), so we don't
  // call setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const hasComments = sections.some((section) => section.comments.length > 0);
  const isDisabled = !hasComments;

  const handleClick = useStableCallback(() => {
    if (isDisabled) {
      return;
    }

    void (async () => {
      try {
        const importedFilePath =
          source.kind === "clipboard"
            ? await writeClipboardSnapshot(source.content)
            : undefined;
        const report = generateReviewReport({
          fileContextByItemId,
          importedFilePath,
          sections,
          source,
        });
        await navigator.clipboard.writeText(report);
        setCopyState("copied");
      } catch (error) {
        setCopyState("failed");
        const message =
          error instanceof Error ? error.message : "Couldn’t generate report.";
        toast.error(message);
      }

      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopyState("idle");
        timeoutRef.current = null;
      }, COPIED_DURATION_MS);
    })();
  });

  const title =
    copyState === "copied"
      ? "Copied!"
      : copyState === "failed"
        ? "Copy failed"
        : isDisabled
          ? "No comments to report"
          : "Generate review report";

  const Icon = copyState === "copied" ? IconCheck : IconFileExport;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-md"
      disabled={isDisabled}
      title={title}
      aria-label={title}
      className={cn(CHROME_ICON_BUTTON_CLASS, className)}
      onClick={handleClick}
    >
      <Icon className="size-4 md:size-3" />
    </Button>
  );
}

// Posts the imported content to the server, which writes it to a
// fresh file in `os.tmpdir()` and returns the absolute path. The path
// is the value the report header echoes so an agent can re-read the
// exact file the user was reviewing.
async function writeClipboardSnapshot(content: string): Promise<string> {
  const response = await fetch("/api/clipboard-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail.length > 0 ? detail : `Snapshot failed (${response.status}).`,
    );
  }
  const payload = (await response.json()) as ClipboardSnapshotSuccessResponse;
  return payload.path;
}
