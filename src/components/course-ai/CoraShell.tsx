import type { ReactNode } from "react";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CORA_AI_TUTOR_LOGO_SRC } from "@/components/course-ai/constants";
import { cn } from "@/lib/utils";

export function CoraShell({
  title,
  body,
  footer,
  hideHeader = false,
  onRequestHide,
  hideLabel,
  onClearHistory,
  clearHistoryLabel,
  onNewSession,
  newSessionLabel,
  historySlot,
  className,
}: {
  title: string;
  body: ReactNode;
  footer: ReactNode;
  hideHeader?: boolean;
  onRequestHide?: () => void;
  hideLabel?: string;
  onClearHistory?: () => void;
  clearHistoryLabel?: string;
  onNewSession?: () => void;
  newSessionLabel?: string;
  historySlot?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base",
        className,
      )}
    >
      {hideHeader ? null : (
        <div className="border-b border-border-subtle p-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <img
                src={CORA_AI_TUTOR_LOGO_SRC}
                alt={title}
                className="h-8 w-auto max-w-[220px] object-contain object-left"
                draggable={false}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onNewSession ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-foreground-muted hover:text-foreground"
                  onClick={onNewSession}
                  aria-label={newSessionLabel}
                  title={newSessionLabel}
                >
                  <PlusIcon className="size-4" aria-hidden />
                </Button>
              ) : null}
              {historySlot}
              {onClearHistory ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-foreground-muted hover:text-foreground"
                  onClick={onClearHistory}
                  aria-label={clearHistoryLabel}
                  title={clearHistoryLabel}
                >
                  <Trash2Icon className="size-4" aria-hidden />
                </Button>
              ) : null}
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
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>

      <div className="border-t border-border-subtle bg-surface-float px-4 py-3">
        {footer}
      </div>
    </div>
  );
}
