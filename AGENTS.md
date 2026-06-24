# AGENTS.md

## Project Overview

Owl is a Next.js (App Router) web application that provides a visual diff
viewer for local git worktrees and past commits. It renders unified/split diffs
with syntax highlighting, a file tree sidebar, inline comment annotations, and
streaming patch loading via web workers. The home page is the diff viewer
itself — there is no external PR/URL input.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Language:** TypeScript, type-checked with `tsgo` (TypeScript 7 native preview)
- **Styling:** Tailwind CSS v4, `tw-animate-css`, `clsx` + `tailwind-merge`
- **Diff rendering:** `@pierre/diffs` (viewer, worker, react bindings)
- **File tree:** `@pierre/trees`
- **Theming:** `@pierre/theming` (Shiki/VS Code theme resolution)
- **Syntax highlighting:** Web workers via `shiki-wasm`
- **Linter:** `oxlint` | **Formatter:** `oxfmt`

## Project Structure

```
app/
  api/                    API routes (all server-side git operations)
    local-worktree-diff/      GET — uncommitted diff (staged + unstaged + untracked)
    local-worktree-commits/   GET — last 10 commits as JSON
    past-commit-diff/         GET — diff for a specific commit hash
  globals.css             Tailwind v4 theme tokens + custom CSS variables
  layout.tsx              Metadata, viewport config, exports RootLayout
  page.tsx                Home page — renders <ReviewUI/>
components/               React components (PascalCase = components, camelCase = hooks/utils)
lib/                      Utilities, types, theme system, server-side git
  server/git.ts           Server-only git helpers (never imported client-side)
  theme/                  Theme resolution, chrome token derivation, CSS var mapping
  types.ts                Domain model
types/                    Ambient type declarations (.d.ts)
```

## Build / Run / Code Quality

```sh
pnpm dev          # Next.js dev server
pnpm build        # Next.js production build
pnpm start        # Next.js production server
pnpm typecheck    # tsgo --noEmit
pnpm fmt          # oxfmt — format all files in place
pnpm fmt:check    # oxfmt --check — verify formatting without modifying
pnpm lint         # oxlint — report lint errors/warnings
pnpm lint:fix     # oxlint --fix — auto-fix lint issues
pnpm check        # oxfmt --check && oxlint && tsgo --noEmit — combined check
pnpm fix          # oxfmt && oxlint --fix — format + auto-fix in one step
```

**Before committing, run `pnpm check` to verify everything passes.**
Use `pnpm fix` to auto-format and auto-fix lint issues, then review the changes.

## Architecture

### Component Hierarchy

```
RootLayout (HTML shell, fonts, WorkerPoolContext provider)
  └─ ReviewUI (main orchestrator — state, data loading, event handling)
      └─ ReviewGrid (CSS grid: header + sidebar + viewer)
          ├─ OwlHeader (toolbar: diff source picker, style toggle, collapse)
          ├─ OwlSidebar (file tree + comments list)
          │   ├─ OwlFileTree (wraps @pierre/trees FileTree)
          │   └─ OwlCommentsList
          └─ OwlViewer (wraps @pierre/diffs ThemedCodeView)
              ├─ DraftAnnotation (inline draft comment editor)
              └─ ExampleAnnotation (inline saved comment display)
```

### Data Flow (Patch Loading)

1. `ReviewUI` holds `DiffSource` state: `{ kind: 'worktree' }` or `{ kind: 'pastCommit', hash }`
2. `usePatchLoader` hook (in `components/`) maps the source to an API URL, fetches it
3. For streaming responses: `streamGitPatchFiles()` parses individual file diffs from the stream; `owlDataAccumulator` appends them incrementally
4. For non-streaming responses: full body is parsed in one pass via `buildOwlData()`
5. `OwlViewer` receives `initialItems` and renders via `ThemedCodeView`
6. URL hash tracks selected line ranges for deep linking

### State Management

- No global state library — all local React state in `ReviewUI`
- `usePatchLoader` returns: `initialItems`, `treeSource`, `diffStats`, `commentSections`, `loadState`, `errorMessage`
- Stale request detection via incrementing `requestIdRef`
- `AbortController` cancels in-flight requests on source change
- Viewer re-mounts per load via incrementing `viewerKey`

### Theming System

- Single hardcoded theme: **night-owl** (dark only) — no switching, no persistence
- Flow: `useActiveTheme()` → `deriveChromeTokens()` → `owlChromeMapping()` → CSS variables on wrapper element
- `@pierre/diffs` and `@pierre/trees` consume their own CSS variables, set by the chrome mapping
- App-specific CSS variables are prefixed `--owl-`
- Dropdown menus (portaled) re-apply chrome variables via `getDropdownThemeStyle()`

### Web Worker Pool

- Provider: `WorkerPoolContext` using `@pierre/diffs/react`'s `WorkerPoolContextProvider`
- Pool size: `min(max(1, hardwareConcurrency - 1), 3)` on desktop, 1 on mobile
- Languages: cpp, css, go, python, rust, sh, swift, tsx, typescript, zig
- `useWorkerDiffTheme` syncs theme to workers; viewer waits for pool readiness before rendering

## Conventions

- **Path alias:** `@/` maps to project root (e.g., `@/lib/types`, `@/components/ReviewUI`)
- **Type imports:** Use `import type { ... }` syntax
- **Client components:** All interactive components use `'use client'` directive
- **Callbacks:** Use `useStableCallback` from `@pierre/diffs/react` instead of `useCallback`
- **CSS classes:** Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- **Naming:** PascalCase files for components, camelCase for utilities/hooks; app-specific components prefixed `Owl`
- **API routes:** kebab-case directory names; return specific HTTP status codes (400/404/422/500)
- **Git operations:** Always server-side via `runGit()` in `lib/server/git.ts`; worktree path from `OWL_WORKTREE_PATH` env var or `process.cwd()`
- **React strict mode:** Disabled in `next.config.mjs` to avoid double fetches in dev
- **React Compiler:** Enabled (`reactCompiler: true` in `next.config.mjs`)
- **Fonts:** Geist Sans (Google) + Berkeley Mono (local woff2)

## Key Types (`lib/types.ts`)

- `DiffSource` — `{ kind: 'worktree' } | { kind: 'pastCommit'; hash: string }`
- `ViewerLoadState` — `'fetching' | 'streaming' | 'parsing' | 'ready' | 'error'`
- `CommentMetadata` — `SavedCommentMetadata | DraftCommentMetadata`
- `OwlFileTreeSource` — pre-computed tree input with git status, paths, item IDs
- `OwlDiffStats` — added/deleted lines, file count, total lines of code

## Gotchas

- `lib/server/git.ts` is server-only — never import it from client components
- The worktree path is server-controlled; there is no client-side git access
- `next.config.mjs` has `reactStrictMode: false` intentionally (prevents double fetches)
- Streaming patch parsing relies on `diff --git` boundary detection in `streamGitPatchFiles.ts`
- Commit log parsing uses `\x1f`/`\x1e` control character separators to avoid escaping issues
- `@typescript/native-preview` (tsgo) is used for type checking; the `typescript` package is also kept for Next.js's built-in build-time type checking
