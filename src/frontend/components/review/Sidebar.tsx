import { IconXSquircle } from "@pierre/icons";
import { memo, type ReactNode, type RefObject, useEffect } from "react";

import { FileTree } from "@/components/review/FileTree";
import { useChromeThemeProps } from "@/hooks/useChromeThemeProps";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type { OwlFileTreeSource } from "@/lib/types";
import styles from "./Sidebar.module.css";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

interface SidebarProps {
  mobileOverlayOpen?: boolean;
  onMobileClose(): void;
  onSelectItem(itemId: string): void;
  scrollRef: RefObject<HTMLDivElement | null>;
  source: OwlFileTreeSource;
}

export const Sidebar = memo(function Sidebar({
  mobileOverlayOpen = false,
  onMobileClose,
  onSelectItem,
  scrollRef,
  source,
}: SidebarProps) {
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
    if (codeViewScroll != null) codeViewScroll.style.overflow = "hidden";

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
        className={`${styles.backdrop} ${mobileOverlayOpen ? styles.backdropOpen : styles.backdropClosed}`}
        onClick={onMobileClose}
      />
      <SidebarWrapper mobileOverlayOpen={mobileOverlayOpen} themeStyle={sidebarStyle}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close file tree"
            onClick={onMobileClose}
          >
            <IconXSquircle style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>
        <div className={styles.content}>
          <div role="region" aria-label="Files" className={styles.filesRegion}>
            <FileTree source={source} onSelectItem={onSelectItem} />
          </div>
        </div>
      </SidebarWrapper>
    </>
  );
});

interface SidebarWrapperProps {
  children: ReactNode;
  mobileOverlayOpen: boolean;
  themeStyle?: React.CSSProperties;
}

function SidebarWrapper({ children, mobileOverlayOpen, themeStyle }: SidebarWrapperProps) {
  const stateClass = mobileOverlayOpen ? styles.wrapperOpen : styles.wrapperClosed;
  const bgClass = themeStyle == null ? styles.wrapperDefaultBg : "";
  return (
    <div
      className={`${styles.wrapper} ${stateClass} ${bgClass}`}
      style={themeStyle}
    >
      {children}
    </div>
  );
}
