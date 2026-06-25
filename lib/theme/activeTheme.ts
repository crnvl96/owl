// The single theme used throughout the app. pierre-dark-soft is dark-only, so
// the chrome, the file tree, and the diff code view all read from this one
// constant — no controller, no persistence, no source/provider abstraction.
export const ACTIVE_THEME_NAME = "pierre-dark-soft";
export const ACTIVE_THEME_SCHEME = "dark" as const;
