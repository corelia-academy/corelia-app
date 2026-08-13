import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SkillTag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full border border-border-subtle bg-surface-raised px-3 text-sm font-medium leading-none text-foreground-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
