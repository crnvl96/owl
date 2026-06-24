"use client";

import { IconBranch, IconCommit, IconCommitArrow } from "@pierre/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu";
import { cn } from "@/lib/cn";
import { getDropdownThemeStyle } from "@/lib/theme/dropdownChromeStyle";
import { useChromeThemeProps } from "./useChromeThemeProps";
import { owlChromeMapping } from "@/lib/theme/owlChromeMapping";
import type { DiffSource } from "@/lib/types";

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

type CommitListState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; commits: readonly CommitInfo[] }
  | { kind: "error"; message: string };

interface BranchInfo {
  isRemote: boolean;
  name: string;
}

interface BranchListSuccessResponse {
  branches: BranchInfo[];
}

type BranchListState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; branches: readonly BranchInfo[] }
  | { kind: "error"; message: string };

// Styling for the Worktree button and Past-commits dropdown trigger. Both
// controls share the same chrome (icon + label + rounded rectangle). The
// active state highlights via `aria-pressed`, which we style with
// `aria-pressed:bg-accent` so the visual feedback is consistent across the
// two controls.
const PICKER_CONTROL_CLASS =
  "h-8 gap-1.5 rounded-md px-2.5 text-sm font-medium aria-pressed:bg-[var(--owl-picker-active-bg,var(--color-muted))] aria-pressed:text-[var(--owl-picker-active-fg,var(--color-foreground))] hover:bg-[var(--owl-picker-hover-bg,transparent)] hover:text-[var(--owl-picker-hover-fg,var(--color-foreground))] focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-0";

const ICON_CLASS = "size-3.5";

interface OwlDiffModePickerProps {
  source: DiffSource;
  onSelectSource(source: DiffSource): void;
  className?: string;
}

