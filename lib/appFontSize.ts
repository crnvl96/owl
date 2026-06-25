// Bounds for the user-adjustable global font size. The header control steps
// through these in 4px increments; the helpers below clamp and snap to the
// nearest step so the value can only ever land on 8/12/16/20/24/28/32. The
// default is the only value written on first paint, so a reload always
// resolves to a known good state.
//
// Only the chrome and other rem-based UI text scale with the body font-size;
// icons, button hit-targets, and the shiki-tokenized code view keep their
// intrinsic sizes so code stays readable at the extremes.
export const APP_FONT_SIZE_MIN = 8;
export const APP_FONT_SIZE_MAX = 32;
export const APP_FONT_SIZE_STEP = 4;
export const APP_FONT_SIZE_DEFAULT = 16;

export type AppFontSizeStep =
  | typeof APP_FONT_SIZE_MIN
  | 12
  | typeof APP_FONT_SIZE_DEFAULT
  | 20
  | 24
  | 28
  | typeof APP_FONT_SIZE_MAX;

// CSS variable read by `body { font-size: var(--owl-app-font-size, 16px) }`
// in app/globals.css. Set on <html> from the ReviewUI orchestrator so the
// first paint already has the right size.
export const APP_FONT_SIZE_CSS_VARIABLE = "--owl-app-font-size";

export function clampAppFontSize(value: number): number {
  if (value <= APP_FONT_SIZE_MIN) {
    return APP_FONT_SIZE_MIN;
  }
  if (value >= APP_FONT_SIZE_MAX) {
    return APP_FONT_SIZE_MAX;
  }
  // Snap to the nearest step so the value can only ever land on the discrete
  // set the UI offers.
  const stepsFromMin = Math.round((value - APP_FONT_SIZE_MIN) / APP_FONT_SIZE_STEP);
  return APP_FONT_SIZE_MIN + stepsFromMin * APP_FONT_SIZE_STEP;
}

export function nextAppFontSize(current: number, direction: 1 | -1): number {
  return clampAppFontSize(current + direction * APP_FONT_SIZE_STEP);
}

export function isAtAppFontSizeMin(value: number): boolean {
  return value <= APP_FONT_SIZE_MIN;
}

export function isAtAppFontSizeMax(value: number): boolean {
  return value >= APP_FONT_SIZE_MAX;
}
