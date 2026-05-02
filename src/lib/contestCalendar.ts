import type { Contest } from "@/types/contests";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC folding stamp for iCalendar (DATE-TIME). */
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string): string[] {
  const max = 73;
  if (line.length <= max) return [line];
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, max - 1)}`);
    rest = rest.slice(max - 1);
  }
  return parts;
}

export type ContestCalendarEventInput = {
  uidSuffix: string;
  summary: string;
  startIso: string;
  /** Duration in ms; default 1 hour */
  durationMs?: number;
};

function buildVevent(input: ContestCalendarEventInput): string[] {
  const start = toIcsUtc(input.startIso);
  if (!start) return [];
  const duration = input.durationMs ?? 60 * 60 * 1000;
  const endDate = new Date(new Date(input.startIso).getTime() + duration);
  const end = toIcsUtc(endDate.toISOString());
  if (!end) return [];
  const uid = `corelia-contest-${input.uidSuffix}@corelia`;
  const stamp = toIcsUtc(new Date().toISOString());
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    "END:VEVENT",
  ];
  return lines.flatMap((l) => foldLine(l));
}

/** Build .ics content for contest milestones and fallback schedule dates. */
export function buildContestCalendarIcs(contest: Contest): string {
  const events: ContestCalendarEventInput[] = [];
  const base = contest.id;

  const milestones = contest.timeline_milestones ?? [];
  if (milestones.length > 0) {
    milestones.forEach((m, i) => {
      events.push({
        uidSuffix: `${base}-m-${i}`,
        summary: `${contest.title}: ${m.title}`,
        startIso: m.at,
      });
    });
  } else {
    if (contest.registration_deadline) {
      events.push({
        uidSuffix: `${base}-reg`,
        summary: `${contest.title}: Registration deadline`,
        startIso: contest.registration_deadline,
      });
    }
    if (contest.starts_at) {
      events.push({
        uidSuffix: `${base}-start`,
        summary: `${contest.title}: Kickoff`,
        startIso: contest.starts_at,
      });
    }
    if (contest.ends_at) {
      events.push({
        uidSuffix: `${base}-end`,
        summary: `${contest.title}: End`,
        startIso: contest.ends_at,
      });
    }
  }

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Corelia//Contest//EN",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((e) => buildVevent(e)),
    "END:VCALENDAR",
  ];

  return `${body.join("\r\n")}\r\n`;
}

export function downloadContestCalendarIcs(contest: Contest): void {
  const blob = new Blob([buildContestCalendarIcs(contest)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${contest.title.replace(/[^\w\-]+/g, "-").slice(0, 80) || "contest"}-schedule.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
