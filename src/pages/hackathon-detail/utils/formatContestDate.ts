import { intlLocale } from "@/lib/intl";

/** Contest-facing dates without seconds — consistent across hero metadata and timelines. */
export function formatContestDate(
  value: string | null | undefined,
  style: "long" | "short",
  notUpdatedLabel: string,
): string {
  if (!value?.trim()) return notUpdatedLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return notUpdatedLabel;
  const locale = intlLocale();

  if (style === "short") {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
