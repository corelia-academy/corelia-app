import { XpRankProgress } from "./XpRankProgress";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { getMyXpDayBreakdown, getMyXpHistory, getXpSummary, utcDate, xpIntensity } from "@/lib/xp";
import type { XpEntry } from "@/lib/xp";

const intensityClass = [
  "bg-surface-raised border-border-subtle",
  "bg-primary/20 border-primary/20",
  "bg-primary/40 border-primary/30",
  "bg-primary/65 border-primary/40",
  "bg-primary border-primary",
];
const noDataClass = "bg-surface-raised border-border-subtle border-dashed opacity-45";

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [weekShift, setWeekShift] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
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
  const desktopCells = calendarCells(days);
  const mobileCells = calendarCells(days.slice(-91));
  const weekStart = addDays(currentWeek, weekShift * 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = utcDate(addDays(weekStart, index));
    return { date, xp: days.find((day) => day.date === date)?.xp ?? 0, future: date > today };
  });
  const weekTotal = weekDays.reduce((sum, day) => sum + (day.future ? 0 : day.xp), 0);
  const maxWeek = Math.max(1, ...weekDays.map((day) => day.xp));
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const formatted = (value: number) => new Intl.NumberFormat(locale).format(value);
  const dayLabel = (day: { date: string; xp: number; noData?: boolean }) => `${day.date}: ${day.noData ? t("xp.noData") : `${formatted(day.xp)} XP`}`;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(addDays(new Date("2026-09-21T00:00:00Z"), index)));
  const monthMarkers = (cells: Array<{ date: string } | null>, cellWidth: number) => cells.flatMap((day, index) => {
    if (!day) return [];
    const previous = cells.slice(0, index).reverse().find(Boolean);
    if (previous?.date.slice(0, 7) === day.date.slice(0, 7)) return [];
    const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`));
    return [{ month, left: Math.floor(index / 7) * cellWidth }];
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

  if (summary.isPending) return <div className="rounded-2xl border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted">{t("xp.loading")}</div>;
  if (summary.isError) return <div className="rounded-2xl border border-border-subtle bg-surface-base p-4 text-sm"><p>{t("xp.error")}</p><button type="button" onClick={() => void summary.refetch()} className="mt-2 text-primary underline">{t("profile.retry")}</button></div>;
  if (!summary.data) return null;

  return <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card" aria-label={t("xp.title")}>
    <div>
      <div className="flex items-center gap-2 text-foreground"><Sparkles className="size-5 text-primary" aria-hidden /><h2 className="font-display text-heading-medium">{t("xp.title")}</h2></div>
      <p className="mt-1 text-sm text-foreground-muted">{t("xp.total", { count: formatted(summary.data.total) })} · {t("xp.utc")}</p>
    </div>

    <XpRankProgress total={summary.data.total} />

    <div>
      <h3 className="mb-2 text-sm font-semibold">{t("xp.calendar")}</h3>
      {/* Compact heatmap cells override the public shell’s 44px minimum button height. */}
      <div className="hidden overflow-x-auto overflow-y-hidden md:block">
        <div className="ml-5 relative h-5 text-[10px] text-foreground-muted">{monthMarkers(desktopCells, 13).map((marker) => <span key={marker.left} className="absolute whitespace-nowrap" style={{ left: marker.left }}>{marker.month}</span>)}</div>
        <div className="flex items-start gap-2">
          <div className="grid grid-rows-[repeat(7,10px)] gap-[3px] text-[10px] text-foreground-muted">{weekdayLabels.map((label, index) => <span key={index} className="h-[10px] leading-[10px]">{index % 2 === 0 ? label : ""}</span>)}</div>
          <div className="grid w-max shrink-0 grid-flow-col grid-rows-[repeat(7,10px)] gap-[3px]" role="group" aria-label={t("xp.calendar")}>
            {desktopCells.map((day, index) => day ? <button key={day.date} type="button" onClick={() => setSelectedDay(day.date)} title={dayLabel(day)} aria-label={dayLabel(day)} style={{ minHeight: 0 }} className={`size-[10px] rounded-[2px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${day.noData ? noDataClass : intensityClass[xpIntensity(day.xp)]}`} /> : <span key={`pad-${index}`} className="size-[10px]" aria-hidden />)}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-hidden md:hidden">
        <div className="ml-5 relative h-5 text-[10px] text-foreground-muted">{monthMarkers(mobileCells, 18).map((marker) => <span key={marker.left} className="absolute whitespace-nowrap" style={{ left: marker.left }}>{marker.month}</span>)}</div>
        <div className="flex items-start gap-2">
          <div className="grid grid-rows-7 gap-1 text-[10px] text-foreground-muted">{weekdayLabels.map((label, index) => <span key={index} className="h-3.5 leading-[14px]">{index % 2 === 0 ? label : ""}</span>)}</div>
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="group" aria-label={t("xp.calendar")}>
            {mobileCells.map((day, index) => day ? <button key={day.date} type="button" onClick={() => setSelectedDay(day.date)} title={dayLabel(day)} aria-label={dayLabel(day)} style={{ minHeight: 0 }} className={`size-3.5 rounded-[2px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${day.noData ? noDataClass : intensityClass[xpIntensity(day.xp)]}`} /> : <span key={`pad-${index}`} className="size-3.5" aria-hidden />)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-foreground-muted" aria-hidden>{t("xp.less")}{intensityClass.map((color) => <span key={color} className={`size-3 rounded-[3px] border ${color}`} />)}{t("xp.more")}</div>
      <p className="mt-1 flex items-center gap-1 text-xs text-foreground-muted"><span className={`size-3 rounded-[3px] border ${noDataClass}`} aria-hidden />{t("xp.noData")}</p>
      {selectedDay ? <p className="mt-2 text-sm" role="status">{dayLabel(days.find((day) => day.date === selectedDay) ?? { date: selectedDay, xp: 0 })}</p> : null}
      {own && selectedDay && breakdown.data?.length ? <ul className="mt-1 text-sm text-foreground-muted">{breakdown.data.map((item) => <li key={item.source}>{sourceLabels[item.source] ?? item.source}: {item.xp > 0 ? "+" : ""}{formatted(item.xp)} XP</li>)}</ul> : null}
      {summary.data.total === 0 ? <p className="mt-2 text-sm text-foreground-muted">{t("xp.empty")}</p> : null}
    </div>

    {own ? <>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("xp.weekTotal", { count: formatted(weekTotal) })}</h3>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t("xp.previousWeek")} onClick={() => setWeekShift((v) => v - 1)} className="rounded-lg p-2 hover:bg-surface-raised"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label={t("xp.nextWeek")} disabled={weekShift >= 0} onClick={() => setWeekShift((v) => v + 1)} className="rounded-lg p-2 hover:bg-surface-raised disabled:opacity-40"><ChevronRight className="size-4" /></button>
          </div>
        </div>
        <p className="mb-2 text-xs text-foreground-muted">{weekDays[0].date} – {weekDays[6].date}</p>
        <div className="grid h-36 grid-cols-7 items-end gap-2" role="group" aria-label={t("xp.weekChart")}>
          {weekDays.map((day) => <button key={day.date} type="button" disabled={day.future} onClick={() => setSelectedDay(day.date)} title={`${day.date}: ${formatted(day.xp)} XP`} aria-label={`${day.date}: ${formatted(day.xp)} XP`} className="flex h-full flex-col items-center justify-end gap-1 disabled:opacity-30"><span className="w-full rounded-t bg-primary" style={{ height: `${day.future ? 0 : Math.max(day.xp > 0 ? 6 : 0, day.xp / maxWeek * 108)}px` }} /><span className="text-xs text-foreground-muted">{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}</span></button>)}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">{t("xp.history")}</h3>
        {history.isPending ? <p className="text-sm text-foreground-muted">{t("xp.loading")}</p> : history.isError ? <button type="button" onClick={() => void history.refetch()} className="text-sm text-primary underline">{t("profile.retry")}</button> : <>
          <ul className="divide-y divide-border-subtle">{history.data.map((entry: XpEntry) => <li key={entry.id} className="flex justify-between gap-3 py-2 text-sm"><span>{sourceLabels[entry.source] ?? entry.source.replaceAll("_", " ")}<span className="ml-2 text-xs text-foreground-muted">{new Date(entry.occurred_at ?? entry.created_at).toLocaleDateString(locale)}</span></span><span>{entry.points > 0 ? "+" : ""}{entry.points} XP</span></li>)}</ul>
          {history.data.length === 0 ? <p className="text-sm text-foreground-muted">{t("xp.empty")}</p> : null}
          <div className="mt-2 flex justify-end gap-2 text-sm"><button type="button" disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)} className="text-primary disabled:opacity-40">{t("xp.previous")}</button><button type="button" disabled={history.data.length < 20} onClick={() => setHistoryPage((p) => p + 1)} className="text-primary disabled:opacity-40">{t("xp.next")}</button></div>
        </>}
      </div>
    </> : null}
  </section>;
}
