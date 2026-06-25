"use client";

import { IconMinus, IconPlus } from "@pierre/icons";

import { CHROME_ICON_BUTTON_CLASS } from "./chromeButtonStyles";
import {
  isAtAppFontSizeMax,
  isAtAppFontSizeMin,
  nextAppFontSize,
  type AppFontSizeStep,
} from "@/lib/appFontSize";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

interface OwlFontSizeControlProps {
  value: AppFontSizeStep;
  onChange(next: AppFontSizeStep): void;
  className?: string;
}

// Three ghost buttons wired to a single value: the icons step the value by
// 4px, the middle label shows the current size. Sits in the header's action
// row alongside the diff-style / collapse toggles; uses the same chrome
// styling and `icon-md` size so the row stays flush.
export function OwlFontSizeControl({
  value,
  onChange,
  className,
}: OwlFontSizeControlProps) {
  const atMin = isAtAppFontSizeMin(value);
  const atMax = isAtAppFontSizeMax(value);
  const handleDecrease = () => {
    if (atMin) {
      return;
    }
    onChange(nextAppFontSize(value, -1) as AppFontSizeStep);
  };
  const handleIncrease = () => {
    if (atMax) {
      return;
    }
    onChange(nextAppFontSize(value, 1) as AppFontSizeStep);
  };
  return (
    <div className={cn("flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        title="Decrease font size"
        aria-label="Decrease font size"
        disabled={atMin}
        className={CHROME_ICON_BUTTON_CLASS}
        onClick={handleDecrease}
      >
        <IconMinus className="size-4 md:size-3" />
      </Button>
      <span
        aria-live="polite"
        aria-atomic="true"
        title="Font size"
        // `min-w-12` is wide enough for "32px" at any step; `tabular-nums`
        // keeps the digits from shifting width when the value changes.
        className="text-muted-foreground/80 inline-flex h-8 min-w-12 items-center justify-center px-2 text-sm font-medium tabular-nums"
      >
        {value}px
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        title="Increase font size"
        aria-label="Increase font size"
        disabled={atMax}
        className={CHROME_ICON_BUTTON_CLASS}
        onClick={handleIncrease}
      >
        <IconPlus className="size-4 md:size-3" />
      </Button>
    </div>
  );
}
