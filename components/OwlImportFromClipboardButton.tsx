"use client";

import { useStableCallback } from "@pierre/diffs/react";
import { IconPaperclip } from "@pierre/icons";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CHROME_ICON_BUTTON_CLASS } from "./chromeButtonStyles";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import type { DiffSource } from "@/lib/types";

const DEFAULT_CLIPBOARD_FILE_NAME = "clipboard.md";

type ReadState = "idle" | "reading" | "active" | "failed";

const READING_DURATION_MS = 1200;
const FAILED_DURATION_MS = 1600;

interface OwlImportFromClipboardButtonProps {
  className?: string;
  onSelectSource(source: DiffSource): void;
  source: DiffSource;
}

// Icon button in the header that reads the system clipboard, switches the
// viewer's source to a synthetic single-file item, and lets the user
// review the pasted content. In clipboard mode, the button stays
// highlighted (`aria-pressed`) so the user can see at a glance which
// source is active; clicking it again re-reads the clipboard and
// replaces the current file with a fresh one.
export function OwlImportFromClipboardButton({
  className,
  onSelectSource,
  source,
}: OwlImportFromClipboardButtonProps) {
  const isClipboardActive = source.kind === "clipboard";
  // Local visual state machine for the "reading…" / "failed" affordances.
  // We layer this on top of `isClipboardActive` so the button can show
  // brief transient feedback without affecting the persistent
  // `aria-pressed` state.
  const [readState, setReadState] = useState<ReadState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleClick = useStableCallback(() => {
    if (typeof navigator === "undefined" || navigator.clipboard?.readText == null) {
      setReadState("failed");
      toast.error("Clipboard read is not supported in this browser.");
      scheduleRevert(FAILED_DURATION_MS);
      return;
    }

    setReadState("reading");

    void (async () => {
      try {
        const content = await navigator.clipboard.readText();
        if (content.length === 0) {
          setReadState("failed");
          toast.error("Clipboard is empty.");
          scheduleRevert(FAILED_DURATION_MS);
          return;
        }
        onSelectSource({
          kind: "clipboard",
          content,
          fileName: DEFAULT_CLIPBOARD_FILE_NAME,
        });
        setReadState("active");
        scheduleRevert(READING_DURATION_MS);
      } catch (error) {
        setReadState("failed");
        const message =
          error instanceof Error ? error.message : "Couldn’t read the clipboard.";
        toast.error(message);
        scheduleRevert(FAILED_DURATION_MS);
      }
    })();
  });

  const scheduleRevert = (durationMs: number) => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setReadState("idle");
      timeoutRef.current = null;
    }, durationMs);
  };

  const title =
    readState === "reading"
      ? "Reading clipboard…"
      : readState === "failed"
        ? "Clipboard read failed"
        : isClipboardActive
          ? "Re-read clipboard"
          : "Import content from clipboard";

  const isActive = isClipboardActive || readState === "active";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-md"
      aria-pressed={isActive}
      title={title}
      aria-label={title}
      className={cn(CHROME_ICON_BUTTON_CLASS, className)}
      onClick={handleClick}
    >
      <IconPaperclip className="size-4 md:size-3" />
    </Button>
  );
}
