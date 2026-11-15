import type { UserNotificationRow } from "@/lib/notifications";

export type NotificationDayGroup = { key: string; label: string | null; items: UserNotificationRow[] };

const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

export function groupNotificationsByDay(items: UserNotificationRow[], now: number, language: string, labels: { today: string; yesterday: string }): NotificationDayGroup[] {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const dateFormat = new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" });
  const groups: NotificationDayGroup[] = [];
  for (const item of items) {
    const ms = Date.parse(item.activity_at);
    const key = dayKey(ms);
    const last = groups[groups.length - 1];
    if (last?.key === key) { last.items.push(item); continue; }
    groups.push({ key, label: key === today ? labels.today : key === yesterday ? labels.yesterday : dateFormat.format(ms), items: [item] });
  }
  return groups;
}
