/** Public hackathon times use the event's Vietnam timezone on every device. */
export function formatVietnamDateTime(value: string, locale: string): string {
  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  }).format(date);
  return `${formattedDate} · ${formattedTime} ICT (UTC+7)`;
}
