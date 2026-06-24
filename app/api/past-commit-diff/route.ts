import { type NextRequest } from "next/server";

import { hasNonWhitespaceContent, resolveWorktreePath, runGit } from "@/lib/server/git";

const CACHE_CONTROL = "no-store";
const SOURCE_LABEL = "past-commit";
// Defensive: accept 7-char short hashes (the default in `git log`) up to full
// 40-char SHAs. We never interpolate untrusted input into the spawned argv
// (spawn is invoked with an array), so this is belt-and-suspenders validation
// that also gives us a clean 400 response for malformed inputs.
const HASH_PATTERN = /^[a-f0-9]{7,40}$/u;

interface PastCommitDiffQuery {
  hash: string;
}

function parseQuery(request: NextRequest): PastCommitDiffQuery | null {
  const hash = request.nextUrl.searchParams.get("hash");
  if (hash == null || !HASH_PATTERN.test(hash)) {
    return null;
  }
  return { hash };
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (query == null) {
    return createTextResponse("Invalid commit hash", { status: 400 });
  }

  const worktreePath = resolveWorktreePath();
  try {
    const result = await runGit(
      ["show", "--no-color", "--format=fuller", query.hash],
      worktreePath,
    );
    if (!hasNonWhitespaceContent(result.stdout)) {
      return createTextResponse("Commit produced no diff.", { status: 422 });
    }
    return createTextResponse(result.stdout);
  } catch (error) {
    // `git show <unknown-hash>` exits non-zero with "bad revision" — surface
    // that as 404 so the client can distinguish "no such commit" from a
    // generic git/server failure.
    const message = error instanceof Error ? error.message : "Unknown error";
    if (/bad revision|unknown revision/iu.test(message)) {
      return createTextResponse(message, { status: 404 });
    }
    return createTextResponse(message, { status: 500 });
  }
}

function createTextResponse(
  body: string,
  { status = 200 }: { status?: number } = {},
): Response {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": CACHE_CONTROL,
    "X-Patch-Source": SOURCE_LABEL,
  });
  return new Response(body, { status, headers });
}
