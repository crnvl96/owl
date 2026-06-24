import { IconEye } from "@pierre/icons";

import { cn } from "@/lib/cn";

export function OwlLogo({ className }: { className?: string }) {
  return <IconEye className={cn("size-6 shrink-0", className)} aria-label="Owl" />;
}
