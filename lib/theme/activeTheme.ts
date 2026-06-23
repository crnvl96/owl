// The single theme used throughout the app. night-owl is dark-only, so the
// chrome, the file tree, and the diff code view all read from this one
// constant — no controller, no persistence, no source/provider abstraction.
export const ACTIVE_THEME_NAME = 'night-owl';
export const ACTIVE_THEME_SCHEME = 'dark' as const;
