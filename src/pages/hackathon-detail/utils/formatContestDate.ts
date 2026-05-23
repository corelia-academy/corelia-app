import { intlLocale } from "@/lib/intl";

/**
 * Contest-facing dates without seconds — consistent across hero metadata and timelines.
 * - `long`  → "Mon, Apr 20, 2026 · 09:00" (en) / "Th 2, 20 thg 4, 2026 · 09:00" (vi)
 * - `short` → "20/04 · 09:00"
 *
 * Uses a single `·` separator between the date and time so labels read cleanly in both
 * locales (avoiding the locale-default ", " / " lúc " junction).
 */
export function formatContestDate(
  value: string | null | undefined,
  style: "long" | "short",
  notUpdatedLabel: string,
): string {
  if (!value?.trim()) return notUpdatedLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return notUpdatedLabel;
  const locale = intlLocale();

  const timeStr = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  if (style === "short") {
    const dateStr = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
    }).format(d);
    return `${dateStr} · ${timeStr}`;
  }

  const dateStr = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  return `${dateStr} · ${timeStr}`;
}
