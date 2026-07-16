import { type Dispatch, memo, type SetStateAction } from "react";
import {
  IconCollapsedRow,
  IconDiffSplit,
  IconDiffUnified,
  IconExpandAll,
  IconFileTreeFill,
} from "@pierre/icons";

import { CHROME_ICON_BUTTON_CLASS } from "./chromeButtonStyles";
import { OwlLogo } from "./OwlLogo";
import { useChromeThemeProps } from "./useChromeThemeProps";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";

interface HeaderProps {
  className?: string;
  collapseMode: "expanded" | "collapsed";
  diffStyle: "split" | "unified";
  fileTreeAvailable: boolean;
  fileTreeOverlayOpen: boolean;
  onToggleCollapseMode(): void;
  onToggleFileTreeOverlay(): void;
  setDiffStyle: Dispatch<SetStateAction<"split" | "unified">>;
}

export const OwlHeader = memo(function OwlHeader({
  className,
  collapseMode,
  diffStyle,
  fileTreeAvailable,
  fileTreeOverlayOpen,
  onToggleCollapseMode,
  onToggleFileTreeOverlay,
  setDiffStyle,
}: HeaderProps) {
  // Pull the resolved Shiki theme so the header bar lives on the same
  // surface (background, text, icons, borders) as the sidebar. Falls back to
  // the owl-sidebar-bg CSS variable on first render while the theme is
  // still resolving.
  const { style: headerChromeStyle } = useChromeThemeProps(owlChromeMapping);
  const themeChromeStyle =
    Object.keys(headerChromeStyle).length > 0 ? headerChromeStyle : undefined;
  return (
    <div
      className={cn(
        "z-10 contain-layout contain-paint flex flex-wrap md:flex-nowrap items-center gap-2.5 pt-3 pb-2 px-4 md:px-3 md:py-1.5 border-b border-[var(--color-border-opaque)]",
        themeChromeStyle == null && "bg-background md:bg-[var(--owl-sidebar-bg)]",
        className,
      )}
      style={themeChromeStyle}
    >
      <OwlLogo className="absolute top-4 left-[50%] -translate-x-1/2 md:static md:translate-x-0" />
      <div className="flex w-full items-center justify-between gap-2 md:ml-auto md:w-auto md:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          aria-pressed={fileTreeOverlayOpen}
          disabled={!fileTreeAvailable}
          title={fileTreeOverlayOpen ? "Hide file tree" : "Show file tree"}
          className={cn(CHROME_ICON_BUTTON_CLASS, "md:hidden")}
          onClick={onToggleFileTreeOverlay}
        >
          <IconFileTreeFill className="size-4 md:size-3" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="bg-border/60 hidden h-5 w-px md:block" aria-hidden="true" />
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              title={
                diffStyle === "split"
                  ? "Switch to unified view"
                  : "Switch to split view"
              }
              className={cn(CHROME_ICON_BUTTON_CLASS, "hidden md:flex")}
              onClick={() => setDiffStyle(diffStyle === "split" ? "unified" : "split")}
            >
              {diffStyle === "split" ? (
                <IconDiffSplit className="size-4 md:size-3" />
              ) : (
                <IconDiffUnified className="size-4 md:size-3" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              aria-pressed={collapseMode === "collapsed"}
              title={
                collapseMode === "expanded" ? "Collapse all files" : "Expand all files"
              }
              className={CHROME_ICON_BUTTON_CLASS}
              onClick={onToggleCollapseMode}
            >
              {collapseMode === "expanded" ? (
                <IconExpandAll className="size-4 md:size-3" />
              ) : (
                <IconCollapsedRow className="size-4 md:size-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <hr className="border-border/80 w-full md:hidden" />
    </div>
  );
});
