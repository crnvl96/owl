import { IconCiWarningFill, IconRefresh } from "@pierre/icons";

import { Button } from "@/components/atoms/Button";
import { useChromeThemeProps } from "@/hooks/useChromeThemeProps";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type { ViewerLoadState } from "@/lib/types";
import styles from "./StatusPanel.module.css";

interface StatusPanelProps {
  errorMessage: string | null;
  onRetry(): void;
  state: ViewerLoadState;
}

export function StatusPanel({ errorMessage, onRetry, state }: StatusPanelProps) {
  const { style: chromeStyle } = useChromeThemeProps(owlChromeMapping);
  const themeChromeStyle = Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined;

  const isError = state === "error";
  const title = isError
    ? "Couldn't load diff"
    : state === "parsing"
      ? "Preparing diff"
      : state === "fetching"
        ? "Fetching diff"
        : "Streaming diff";
  const message = isError
    ? (errorMessage ?? "Failed to fetch the diff, please try again.")
    : state === "parsing"
      ? "Parsing the patch and building the file tree…"
      : state === "fetching"
        ? "Fetching the patch from GitHub…"
        : "Reading the patch and showing files as they arrive…";

  const containerClass = [
    styles.container,
    themeChromeStyle == null ? styles.containerDefaultBg : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass} style={themeChromeStyle}>
      <section
        role={isError ? "alert" : "status"}
        aria-live="polite"
        aria-busy={isError ? undefined : true}
        className={styles.section}
      >
        {isError ? (
          <IconCiWarningFill className={styles.icon} />
        ) : (
          <IconRefresh aria-hidden="true" className={styles.spinner} />
        )}
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {isError && (
          <Button type="button" className={styles.retryButton} onClick={onRetry}>
            Try again
          </Button>
        )}
      </section>
    </div>
  );
}
