import { spawn } from "node:child_process";
import { resolve as resolvePath } from "node:path";

const NON_WHITESPACE_PATTERN = /\S/u;

interface GitSpawnResult {
  stdout: string;
  stderr: string;
}

// Resolves the worktree the git commands should run against. Server-controlled
// only: callers cannot influence the path through the request. The env var
// is the explicit knob; falling back to the dev server's CWD keeps the
// feature usable out of the box when you `cd` into a worktree and run
// `pnpm dev` from there.
export function resolveWorktreePath(): string {
  return resolvePath(process.env.OWL_WORKTREE_PATH ?? process.cwd());
}

// Runs `git <args>` in the given cwd and resolves with captured output.
// Non-zero exit codes reject with the captured stderr, so routes can
// surface the raw git message to the client (per the agreed error policy).
export function runGit(args: string[], cwd: string): Promise<GitSpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd });
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
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr.trim() || `git exited with code ${code}`));
      }
    });
  });
}

// True when the buffer has at least one non-whitespace character. Used to
// detect "the diff is empty" responses so routes can return 422 the same
// way the local-worktree endpoint does.
export function hasNonWhitespaceContent(text: string): boolean {
  return NON_WHITESPACE_PATTERN.test(text);
}
