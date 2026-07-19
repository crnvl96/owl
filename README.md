# Owl

> **⚠️ Beta Software** — Owl is in early development and not yet ready for production use. APIs, configuration, and UI are subject to change without notice.

A visual diff viewer for local Git worktrees. Owl renders unified diffs with syntax highlighting, a file tree sidebar, and line-link selection. It runs entirely against your local repository — no pull requests, no URLs, just your working copy.

---

## Table of Contents

- [Features](#features)
- [Stack](#stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Dev Server](#running-the-dev-server)
- [Configuration](#configuration)
- [API](#api)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Worktree diff** — View all local changes (staged, unstaged, and untracked files) in one unified patch.
- **Syntax highlighting** — Code is highlighted using the `@pierre/diffs` engine with streaming web worker support.
- **File tree sidebar** — Browse changed files by path with Git status indicators (added, modified, deleted, untracked).
- **Line-link selection** — Select and link to specific lines in the diff for sharing and navigation.
- **Dark theme** — Built-in dark theme with Geist font.
- **Fully local** — No network calls to external Git forges. All operations target your local repository.

---

## Stack

| Layer            | Technology                                                   |
| ---------------- | ------------------------------------------------------------ |
| Frontend         | [React 19](https://react.dev), CSS Modules                   |
| Build            | [Vite 7](https://vitejs.dev)                                 |
| Server           | [Hono 4](https://hono.dev) on [Bun](https://bun.sh)          |
| Language         | [TypeScript](https://www.typescriptlang.org) (`tsgo` / `typescript`) |
| Diff rendering   | [`@pierre/diffs`](https://github.com/pierrecomputer/diffs)   |
| File tree        | [`@pierre/trees`](https://github.com/pierrecomputer/trees)   |
| Theming          | [`@pierre/theme`](https://github.com/pierrecomputer/theme), [`@pierre/theming`](https://github.com/pierrecomputer/theming) |
| Icons            | [`@pierre/icons`](https://github.com/pierrecomputer/icons)   |
| Notifications    | [`sonner`](https://sonner.emilkowal.ski)                     |
| Linting          | [`oxlint`](https://oxc.rs)                                   |
| Formatting       | [`oxfmt`](https://oxc.rs)                                    |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.3 or later
- [Git](https://git-scm.com) 2.30 or later
- A local Git repository (worktree) to inspect

### Installation

```sh
git clone git@github.com:crnvl96/owl.git && cd owl
bun install
```

### Running the Dev Server

```sh
export OWL_WORKTREE_PATH=/absolute/path/to/your/git/repo   # optional; defaults to current directory
bun dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the app.

- **Vite dev server** runs on port `5173` and serves the React frontend with HMR.
- **Hono API server** runs on port `3000`. In development, Vite proxies `/api` requests to it automatically.

The target directory must be a valid Git working tree.

---

## Configuration

| Environment Variable   | Required | Default             | Description                                         |
| ---------------------- | -------- | ------------------- | --------------------------------------------------- |
| `OWL_WORKTREE_PATH`    | No       | `$PWD` (server CWD) | Absolute path to the Git worktree to inspect.        |

All configuration is server-side via environment variables. There is no `.env` file or runtime config UI at this stage.

---

## API

The Hono server exposes a single API endpoint:

| Method | Path                       | Description                                    |
| ------ | -------------------------- | ---------------------------------------------- |
| `GET`  | `/api/local-worktree-diff` | Returns the full diff of the current worktree. |

**Response**

- **200** — Raw unified diff text (`text/plain`).
- **422** — No local changes (body: `"No local changes in the current worktree."`).
- **500** — Git command failed (body contains the error message).

The response includes the headers:

- `X-Patch-Source: local-worktree`
- `Cache-Control: no-store`

---

## Scripts

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `bun dev`          | Start Vite + Hono dev servers concurrently           |
| `bun run build`    | Production build (`vite build`)                     |
| `bun start`        | Start the production Hono server                     |
| `bun typecheck`    | Run TypeScript type checking (`tsgo --noEmit`)      |
| `bun lint`         | Run `oxlint` on all source files                    |
| `bun lint:fix`     | Auto-fix lint issues                                |
| `bun fmt`          | Format all files with `oxfmt`                       |
| `bun fmt:check`    | Check formatting compliance                         |
| `bun check`        | Format check + lint + typecheck (CI gate)           |
| `bun fix`          | Format and auto-fix lint issues in place            |

Run `bun check` before committing. It ensures formatting, linting, and type checking all pass.

---

## Project Structure

```
owl/
├── public/                  # Static assets (fonts, etc.)
├── src/
│   ├── frontend/            # React client
│   │   ├── components/
│   │   │   ├── atoms/       # Primitives (Button, Toaster)
│   │   │   ├── diff/        # Diff rendering components
│   │   │   ├── layout/      # Layout, worker pool, preloading
│   │   │   └── review/      # Review UI (file tree, sidebar, viewer)
│   │   ├── hooks/           # React hooks (theme, worker pool, patch loader)
│   │   ├── lib/             # Client-side utilities (config, caching, streaming, types, theme)
│   │   ├── pages/           # Page components (Home)
│   │   ├── globals.css      # Global styles
│   │   └── main.tsx         # Entry point
│   └── server/              # Hono API server
│       ├── git.ts           # Git command runner and worktree resolution
│       └── index.ts         # Server entry point (API routes + static serving)
├── types/                   # Ambient type declarations
├── index.html               # HTML shell
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── components.json          # shadcn/ui configuration (for reference)
├── package.json             # Dependencies and scripts
└── bun.lock                 # Bun lockfile
```

---

## Architecture

- **Frontend** is a single-page React application bootstrapped in `src/frontend/main.tsx`. It communicates exclusively with the Hono API server at `/api`.
- **Server** is a thin Hono app that spawns `git` child processes to generate diffs. All Git operations are server-side only and scoped to the worktree configured via `OWL_WORKTREE_PATH`.
- **Diff rendering** uses `@pierre/diffs` for parsing and rendering unified diffs (the only view mode currently supported), with syntax highlighting offloaded to web workers for responsiveness on large patches.
- **File tree** is powered by `@pierre/trees`, which builds a hierarchical file listing from the diff output and annotates each entry with its Git change type.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes.
4. Run `bun check` to ensure formatting, linting, and types are clean.
5. Commit and push your branch.
6. Open a pull request.

Please keep changes focused and avoid large, unrelated refactors in feature PRs.

---

## License

This project has not yet adopted a license. All rights are reserved by the author(s) until one is chosen.
