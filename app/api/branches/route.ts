import { type NextRequest } from "next/server";

import { resolveWorktreePath, runGit } from "@/lib/server/git";

const CACHE_CONTROL = "no-store";
const SOURCE_LABEL = "branches";
// Field separator (\x1f, ASCII "unit separator"). It's a control character
// guaranteed not to appear in any git ref name, so we can split safely.
const FIELD_SEPARATOR = "\u001f";

interface BranchInfo {
  isRemote: boolean;
  name: string;
}

interface BranchListSuccessResponse {
  branches: BranchInfo[];
}

interface BranchListErrorResponse {
  error: string;
}

export async function GET(_request: NextRequest) {
  const worktreePath = resolveWorktreePath();

  try {
    const currentBranchResult = await runGit(
      ["rev-parse", "--abbrev-ref", "HEAD"],
      worktreePath,
    );
    const currentBranch = currentBranchResult.stdout.trim();

    const branchFormat = `%(refname:short)${FIELD_SEPARATOR}%(refname)${FIELD_SEPARATOR}`;
    const result = await runGit(
      ["for-each-ref", "--format", branchFormat, "refs/heads", "refs/remotes"],
      worktreePath,
    );

    const localBranches: BranchInfo[] = [];
    const remoteBranches: BranchInfo[] = [];

    for (const line of result.stdout.split("\n")) {
      const record = line.trim();
      if (record.length === 0) {
        continue;
      }
      const [shortName, fullRef] = record.split(FIELD_SEPARATOR);
      if (shortName == null || fullRef == null) {
        continue;
      }
      if (
        shortName === "HEAD" ||
        shortName.endsWith("/HEAD") ||
        shortName === currentBranch
      ) {
        continue;
      }
      const isRemote = fullRef.startsWith("refs/remotes/");
      const branch = { isRemote, name: shortName };
      if (isRemote) {
        remoteBranches.push(branch);
      } else {
        localBranches.push(branch);
      }
    }

    localBranches.sort((a, b) => a.name.localeCompare(b.name));
    remoteBranches.sort((a, b) => a.name.localeCompare(b.name));

    const body: BranchListSuccessResponse = {
      branches: [...localBranches, ...remoteBranches],
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL,
        "X-Patch-Source": SOURCE_LABEL,
      },
    });
  } catch (error) {
    const body: BranchListErrorResponse = {
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL,
        "X-Patch-Source": SOURCE_LABEL,
      },
    });
  }
}
