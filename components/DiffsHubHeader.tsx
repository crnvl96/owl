import type { DiffIndicators } from '@pierre/diffs';
import {
  IconCodeStyleBars,
  IconCollapsedRow,
  IconDiffSplit,
  IconDiffUnified,
  IconExpandAll,
  IconEyeSlash,
  IconFileTreeFill,
  IconGearFill,
  IconSymbolDiffstat,
} from '@pierre/icons';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useMemo,
} from 'react';

import { CHROME_ICON_BUTTON_CLASS } from './chromeButtonStyles';
import { DiffsHubLogo } from './DiffsHubLogo';
import { useChromeThemeProps } from './useChromeThemeProps';
import { Button } from '@/components/Button';
import { ButtonGroup, ButtonGroupItem } from '@/components/ButtonGroup';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/DropdownMenu';
import { Switch } from '@/components/Switch';
import { cn } from '@/lib/cn';
import { diffshubChromeMapping } from '@/lib/theme/diffshubChromeMapping';
import { getDropdownThemeStyle } from '@/lib/theme/dropdownChromeStyle';

const SETTING_ROW_CLASS =
  'w-full flex cursor-pointer items-center justify-between gap-4 px-2 py-1.5 text-sm';

interface HeaderProps {
  className?: string;
  collapseMode: 'expanded' | 'collapsed';
  diffIndicators: DiffIndicators;
  diffStyle: 'split' | 'unified';
  fileTreeAvailable: boolean;
  fileTreeOverlayOpen: boolean;
  lineNumbers: boolean;
  overflow: 'wrap' | 'scroll';
  onToggleCollapseMode(): void;
  onToggleFileTreeOverlay(): void;
  setDiffIndicators: Dispatch<SetStateAction<DiffIndicators>>;
  setDiffStyle: Dispatch<SetStateAction<'split' | 'unified'>>;
  setLineNumbers: Dispatch<SetStateAction<boolean>>;
  setOverflow: Dispatch<SetStateAction<'wrap' | 'scroll'>>;
  setShowBackgrounds: Dispatch<SetStateAction<boolean>>;
  showBackgrounds: boolean;
}

export const DiffsHubHeader = memo(function DiffsHubHeader({
  className,
  collapseMode,
  diffIndicators,
  diffStyle,
  fileTreeAvailable,
  fileTreeOverlayOpen,
  lineNumbers,
  overflow,
  onToggleCollapseMode,
  onToggleFileTreeOverlay,
  setDiffIndicators,
  setDiffStyle,
  setLineNumbers,
  setOverflow,
  setShowBackgrounds,
  showBackgrounds,
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
    [themeChromeStyle]
  );
  return (
    <div
      className={cn(
        'z-10 contain-layout contain-paint flex flex-wrap md:flex-nowrap items-center gap-2.5 pt-3 pb-2 px-4 md:px-3 md:py-1.5 border-b border-[var(--color-border-opaque)]',
        themeChromeStyle == null &&
          'bg-background md:bg-[var(--diffshub-sidebar-bg)]',
        className
      )}
      style={themeChromeStyle}
    >
      <DiffsHubLogo className="absolute top-4 left-[50%] -translate-x-1/2 md:static md:translate-x-0" />
      <div className="flex w-full items-center justify-between gap-2 md:ml-auto md:w-auto md:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          aria-pressed={fileTreeOverlayOpen}
          disabled={!fileTreeAvailable}
          title={fileTreeOverlayOpen ? 'Hide file tree' : 'Show file tree'}
          className={cn(CHROME_ICON_BUTTON_CLASS, 'md:hidden')}
          onClick={onToggleFileTreeOverlay}
        >
          <IconFileTreeFill className="size-4 md:size-3" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              title={
                diffStyle === 'split'
                  ? 'Switch to unified view'
                  : 'Switch to split view'
              }
              className={cn(CHROME_ICON_BUTTON_CLASS, 'hidden md:flex')}
              onClick={() =>
                setDiffStyle(diffStyle === 'split' ? 'unified' : 'split')
              }
            >
              {diffStyle === 'split' ? (
                <IconDiffSplit className="size-4 md:size-3" />
              ) : (
                <IconDiffUnified className="size-4 md:size-3" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-md"
              aria-pressed={collapseMode === 'collapsed'}
              title={
                collapseMode === 'expanded'
                  ? 'Collapse all files'
                  : 'Expand all files'
              }
              className={CHROME_ICON_BUTTON_CLASS}
              onClick={onToggleCollapseMode}
            >
              {collapseMode === 'expanded' ? (
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
                    <span className="min-w-0 flex-1">Backgrounds</span>
                    <Switch
                      checked={showBackgrounds}
                      onCheckedChange={setShowBackgrounds}
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-default p-0"
                  onSelect={(e) => e.preventDefault()}
                >
                  <label className={SETTING_ROW_CLASS}>
                    <span className="min-w-0 flex-1">Line numbers</span>
                    <Switch
                      checked={lineNumbers}
                      onCheckedChange={setLineNumbers}
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-default p-0"
                  onSelect={(e) => e.preventDefault()}
                >
                  <label className={SETTING_ROW_CLASS}>
                    <span className="min-w-0 flex-1">Word wrap</span>
                    <Switch
                      checked={overflow === 'wrap'}
                      onCheckedChange={(checked) =>
                        setOverflow(checked ? 'wrap' : 'scroll')
                      }
                    />
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="w-full px-2 focus:bg-transparent"
                  onSelect={(e) => e.preventDefault()}
                >
                  <span>Indicator style</span>
                  <ButtonGroup
                    className="ml-auto"
                    value={diffIndicators}
                    onValueChange={(value) =>
                      setDiffIndicators(value as DiffIndicators)
                    }
                  >
                    <ButtonGroupItem value="bars" className="size-7 p-0">
                      <IconCodeStyleBars className="size-3" />
                    </ButtonGroupItem>
                    <ButtonGroupItem value="classic" className="size-7 p-0">
                      <IconSymbolDiffstat className="size-3" />
                    </ButtonGroupItem>
                    <ButtonGroupItem value="none" className="size-7 p-0">
                      <IconEyeSlash className="size-3" />
                    </ButtonGroupItem>
                  </ButtonGroup>
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
