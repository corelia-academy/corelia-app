import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HistoryIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CoraSessionSummary } from "@/hooks/useCoraAI";

type Props = {
  /** Async loader for the session list. Called each time the popover opens. */
  loadSessions: () => Promise<CoraSessionSummary[]>;
  /** Switch the active session. */
  onSelect: (sessionId: string) => void;
  /** Highlight the active session. */
  activeSessionId?: string | null;
  /**
   * Current lesson id (only on Learn page) — items from a different lesson get
   * a "from another lesson" badge.
   */
  currentLessonId?: string | null;
};

function formatRelative(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMin < 1) return rtf.format(0, "minute");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return rtf.format(-diffMonth, "month");
  return rtf.format(-Math.round(diffMonth / 12), "year");
}

export function CoraHistoryPopover({
  loadSessions,
  onSelect,
  activeSessionId,
  currentLessonId,
}: Props) {
  const { t, i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<CoraSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await loadSessions();
      setSessions(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [loadSessions]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const historyLabel = String(t("coraWidget.historyAction"));
  const fromOtherLesson = String(t("coraWidget.fromOtherLessonLabel"));
  const untitledLabel = String(t("coraWidget.untitledSessionLabel"));
  const emptyLabel = String(t("coraWidget.historyEmpty"));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-foreground-muted hover:text-foreground"
            aria-label={historyLabel}
            title={historyLabel}
          >
            <HistoryIcon className="size-4" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent
        className="w-[280px] max-h-[360px] overflow-auto p-0"
        align="end"
      >
        <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold text-foreground">
          {historyLabel}
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-foreground-muted">
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            {t("coraWidget.historyLoading")}
          </div>
        ) : errorMsg ? (
          <div className="px-3 py-4 text-xs text-destructive">{errorMsg}</div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-4 text-xs text-foreground-muted">{emptyLabel}</div>
        ) : (
          <ul className="py-1">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isOtherLesson =
                Boolean(currentLessonId) &&
                Boolean(session.lessonId) &&
                session.lessonId !== currentLessonId;
              const title = session.title?.trim() || untitledLabel;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(session.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-xs transition-colors",
                      "hover:bg-surface-raised focus:bg-surface-raised focus:outline-none",
                      isActive && "bg-surface-raised",
                    )}
                  >
                    <div className="truncate font-medium text-foreground">
                      {title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-foreground-muted">
                      <span>{formatRelative(session.lastMessageAt, i18n.language || "en")}</span>
                      <span className="text-foreground-subtle">·</span>
                      <span>{session.messageCount} msg</span>
                      {isOtherLesson ? (
                        <>
                          <span className="text-foreground-subtle">·</span>
                          <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-foreground-muted">
                            {fromOtherLesson}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
