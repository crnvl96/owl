import { spawn } from 'node:child_process';
import { join as joinPath } from 'node:path';

import { type NextRequest } from 'next/server';

import { hasNonWhitespaceContent, resolveWorktreePath, runGit } from '@/lib/server/git';

const CACHE_CONTROL = 'no-store';
const EMPTY_PATCH_MESSAGE = 'No local changes in the current worktree.';
const SOURCE_LABEL = 'local-worktree';
const DEV_NULL_PATH = '/dev/null';

interface GitNoIndexResult {
  stdout: string;
}

// Runs `git diff --no-index <a> <b>` to synthesize a diff for an untracked
// file. The command exits with code 1 when the two paths differ (the normal
// case) and 0 when they are identical; we accept both.
function runGitNoIndexDiff(a: string, b: string): Promise<GitNoIndexResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['diff', '--no-color', '--no-index', a, b]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0 || code === 1) {
        resolve({ stdout });
      } else {
        reject(
          new Error(stderr.trim() || `git diff exited with code ${code}`)
        );
      }
    });
  });
}

// Returns the local diff (staged + unstaged + untracked) of the resolved
// worktree. Accepts no user input — both the worktree path and the git
// subcommand are server-side. Streams a unified-diff body in the same shape
// as the existing /api/diff endpoint so the existing viewer pipeline can
// consume it without modification.
export async function GET(_request: NextRequest) {
  const worktreePath = resolveWorktreePath();

  try {
    // 1. Tracked changes (staged + unstaged in a single command).
    const tracked = await runGit(['diff', 'HEAD', '--no-color'], worktreePath);

    // 2. List of untracked files, respecting .gitignore.
    const untrackedList = await runGit(
      ['ls-files', '--others', '--exclude-standard'],
      worktreePath
    );
    const untrackedFiles = untrackedList.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    // 3. For each untracked file, synthesize a diff against /dev/null so
    // the viewer sees it as a new file.
    const untrackedDiffs: string[] = [];
    for (const relativePath of untrackedFiles) {
      const absolutePath = joinPath(worktreePath, relativePath);
      const diff = await runGitNoIndexDiff(DEV_NULL_PATH, absolutePath);
      if (hasNonWhitespaceContent(diff.stdout)) {
        untrackedDiffs.push(diff.stdout);
      }
    }

    const fullDiff = [tracked.stdout, ...untrackedDiffs].join('');
    if (!hasNonWhitespaceContent(fullDiff)) {
      return createTextResponse(EMPTY_PATCH_MESSAGE, { status: 422 });
    }

    return createTextResponse(fullDiff);
  } catch (error) {
    return createTextResponse(
      error instanceof Error ? error.message : 'Unknown error',
      { status: 500 }
    );
  }
}

function createTextResponse(
  body: string,
  { status = 200 }: { status?: number } = {}
): Response {
  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': CACHE_CONTROL,
    'X-Patch-Source': SOURCE_LABEL,
  });
  return new Response(body, { status, headers });
}
