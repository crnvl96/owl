// The home page IS the local worktree diff viewer. The app no longer accepts
// external PR/URL input — opening it just shows the current worktree's diff.
import { ReviewUI } from '@/components/ReviewUI';

export default function HomePage() {
  return (
    <div className="flex h-dvh flex-col gap-2">
      <ReviewUI />
    </div>
  );
}
