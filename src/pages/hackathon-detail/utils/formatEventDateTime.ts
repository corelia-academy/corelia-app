import { resolvedTimeZone, timeZoneOffsetLabel } from "@/lib/timezone";

function formatCompactDate(date: Date, locale: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone,
  });

  if (!locale.toLowerCase().startsWith("en")) return formatter.format(date);

  const parts = formatter.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!month || !Number.isFinite(day)) return formatter.format(date);

  const suffix = day % 100 >= 11 && day % 100 <= 13
    ? "th"
    : day % 10 === 1
      ? "st"
      : day % 10 === 2
        ? "nd"
        : day % 10 === 3
          ? "rd"
          : "th";

  return `${month} ${day}${suffix}`;
}

/** Hackathon times in the user's display timezone (Settings → Timezone). */
export function formatEventDateTime(
  value: string,
  locale: string,
  options: { includeTimezone?: boolean; compact?: boolean } = {},
): string {
  const date = new Date(value);
  const timeZone = resolvedTimeZone();
  const formattedDate = options.compact
    ? formatCompactDate(date, locale, timeZone)
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone,
      }).format(date);
  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(date);
  const dateTime = options.compact
    ? `${formattedTime}, ${formattedDate}`
    : `${formattedDate} · ${formattedTime}`;
  return options.includeTimezone === false
    ? dateTime
    : `${dateTime} ${timeZoneOffsetLabel(timeZone)}`;
}
