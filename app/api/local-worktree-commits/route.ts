import { type NextRequest } from 'next/server';

import { resolveWorktreePath, runGit } from '@/lib/server/git';

const CACHE_CONTROL = 'no-store';
const COMMIT_COUNT = 10;
const SOURCE_LABEL = 'local-worktree-commits';
// Field separator (\x1f, ASCII "unit separator") and record separator
// (\x1e, ASCII "record separator"). Both are control characters that are
// guaranteed not to appear in any git field value, so we can split on them
// safely without worrying about multi-line subjects or quoted strings.
//
// We deliberately avoid \x00 here: Node's `child_process.spawn` rejects null
// bytes in argv (since they'd terminate C strings underneath), which means a
// `--format=...` value containing \x00 would be killed at spawn time rather
// than producing a parseable git log.
const FIELD_SEPARATOR = '\u001f';
const RECORD_SEPARATOR = '\u001e';
// %H full hash, %h short hash, %s subject, %an author, %ar relative date.
const COMMIT_FORMAT = `%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ar${RECORD_SEPARATOR}`;

interface CommitInfo {
  author: string;
  hash: string;
  relativeDate: string;
  shortHash: string;
  subject: string;
}

interface CommitListSuccessResponse {
  commits: CommitInfo[];
}

interface CommitListErrorResponse {
  error: string;
}

export async function GET(_request: NextRequest) {
  const worktreePath = resolveWorktreePath();
  try {
    const result = await runGit(
      ['log', `-${COMMIT_COUNT}`, '--no-color', `--format=${COMMIT_FORMAT}`],
      worktreePath
    );

    const commits: CommitInfo[] = [];
    for (const rawRecord of result.stdout.split(RECORD_SEPARATOR)) {
      const record = rawRecord.trim();
      if (record.length === 0) {
        continue;
      }
      const [hash, shortHash, subject, author, relativeDate] =
        record.split(FIELD_SEPARATOR);
      if (hash == null || shortHash == null || subject == null) {
        continue;
      }
      commits.push({
        author: author ?? '',
        hash,
        relativeDate: relativeDate ?? '',
        shortHash,
        subject,
      });
    }

    const body: CommitListSuccessResponse = { commits };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': CACHE_CONTROL,
        'X-Patch-Source': SOURCE_LABEL,
      },
    });
  } catch (error) {
    const body: CommitListErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': CACHE_CONTROL,
        'X-Patch-Source': SOURCE_LABEL,
      },
    });
  }
}
