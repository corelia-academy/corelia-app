export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function scrollToElementById(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function formatContestCountdown(
  ms: number,
  translate: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (ms <= 0) return "";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  if (days >= 1) return translate("detail.hero.countdownDays", { count: days });
  const hours = Math.floor(sec / 3600);
  if (hours >= 1)
    return translate("detail.hero.countdownHours", { count: hours });
  const mins = Math.max(1, Math.floor(sec / 60));
  return translate("detail.hero.countdownMinutes", { count: mins });
}
