"use client";

import { IconXSquircle } from "@pierre/icons";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  type RefObject,
  useEffect,
} from "react";

import { CHROME_ICON_BUTTON_CLASS } from "./chromeButtonStyles";
import { OwlFileTree } from "./OwlFileTree";
import { useChromeThemeProps } from "./useChromeThemeProps";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type { OwlFileTreeSource } from "@/lib/types";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

interface OwlSidebarProps {
  className?: string;
  mobileOverlayOpen?: boolean;
  onMobileClose(): void;
  onSelectItem(itemId: string): void;
  scrollRef: RefObject<HTMLDivElement | null>;
  source: OwlFileTreeSource;
}

export const OwlSidebar = memo(function OwlSidebar({
  className,
  mobileOverlayOpen = false,
  onMobileClose,
  onSelectItem,
  scrollRef,
  source,
}: OwlSidebarProps) {
  const { style: sidebarChromeStyle } = useChromeThemeProps(owlChromeMapping);
  const sidebarStyle =
    Object.keys(sidebarChromeStyle).length > 0 ? sidebarChromeStyle : undefined;

  useEffect(() => {
    if (!mobileOverlayOpen || !window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      return undefined;
    }

    const { body, documentElement } = document;
    const codeViewScroll = scrollRef.current;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousCodeViewOverflow = codeViewScroll?.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    if (codeViewScroll != null) {
      codeViewScroll.style.overflow = "hidden";
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overscrollBehavior = previousRootOverscrollBehavior;
      if (codeViewScroll != null) {
        codeViewScroll.style.overflow = previousCodeViewOverflow ?? "";
      }
    };
  }, [mobileOverlayOpen, scrollRef]);

  return (
    <>
      <button
        type="button"
        aria-hidden={!mobileOverlayOpen}
        aria-label="Close file tree"
        tabIndex={mobileOverlayOpen ? 0 : -1}
        className={cn(
          "z-20 cursor-default bg-background/60 backdrop-blur-xs transition-opacity [grid-column:1/-1] [grid-row:1/-1] md:hidden",
          mobileOverlayOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onMobileClose}
      />
      <SidebarWrapper
        className={className}
        mobileOverlayOpen={mobileOverlayOpen}
        themeStyle={sidebarStyle}
      >
        <div className="flex items-center gap-3 px-4 pt-5 pb-2 md:px-3 md:pt-0.5 md:pb-0">
          {onMobileClose != null && (
            <Button
              variant="ghost"
              size="icon-only"
              className={cn(CHROME_ICON_BUTTON_CLASS, "md:hidden")}
              aria-label="Close file tree"
              onClick={onMobileClose}
            >
              <IconXSquircle className="size-4 md:size-3" />
            </Button>
          )}
        </div>
        <div className="mt-3 min-h-0 flex-1">
          <div role="region" aria-label="Files" className="h-full min-h-0">
            <OwlFileTree source={source} onSelectItem={onSelectItem} />
          </div>
        </div>
      </SidebarWrapper>
    </>
  );
});

interface SidebarWrapperProps {
  children: ReactNode;
  className?: string;
  mobileOverlayOpen: boolean;
  themeStyle?: CSSProperties;
}

function SidebarWrapper({
  children,
  className,
  mobileOverlayOpen,
  themeStyle,
}: SidebarWrapperProps) {
  return (
    <div
      className={cn(
        className,
        "contain-strict z-30 flex h-full min-h-0 flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none md:z-auto md:translate-y-0 md:will-change-auto",
        themeStyle == null && "bg-[var(--owl-sidebar-bg)]",
        mobileOverlayOpen
          ? "pointer-events-auto translate-y-0 overflow-hidden rounded-t-xl shadow-[0_0_0_1px_var(--color-border-opaque),_0_16px_32px_rgb(0_0_0_/0.25)] md:h-full md:overflow-visible md:rounded-none md:border-0 md:shadow-none"
          : "pointer-events-none translate-y-[calc(100%+1.5rem)] overflow-hidden rounded-xl md:pointer-events-auto md:h-full md:overflow-visible md:rounded-none pt-3 border-r border-[var(--color-border-opaque)]",
      )}
      style={themeStyle}
    >
      {children}
    </div>
  );
}
