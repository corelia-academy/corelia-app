import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pulse } from "@phosphor-icons/react";

import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Timestamp } from "@/components/ui/timestamp";
import { getMyXpDayBreakdown, getMyXpHistory, getXpSummary, utcDate, xpIntensity } from "@/lib/xp";
import type { XpEntry } from "@/lib/xp";
import { intlLocaleFor } from "@/lib/locales";
import { cn } from "@/lib/utils";

const CELL_PITCH = 21; // ô 16px + khoảng cách 5px (Figma)
const VISIBLE_HISTORY = 4;

const intensityClass = [
  "bg-surface-raised border-border-subtle",
  "bg-primary/20 border-primary/20",
  "bg-primary/40 border-primary/30",
  "bg-primary/65 border-primary/40",
  "bg-primary border-primary",
];
const noDataClass = "bg-surface-raised border-border-subtle border-dashed opacity-45";
const sectionIcon = <Pulse aria-hidden weight="duotone" className="size-5 shrink-0 text-foreground-muted" />;

function startOfUtcWeek(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day;
}

function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

function calendarCells<T extends { date: string }>(items: T[]): Array<T | null> {
  if (!items.length) return [];
  const weekday = new Date(`${items[0].date}T00:00:00Z`).getUTCDay();
  return [...Array<T | null>((weekday + 6) % 7).fill(null), ...items];
}

