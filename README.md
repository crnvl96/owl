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

Next.js 16 · React 19 · TypeScript (`tsgo`) · Tailwind v4 · [`@pierre/diffs`](https://github.com/pierrecomputer/diffs) · [`@pierre/trees`](https://github.com/pierrecomputer/trees)

## Getting Started

**Prerequisites:** Node.js 20+, [pnpm](https://pnpm.io/).

```sh
pnpm install
export OWL_WORKTREE_PATH=/absolute/path/to/repo   # optional; defaults to cwd
pnpm dev
```

Open <http://localhost:3000>. The target directory must be a git working tree.

## Scripts

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Start the dev server              |
| `pnpm build`     | Production build                  |
| `pnpm start`     | Start the production server       |
| `pnpm typecheck` | Run `tsgo --noEmit`               |
| `pnpm lint`      | Run `oxlint`                      |
| `pnpm lint:fix`  | Auto-fix lint issues              |
| `pnpm fmt`       | Format all files                  |
| `pnpm fmt:check` | Check formatting                  |
| `pnpm check`     | Format check, lint, and typecheck |
| `pnpm fix`       | Format and auto-fix lint issues   |

Run `pnpm check` before committing.

## Notes

Git operations are server-side only (see `lib/server/git.ts`). For architecture, conventions, and component layout, see [`AGENTS.md`](./AGENTS.md).
