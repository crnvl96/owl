"use client";

import { useStableCallback } from "@pierre/diffs/react";
import { IconCheck, IconFileExport } from "@pierre/icons";
import { useEffect, useRef, useState } from "react";

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
        const report = generateReviewReport({ fileContextByItemId, sections, source });
        await navigator.clipboard.writeText(report);
        setCopyState("copied");
      } catch {
        setCopyState("failed");
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
