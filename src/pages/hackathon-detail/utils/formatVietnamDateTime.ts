const HACKATHON_TIME_ZONE = "Asia/Ho_Chi_Minh";

function formatCompactDate(date: Date, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: HACKATHON_TIME_ZONE,
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

/** Public hackathon times use the event's Vietnam timezone on every device. */
export function formatVietnamDateTime(
  value: string,
  locale: string,
  options: { includeTimezone?: boolean; compact?: boolean } = {},
): string {
  const date = new Date(value);
  const formattedDate = options.compact
    ? formatCompactDate(date, locale)
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: HACKATHON_TIME_ZONE,
      }).format(date);
  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: HACKATHON_TIME_ZONE,
    hour12: false,
  }).format(date);
  const dateTime = options.compact
    ? `${formattedTime}, ${formattedDate}`
    : `${formattedDate} · ${formattedTime}`;
  return options.includeTimezone === false
    ? dateTime
    : `${dateTime} ICT (UTC+7)`;
}
