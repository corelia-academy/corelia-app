import type { ReactNode } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CORA_AI_TUTOR_LOGO_SRC } from "@/components/course-ai/constants";
import { cn } from "@/lib/utils";

export function CoraShell({
  eyebrow,
  title,
  status,
  tagline,
  meta,
  body,
  footer,
  onRequestHide,
  hideLabel,
  className,
}: {
  eyebrow: string;
  title: string;
  status: string;
  tagline?: string;
  meta?: ReactNode;
  body: ReactNode;
  footer: ReactNode;
  onRequestHide?: () => void;
  hideLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base",
        className,
      )}
    >
      <div className="border-b border-border-subtle px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
              {eyebrow}
            </p>
            <img
              src={CORA_AI_TUTOR_LOGO_SRC}
              alt={title}
              className="mt-2 h-10 w-auto max-w-[220px] object-contain object-left"
              draggable={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-foreground-muted">
              {status}
            </div>
            {onRequestHide ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-foreground-muted hover:text-foreground"
                onClick={onRequestHide}
                aria-label={hideLabel}
                title={hideLabel}
              >
                <XIcon className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
        {tagline ? (
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            {tagline}
          </p>
        ) : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>

      <div className="border-t border-border-subtle bg-surface-float px-4 py-3">
        {footer}
      </div>
    </div>
  );
}