export function XpActivity({ userId, own = false }: { userId: string; own?: boolean }) {
  const { t, i18n } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [weekShift, setWeekShift] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);
  const rangeStart = addDays(now, -364);
  const start = utcDate(rangeStart);
  const today = utcDate(now);
  const summary = useQuery({
    queryKey: ["xp", "summary", userId, start, today, own],
    queryFn: () => getXpSummary(userId, start, today),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const history = useQuery({
    queryKey: ["xp", "history", userId, historyPage],
    queryFn: () => getMyXpHistory(userId, historyPage * 20),
    enabled: own && Boolean(userId),
  });
  const breakdown = useQuery({
    queryKey: ["xp", "dayBreakdown", selectedDay],
    queryFn: () => getMyXpDayBreakdown(selectedDay!),
    enabled: own && Boolean(selectedDay),
  });
  const days = useMemo(() => {
    const byDate = new Map(summary.data?.days.map((item) => [item.date, item.xp]) ?? []);
    return Array.from({ length: 365 }, (_, index) => {
      const date = utcDate(addDays(rangeStart, index));
      const xp = byDate.get(date) ?? 0;
      return { date, xp, noData: date < (summary.data?.trackingSince ?? today) && !byDate.has(date) };
    });
  }, [summary.data?.days, summary.data?.trackingSince, rangeStart, today]);
  const currentWeek = startOfUtcWeek(now);
  const cells = calendarCells(days);
  const weekStart = addDays(currentWeek, weekShift * 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = utcDate(addDays(weekStart, index));
    return { date, xp: days.find((day) => day.date === date)?.xp ?? 0, future: date > today };
  });
  const weekTotal = weekDays.reduce((sum, day) => sum + (day.future ? 0 : day.xp), 0);
  const maxWeek = Math.max(1, ...weekDays.map((day) => day.xp));
  const locale = intlLocaleFor(i18n.language);
  const formatted = (value: number) => new Intl.NumberFormat(locale).format(value);
  const dayLabel = (day: { date: string; xp: number; noData?: boolean }) => `${day.date}: ${day.noData ? t("xp.noData") : `${formatted(day.xp)} XP`}`;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(addDays(new Date("2026-09-21T00:00:00Z"), index)));
  const monthMarkers = cells.flatMap((day, index) => {
    if (!day) return [];
    const previous = cells.slice(0, index).reverse().find(Boolean);
    if (previous?.date.slice(0, 7) === day.date.slice(0, 7)) return [];
    const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`));
    return [{ month, left: Math.floor(index / 7) * CELL_PITCH }];
  }).filter((marker, index, markers) => !markers[index + 1] || markers[index + 1].left - marker.left >= 48);
  const sourceLabels: Record<string, string> = {
    daily_streak_claim: t("xp.sources.daily_streak_claim"),
    ocid_connected: t("xp.sources.ocid_connected"),
    github_connected: t("xp.sources.github_connected"),
    ethereum_wallet: t("xp.sources.ethereum_wallet"),
    solana_wallet: t("xp.sources.solana_wallet"),
    lesson_completed: t("xp.sources.lesson_completed"),
    quiz_passed: t("xp.sources.quiz_passed"),
    course_completed: t("xp.sources.course_completed"),
    first_hackathon_submission: t("xp.sources.first_hackathon_submission"),
    project_liked: t("xp.sources.project_liked"),
    correction: t("xp.sources.correction"),
  };

  // Cuộn heatmap về phía ngày mới nhất (đồng bộ với DOM, không đổi dữ liệu)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [summary.data]);

  if (summary.isPending) return <p className="text-sm text-foreground-muted">{t("xp.loading")}</p>;
  if (summary.isError) {
    return (
      <div className="text-sm">
        <p>{t("xp.error")}</p>
        <Button type="button" variant="cta" hierarchy="tertiary" size="small" className="mt-2" onClick={() => void summary.refetch()}>{t("profile.retry")}</Button>
      </div>
    );
  }
  if (!summary.data) return null;

  const historyRows = history.data ? (historyExpanded ? history.data : history.data.slice(0, VISIBLE_HISTORY)) : [];

  return (
    <div className="flex flex-col gap-8">
      <section aria-label={t("xp.title")} className="flex flex-col gap-4">
        <SectionHeader icon={sectionIcon} title={t("xp.title")} />
        <div className="flex items-start gap-4">
          <div aria-hidden className="grid shrink-0 grid-rows-[repeat(7,16px)] gap-[5px] pt-6 text-title-medium text-foreground-muted">
            {weekdayLabels.map((label, index) => (
              <span key={index} className="h-4 w-6 leading-4">{index === 0 || index === 2 || index === 4 ? label : ""}</span>
            ))}
          </div>
          <div ref={scrollRef} className="scrollbar-design min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
            <div className="w-max">
              <div className="relative mb-1 h-5 text-title-medium text-foreground-muted">
                {monthMarkers.map((marker) => (
                  <span key={marker.left} className="absolute whitespace-nowrap" style={{ left: marker.left }}>{marker.month}</span>
                ))}
              </div>
              {/* Ô heatmap nhỏ hơn mức tối thiểu 44px của vỏ public nên đặt minHeight 0 */}
              <div className="grid grid-flow-col grid-rows-[repeat(7,16px)] gap-[5px]" role="group" aria-label={t("xp.calendar")}>
                {cells.map((day, index) =>
                  day ? (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDay(day.date)}
                      title={dayLabel(day)}
                      aria-label={dayLabel(day)}
                      style={{ minHeight: 0 }}
                      className={cn("size-4 rounded-[3px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", day.noData ? noDataClass : intensityClass[xpIntensity(day.xp)])}
                    />
                  ) : (
                    <span key={`pad-${index}`} className="size-4" aria-hidden />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col">
            <p className="text-xs font-medium leading-[1.4] text-foreground">{t("xp.total", { count: formatted(summary.data.total) })}</p>
            <p className="text-[10px] font-medium leading-[1.2] text-foreground-muted">{t("xp.utc")}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-foreground-muted" aria-hidden>
            {t("xp.less")}
            {intensityClass.map((color) => (
              <span key={color} className={cn("size-4 rounded-[3px] border", color)} />
            ))}
            {t("xp.more")}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <span className={cn("size-4 rounded-[3px] border", noDataClass)} aria-hidden />
            {t("xp.noData")}
          </p>
        </div>
        {selectedDay ? <p className="text-sm text-foreground" role="status">{dayLabel(days.find((day) => day.date === selectedDay) ?? { date: selectedDay, xp: 0 })}</p> : null}
        {own && selectedDay && breakdown.data?.length ? (
          <ul className="text-sm text-foreground-muted">
            {breakdown.data.map((item) => <li key={item.source}>{sourceLabels[item.source] ?? item.source}: {item.xp > 0 ? "+" : ""}{formatted(item.xp)} XP</li>)}
          </ul>
        ) : null}
        {summary.data.total === 0 ? <p className="text-sm text-foreground-muted">{t("xp.empty")}</p> : null}
      </section>

      {own ? (
        <section aria-label={t("xp.weekChart")} className="flex flex-col gap-4">
          <SectionHeader
            icon={sectionIcon}
            title={t("xp.weekTotal", { count: formatted(weekTotal) })}
            action={
              <div className="flex items-center gap-1">
                <Button type="button" variant="cta" hierarchy="tertiary" size="small" iconOnly aria-label={t("xp.previousWeek")} onClick={() => setWeekShift((v) => v - 1)}>
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
                <Button type="button" variant="cta" hierarchy="tertiary" size="small" iconOnly aria-label={t("xp.nextWeek")} disabled={weekShift >= 0} onClick={() => setWeekShift((v) => v + 1)}>
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            }
          />
          <p className="text-xs text-foreground-muted">{weekDays[0].date} – {weekDays[6].date}</p>
          <div className="grid h-36 grid-cols-7 items-end gap-2" role="group" aria-label={t("xp.weekChart")}>
            {weekDays.map((day) => (
              <button
                key={day.date}
                type="button"
                disabled={day.future}
                onClick={() => setSelectedDay(day.date)}
                title={`${day.date}: ${formatted(day.xp)} XP`}
                aria-label={`${day.date}: ${formatted(day.xp)} XP`}
                style={{ minHeight: 0 }}
                className="flex h-full flex-col items-center justify-end gap-1 disabled:opacity-30"
              >
                <span className="w-full rounded-t bg-primary" style={{ height: `${day.future ? 0 : Math.max(day.xp > 0 ? 6 : 0, day.xp / maxWeek * 108)}px` }} />
                <span className="text-xs text-foreground-muted">{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {own ? (
        <section aria-label={t("xp.history")} className="flex flex-col gap-4">
          <SectionHeader
            icon={sectionIcon}
            title={t("xp.history")}
            action={
              history.data && history.data.length > VISIBLE_HISTORY && !historyExpanded ? (
                <Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => setHistoryExpanded(true)}>
                  {tc("userProfile.xpHistory.viewAll")}
                </Button>
              ) : undefined
            }
          />
          {history.isPending ? (
            <p className="text-sm text-foreground-muted">{t("xp.loading")}</p>
          ) : history.isError ? (
            <Button type="button" variant="cta" hierarchy="tertiary" size="small" className="w-fit" onClick={() => void history.refetch()}>{t("profile.retry")}</Button>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {historyRows.map((entry: XpEntry) => {
                  const when = new Date(entry.occurred_at ?? entry.created_at);
                  return (
                    <li key={entry.id} className="flex items-start justify-between gap-4 rounded-lg border border-stroke-divider px-5 py-4 sm:gap-10">
                      <div className="flex min-w-0 flex-col gap-2">
                        <p className="text-sm font-medium text-foreground">{sourceLabels[entry.source] ?? entry.source.replaceAll("_", " ")}</p>
                        <Timestamp
                          size="medium"
                          date={when.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                          time={when.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                          timezone="UTC"
                        />
                      </div>
                      <p className="shrink-0 text-sm font-medium text-foreground">{entry.points > 0 ? "+" : ""}{entry.points} XP</p>
                    </li>
                  );
                })}
              </ul>
              {history.data.length === 0 ? <p className="text-sm text-foreground-muted">{t("xp.empty")}</p> : null}
              {historyExpanded ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => { setHistoryExpanded(false); setHistoryPage(0); }}>
                    {tc("userProfile.xpHistory.collapse")}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="cta" hierarchy="tertiary" size="small" disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>{t("xp.previous")}</Button>
                    <Button type="button" variant="cta" hierarchy="tertiary" size="small" disabled={history.data.length < 20} onClick={() => setHistoryPage((p) => p + 1)}>{t("xp.next")}</Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
