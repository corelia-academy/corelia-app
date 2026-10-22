import { instantFromWallClock, resolvedTimeZone, wallClockInTimeZone } from "@/lib/timezone";

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** ISO instant → `datetime-local` input value in the user's display timezone. */
export function isoToDatetimeLocal(iso: string | null | undefined, timeZone = resolvedTimeZone()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const w = wallClockInTimeZone(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** `datetime-local` input value in the user's display timezone → ISO instant. */
export function datetimeLocalToIso(local: string, timeZone = resolvedTimeZone()): string | null {
  if (!local.trim()) return null;
  const match = DATETIME_LOCAL.exec(local.trim());
  if (!match) {
    const t = new Date(local).getTime();
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  const [, year, month, day, hour, minute, second = "0"] = match;
  const instant = instantFromWallClock(
    { year: +year, month: +month, day: +day, hour: +hour, minute: +minute, second: +second },
    timeZone,
  );
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}