// Switches the viewer between the local worktree diff, the diff introduced
// by one of the last 10 commits on the current branch, and a three-dot
// diff of the current branch against another local or remote branch. All
// controls are always visible; the active one is highlighted. Past-commit
// and branch-comparison diffs are sourced from git's object database so a
// dirty worktree does not gate them — the user can compare uncommitted
// changes with a past commit or another branch freely.
export function OwlDiffModePicker({
  source,
  onSelectSource,
  className,
}: OwlDiffModePickerProps) {
  // Mirror the resolved Shiki theme so the dropdown sits on the same
  // surface as the rest of the header chrome. Portaled menus render
  // outside the header wrapper, so we re-apply the chrome here.
  const { style: chromeStyle } = useChromeThemeProps(owlChromeMapping);
  const themeChromeStyle =
    Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined;
  const dropdownThemeStyle = useMemo(
    () => getDropdownThemeStyle(themeChromeStyle),
    [themeChromeStyle],
  );
  const isWorktreeActive = source.kind === "worktree";
  const isPastCommitActive = source.kind === "pastCommit";
  const isBranchCompareActive = source.kind === "branchCompare";
  // The selected commit's metadata is needed for the dropdown trigger label
  // and the "current selection" checkmark in the menu. We keep a small
  // per-source cache so switching back to a previously-loaded commit
  // doesn't force a refetch.
  const [commits, setCommits] = useState<readonly CommitInfo[]>([]);
  const [listState, setListState] = useState<CommitListState>({ kind: "idle" });
  const requestIdRef = useRef(0);
  const [branches, setBranches] = useState<readonly BranchInfo[]>([]);
  const [branchListState, setBranchListState] = useState<BranchListState>({
    kind: "idle",
  });
  const branchRequestIdRef = useRef(0);

  const selectedCommit = isPastCommitActive
    ? commits.find((commit) => commit.hash === source.hash)
    : undefined;
  const selectedBranch = isBranchCompareActive ? source.branch : undefined;

  const loadCommits = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setListState({ kind: "loading" });
    try {
      const response = await fetch("/api/local-worktree-commits", {
        cache: "no-store",
      });
      if (!response.ok) {
        const detail = await readErrorMessage(response);
        if (requestIdRef.current !== requestId) {
          return;
        }
        setListState({
          kind: "error",
          message: detail ?? `Request failed (${response.status}).`,
        });
        return;
      }
      const payload = (await response.json()) as CommitListSuccessResponse;
      if (requestIdRef.current !== requestId) {
        return;
      }
      setCommits(payload.commits);
      setListState({ kind: "ready", commits: payload.commits });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setListState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      requestIdRef.current++;
      branchRequestIdRef.current++;
    };
  }, []);

  // Lazily load the commit list on the first open of the dropdown. After
  // that, opening the dropdown again re-fetches so the user sees fresh
  // commits if the branch moved.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && listState.kind !== "loading") {
        void loadCommits();
      }
    },
    [listState.kind, loadCommits],
  );

  const handleSelectCommit = useCallback(
    (commit: CommitInfo) => {
      onSelectSource({ kind: "pastCommit", hash: commit.hash });
    },
    [onSelectSource],
  );

  const loadBranches = useCallback(async () => {
    const requestId = ++branchRequestIdRef.current;
    setBranchListState({ kind: "loading" });
    try {
      const response = await fetch("/api/branches", {
        cache: "no-store",
      });
      if (!response.ok) {
        const detail = await readErrorMessage(response);
        if (branchRequestIdRef.current !== requestId) {
          return;
        }
        setBranchListState({
          kind: "error",
          message: detail ?? `Request failed (${response.status}).`,
        });
        return;
      }
      const payload = (await response.json()) as BranchListSuccessResponse;
      if (branchRequestIdRef.current !== requestId) {
        return;
      }
      setBranches(payload.branches);
      setBranchListState({ kind: "ready", branches: payload.branches });
    } catch (error) {
      if (branchRequestIdRef.current !== requestId) {
        return;
      }
      setBranchListState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, []);

  const handleSelectBranch = useCallback(
    (branch: BranchInfo) => {
      onSelectSource({ kind: "branchCompare", branch: branch.name });
    },
    [onSelectSource],
  );

  const handleBranchDropdownOpenChange = useCallback(
    (open: boolean) => {
      if (open && branchListState.kind !== "loading") {
        void loadBranches();
      }
    },
    [branchListState.kind, loadBranches],
  );

  const handleSelectWorktree = useCallback(() => {
    onSelectSource({ kind: "worktree" });
  }, [onSelectSource]);

  return (
    <div
      role="group"
      aria-label="Diff source"
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        type="button"
        variant="ghost"
        aria-pressed={isWorktreeActive}
        title="Show uncommitted changes in the worktree"
        className={cn(PICKER_CONTROL_CLASS, "text-muted-foreground")}
        onClick={handleSelectWorktree}
      >
        <IconBranch className={ICON_CLASS} aria-hidden="true" />
        <span>Worktree</span>
      </Button>
      <DropdownMenu onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-pressed={isPastCommitActive}
            aria-label={
              selectedCommit == null
                ? "Past commits"
                : `Past commits — ${selectedCommit.shortHash} ${selectedCommit.subject}`
            }
            title={
              selectedCommit == null
                ? "Show diff for a past commit"
                : `${selectedCommit.shortHash} ${selectedCommit.subject}`
            }
            className={cn(PICKER_CONTROL_CLASS, "text-muted-foreground max-w-[280px]")}
          >
            <IconCommit className={ICON_CLASS} aria-hidden="true" />
            <span className="truncate">
              {selectedCommit == null ? "Past commits" : selectedCommit.shortHash}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(420px,calc(100vw-2rem))] p-1.5"
          style={dropdownThemeStyle}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
            Last 10 commits
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 my-1" />
          {renderCommitList(listState, commits, source, handleSelectCommit)}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu onOpenChange={handleBranchDropdownOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-pressed={isBranchCompareActive}
            aria-label={
              selectedBranch == null
                ? "Branch compare"
                : `Branch compare — ${selectedBranch}`
            }
            title={
              selectedBranch == null ? "Compare against another branch" : selectedBranch
            }
            className={cn(PICKER_CONTROL_CLASS, "text-muted-foreground max-w-[280px]")}
          >
            <IconCommitArrow className={ICON_CLASS} aria-hidden="true" />
            <span className="truncate">{selectedBranch ?? "Compare"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(420px,calc(100vw-2rem))] p-1.5"
          style={dropdownThemeStyle}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
            Branches
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 my-1" />
          {renderBranchList(branchListState, branches, source, handleSelectBranch)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function renderCommitList(
  state: CommitListState,
  commits: readonly CommitInfo[],
  source: DiffSource,
  onSelectCommit: (commit: CommitInfo) => void,
) {
  if (state.kind === "loading") {
    return (
      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
        Loading commits…
      </DropdownMenuItem>
    );
  }
  if (state.kind === "error") {
    return (
      <DropdownMenuItem disabled className="text-destructive text-xs">
        {state.message}
      </DropdownMenuItem>
    );
  }
  if (state.kind === "ready" && commits.length === 0) {
    return (
      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
        No commits found.
      </DropdownMenuItem>
    );
  }
  // `state.kind === 'ready'` (with commits) OR `'idle'` (we already kicked
  // off a load on open, so `idle` should not normally be visible here, but
  // we fall through to the commit list using the cached commits for safety).
  const list = state.kind === "ready" ? state.commits : commits;
  return (
    <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
      {list.map((commit) => {
        const isSelected = source.kind === "pastCommit" && source.hash === commit.hash;
        return (
          <DropdownMenuItem
            key={commit.hash}
            selected={isSelected}
            onSelect={() => onSelectCommit(commit)}
            className="items-start gap-2 py-1.5"
          >
            <code className="text-muted-foreground shrink-0 rounded bg-[var(--owl-picker-hash-bg,var(--color-muted))] px-1.5 py-0.5 font-mono text-[11px] leading-none">
              {commit.shortHash}
            </code>
            <span className="min-w-0 flex-1 break-words">{commit.subject}</span>
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

function renderBranchList(
  state: BranchListState,
  branches: readonly BranchInfo[],
  source: DiffSource,
  onSelectBranch: (branch: BranchInfo) => void,
) {
  if (state.kind === "loading") {
    return (
      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
        Loading branches…
      </DropdownMenuItem>
    );
  }
  if (state.kind === "error") {
    return (
      <DropdownMenuItem disabled className="text-destructive text-xs">
        {state.message}
      </DropdownMenuItem>
    );
  }
  if (state.kind === "ready" && branches.length === 0) {
    return (
      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
        No branches found.
      </DropdownMenuItem>
    );
  }
  const list = state.kind === "ready" ? state.branches : branches;
  return (
    <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
      {list.map((branch) => {
        const isSelected =
          source.kind === "branchCompare" && source.branch === branch.name;
        return (
          <DropdownMenuItem
            key={branch.name}
            selected={isSelected}
            onSelect={() => onSelectBranch(branch)}
            className="items-start gap-2 py-1.5"
          >
            <span className="min-w-0 flex-1 break-words">{branch.name}</span>
            {branch.isRemote && (
              <span className="text-muted-foreground text-[11px] shrink-0">remote</span>
            )}
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

async function readErrorMessage(response: Response): Promise<string | null> {
  // The endpoint returns `{ error: string }` on failure; tolerate plain text
  // bodies too (e.g. HTML error pages from intermediaries).
  const contentType = response.headers.get("Content-Type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as CommitListErrorResponse;
      return payload.error;
    }
    const text = await response.text();
    return text.trim().length > 0 ? text.trim() : null;
  } catch {
    return null;
  }
}
