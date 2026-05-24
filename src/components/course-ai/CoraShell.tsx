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
  const hasActions = !!(onNewSession || historySlot || onClearHistory || onRequestHide);

  const actionButtons = (
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
  );

  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base",
        className,
      )}
    >
      {hideHeader ? (
        hasActions ? (
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-border-subtle px-2">
            {actionButtons}
          </div>
        ) : null
      ) : (
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-3">
          <img
            src={CORA_AI_TUTOR_LOGO_SRC}
            alt={title}
            className="h-7 w-auto max-w-[180px] object-contain object-left"
            draggable={false}
          />
          {actionButtons}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>

      <div className="border-t border-border-subtle bg-surface-float px-4 py-3">
        {footer}
      </div>
    </div>
  );
}
