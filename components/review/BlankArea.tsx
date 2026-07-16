// The "diff content area" we render when there is no diff to show — for
// example, the clean-worktree state where the worktree has no local
// changes. Occupies the same [grid-area:viewer] slot as <Viewer>
// and sits on the same --owl-sidebar-bg surface as the rest of the
// chrome so the empty state harmonizes with the rest of the UI.
export function BlankArea() {
  return (
    <div
      aria-hidden="true"
      className="bg-[var(--owl-sidebar-bg)] [grid-area:viewer] min-h-0 min-w-0 flex-1"
    />
  );
}
