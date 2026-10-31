import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type CourseBadgeVariant =
  | "secondary"
  | "outline"
  | "success"
  | "warning";

export function CourseBadge({
  className,
  variant = "secondary",
  ...props
}: ComponentProps<"span"> & {
  variant?: CourseBadgeVariant;
}) {
  const base =
    "inline-flex items-center rounded px-2 py-1 text-xs font-medium";
  const variants: Record<CourseBadgeVariant, string> = {
    secondary: "bg-surface-raised text-foreground-muted",
    outline: "bg-transparent text-foreground-muted border border-border",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
  };

  return <span className={cn(base, variants[variant], className)} {...props} />;
}
