import { spawn } from "node:child_process";
import { join as joinPath } from "node:path";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import { hasNonWhitespaceContent, resolveWorktreePath, runGit } from "./lib/server/git";

const CACHE_CONTROL = "no-store";
const EMPTY_PATCH_MESSAGE = "No local changes in the current worktree.";
const SOURCE_LABEL = "local-worktree";
const DEV_NULL_PATH = "/dev/null";

interface GitNoIndexResult {
  stdout: string;
}

function runGitNoIndexDiff(a: string, b: string): Promise<GitNoIndexResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["diff", "--no-color", "--no-index", a, b]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0 || code === 1) {
        resolve({ stdout });
      } else {
        reject(new Error(stderr.trim() || `git diff exited with code ${code}`));
      }
    });
  });
}

const app = new Hono();

// --- API --------------------------------------------------------------------

app.get("/api/local-worktree-diff", async (c) => {
  const worktreePath = resolveWorktreePath();

  try {
    // 1. Tracked changes (staged + unstaged in a single command).
    const tracked = await runGit(["diff", "HEAD", "--no-color"], worktreePath);

    // 2. List of untracked files, respecting .gitignore.
    const untrackedList = await runGit(
      ["ls-files", "--others", "--exclude-standard"],
      worktreePath,
    );
    const untrackedFiles = untrackedList.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    // 3. For each untracked file, synthesize a diff against /dev/null so
    // the viewer sees it as a new file.
    const untrackedDiffs = (
      await Promise.all(
        untrackedFiles.map(async (relativePath) => {
          const absolutePath = joinPath(worktreePath, relativePath);
          const diff = await runGitNoIndexDiff(DEV_NULL_PATH, absolutePath);
          return hasNonWhitespaceContent(diff.stdout) ? diff.stdout : null;
        }),
      )
    ).filter((diff): diff is string => diff !== null);

    const fullDiff = [tracked.stdout, ...untrackedDiffs].join("");
    if (!hasNonWhitespaceContent(fullDiff)) {
      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("Cache-Control", CACHE_CONTROL);
      c.header("X-Patch-Source", SOURCE_LABEL);
      return c.body(EMPTY_PATCH_MESSAGE, 422);
    }

    c.header("Content-Type", "text/plain; charset=utf-8");
    c.header("Cache-Control", CACHE_CONTROL);
    c.header("X-Patch-Source", SOURCE_LABEL);
    return c.body(fullDiff, 200);
  } catch (error) {
    c.header("Content-Type", "text/plain; charset=utf-8");
    c.header("Cache-Control", CACHE_CONTROL);
    c.header("X-Patch-Source", SOURCE_LABEL);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.body(message, 500);
  }
});

// --- Static files (production) ----------------------------------------------

app.use("/assets/*", serveStatic({ root: "./dist" }));
app.use("/fonts/*", serveStatic({ root: "./public" }));
app.get("/*", serveStatic({ path: "./dist/index.html" }));

export default app;
