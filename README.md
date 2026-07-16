# Owl

A visual diff viewer for local git worktrees and past commits.

Owl renders unified and split diffs with syntax highlighting, a file tree sidebar, and inline comment annotations. It runs entirely against your local repository — there is no PR/URL input.

## Features

- Worktree and past-commit diffs
- Unified and split view modes
- File tree sidebar with git status
- Inline draft and saved comment annotations
- Streaming patch loading via web workers

## Stack

React 19 · Vite 7 · Hono 4 · Bun · TypeScript (`tsgo`) · Tailwind v4 · [`@pierre/diffs`](https://github.com/pierrecomputer/diffs) · [`@pierre/trees`](https://github.com/pierrecomputer/trees)

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) 1.3+.

```sh
bun install
export OWL_WORKTREE_PATH=/absolute/path/to/repo   # optional; defaults to cwd
bun dev
```

Open <http://localhost:5173> (Vite dev server). The target directory must be a git working tree.

The Hono API server runs on port 3000. In dev the Vite dev server proxies `/api` requests there automatically.

## Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `bun dev`       | Start Vite + Hono dev servers     |
| `bun run build` | Production build (`vite build`)   |
| `bun start`     | Start the production server       |
| `bun typecheck` | Run `tsgo --noEmit`               |
| `bun lint`      | Run `oxlint`                      |
| `bun lint:fix`  | Auto-fix lint issues              |
| `bun fmt`       | Format all files                  |
| `bun fmt:check` | Check formatting                  |
| `bun check`     | Format check, lint, and typecheck |
| `bun fix`       | Format and auto-fix lint issues   |

Run `bun check` before committing.

## Notes

Git operations are server-side only (see `lib/server/git.ts`). For architecture, conventions, and component layout, see [`AGENTS.md`](./AGENTS.md).
