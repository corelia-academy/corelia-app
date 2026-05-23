import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Standard wrapper for stacked sections on the public hackathon detail page. Provides
 * consistent header (optional eyebrow → H2 → optional description) + body rhythm so the
 * page reads as a coherent rail of sections instead of competing card styles.
 */
export function HackathonSectionCard({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  /** Optional trailing element next to the section heading (e.g. action button). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card id={id} className={cn(id && "scroll-mt-36", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {eyebrow ? (
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {eyebrow}
              </div>
            ) : null}
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
