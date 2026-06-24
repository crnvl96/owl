import { type NextRequest } from "next/server";

import { hasNonWhitespaceContent, resolveWorktreePath, runGit } from "@/lib/server/git";

const CACHE_CONTROL = "no-store";
const SOURCE_LABEL = "branch-comparison";
const BRANCH_PATTERN = /^[\w./-]+$/u;

interface BranchComparisonDiffQuery {
  branch: string;
}

function parseQuery(request: NextRequest): BranchComparisonDiffQuery | null {
  const branch = request.nextUrl.searchParams.get("branch");
  if (branch == null || !BRANCH_PATTERN.test(branch)) {
    return null;
  }
  return { branch };
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (query == null) {
    return createTextResponse("Invalid branch name", { status: 400 });
  }

  const worktreePath = resolveWorktreePath();
  try {
    const result = await runGit(
      ["diff", "--no-color", `${query.branch}...HEAD`],
      worktreePath,
    );
    if (!hasNonWhitespaceContent(result.stdout)) {
      return createTextResponse("No differences between branches.", { status: 422 });
    }
    return createTextResponse(result.stdout);
  } catch (error) {
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
