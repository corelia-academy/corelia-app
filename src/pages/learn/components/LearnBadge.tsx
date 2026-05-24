import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type LearnBadgeVariant =
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "primaryContainer";

export function LearnBadge({
  children,
  className,
  variant = "secondary",
}: {
  children: ReactNode;
  className?: string;
  variant?: LearnBadgeVariant;
}) {
  const base =
    "inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium";
  const variants: Record<LearnBadgeVariant, string> = {
    secondary: "bg-surface-raised text-foreground-muted",
    outline: "bg-transparent text-foreground-muted border border-border",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    primaryContainer: "bg-primary-muted text-primary",
  };

  return (
    <span className={cn(base, variants[variant], className)}>{children}</span>
  );
}
