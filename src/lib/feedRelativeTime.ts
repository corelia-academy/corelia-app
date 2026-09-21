export function feedRelativeTime(createdAt: string, now: number, language: string, justNow: string): string {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 1000));
  if (!Number.isFinite(elapsed)) return "";
  if (elapsed < 60) return justNow;

  const relative = new Intl.RelativeTimeFormat(language, { numeric: "always" });
  if (elapsed < 3_600) return relative.format(-Math.floor(elapsed / 60), "minute");
  if (elapsed < 86_400) return relative.format(-Math.floor(elapsed / 3_600), "hour");
  if (elapsed < 2_592_000) return relative.format(-Math.floor(elapsed / 86_400), "day");
  if (elapsed < 31_536_000) return relative.format(-Math.floor(elapsed / 2_592_000), "month");
  return relative.format(-Math.floor(elapsed / 31_536_000), "year");
}
