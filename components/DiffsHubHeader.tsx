import { type Dispatch, memo, type SetStateAction, useMemo } from "react";
import {
  IconCollapsedRow,
  IconDiffSplit,
  IconDiffUnified,
  IconExpandAll,
  IconFileTreeFill,
  IconGearFill,
} from "@pierre/icons";

import { CHROME_ICON_BUTTON_CLASS } from "./chromeButtonStyles";
import { DiffsHubDiffModePicker } from "./DiffsHubDiffModePicker";
import { DiffsHubLogo } from "./DiffsHubLogo";
import { useChromeThemeProps } from "./useChromeThemeProps";
import { Button } from "@/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu";
import { Switch } from "@/components/Switch";
import { cn } from "@/lib/cn";
import { diffshubChromeMapping } from "@/lib/theme/diffshubChromeMapping";
import { getDropdownThemeStyle } from "@/lib/theme/dropdownChromeStyle";
import type { DiffSource } from "@/lib/types";

const SETTING_ROW_CLASS =
  "w-full flex cursor-pointer items-center justify-between gap-4 px-2 py-1.5 text-sm";

interface HeaderProps {
  className?: string;
  collapseMode: "expanded" | "collapsed";
  diffSource: DiffSource;
  diffStyle: "split" | "unified";
  fileTreeAvailable: boolean;
  fileTreeOverlayOpen: boolean;
  overflow: "wrap" | "scroll";
  onSelectDiffSource(source: DiffSource): void;
  onToggleCollapseMode(): void;
  onToggleFileTreeOverlay(): void;
  setDiffStyle: Dispatch<SetStateAction<"split" | "unified">>;
  setOverflow: Dispatch<SetStateAction<"wrap" | "scroll">>;
}

export const DiffsHubHeader = memo(function DiffsHubHeader({
  className,
  collapseMode,
  diffSource,
  diffStyle,
  fileTreeAvailable,
  fileTreeOverlayOpen,
  overflow,
  onSelectDiffSource,
  onToggleCollapseMode,
  onToggleFileTreeOverlay,
  setDiffStyle,
  setOverflow,
}: HeaderProps) {
  // Pull the resolved Shiki theme so the header bar lives on the same
  // surface (background, text, icons, borders) as the sidebar. Falls back to
  // the diffshub-sidebar-bg CSS variable on first render while the theme is
  // still resolving.
  const { style: headerChromeStyle } = useChromeThemeProps(diffshubChromeMapping);
  const themeChromeStyle =
    Object.keys(headerChromeStyle).length > 0 ? headerChromeStyle : undefined;
  const dropdownThemeStyle = useMemo(
    () => getDropdownThemeStyle(themeChromeStyle),
    [themeChromeStyle],
  );
  return (
    <div
      className={cn(
        "z-10 contain-layout contain-paint flex flex-wrap md:flex-nowrap items-center gap-2.5 pt-3 pb-2 px-4 md:px-3 md:py-1.5 border-b border-[var(--color-border-opaque)]",
        themeChromeStyle == null && "bg-background md:bg-[var(--diffshub-sidebar-bg)]",
        className,
      )}
      style={themeChromeStyle}
    >
      <DiffsHubLogo className="absolute top-4 left-[50%] -translate-x-1/2 md:static md:translate-x-0" />
      <DiffsHubDiffModePicker
        source={diffSource}
        onSelectSource={onSelectDiffSource}
        className="hidden md:flex"
      />
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
        <DiffsHubDiffModePicker
          source={diffSource}
          onSelectSource={onSelectDiffSource}
          className="md:hidden"
        />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-md"
                  aria-label="Display settings"
                  title="Display settings"
                  className={CHROME_ICON_BUTTON_CLASS}
                >
                  <IconGearFill className="size-4 md:size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-58 p-2"
                style={dropdownThemeStyle}
              >
                <DropdownMenuItem
                  className="cursor-default p-0"
                  onSelect={(e) => e.preventDefault()}
                >
                  <label className={SETTING_ROW_CLASS}>
                    <span className="min-w-0 flex-1">Word wrap</span>
                    <Switch
                      checked={overflow === "wrap"}
                      onCheckedChange={(checked) =>
                        setOverflow(checked ? "wrap" : "scroll")
                      }
                    />
                  </label>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <hr className="border-border/80 w-full md:hidden" />
    </div>
  );
});
