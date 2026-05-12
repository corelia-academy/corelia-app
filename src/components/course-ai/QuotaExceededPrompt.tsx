import { AlertTriangle, RotateCcw } from "lucide-react";
import { NavLink } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuotaExceededPrompt({
  title,
  description,
  ctaLabel,
  ctaTo,
  retryLabel,
  onRetry,
  className,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  retryLabel: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm",
        className,
      )}
    >
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-[11px] leading-snug text-foreground-muted">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-4" />
            {retryLabel}
          </Button>
        ) : null}
        <Button render={<NavLink to={ctaTo} />} nativeButton={false} size="sm">
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
