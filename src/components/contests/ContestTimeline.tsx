import { Calendar, Flag, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { ContestTimelineMilestone } from "@/types/contests";

type TimelineItem = {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
};

export type ContestTimelineRow = {
  key: string;
  title: string;
  datetimeLabel: string;
};

export function ContestTimeline({
  items,
}: {
  items: TimelineItem[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-2xl border border-border-subtle bg-background p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {item.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {item.value}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContestTimelineVertical({ rows }: { rows: ContestTimelineRow[] }) {
  return (
    <ul className="relative m-0 list-none space-y-0 border-l border-border-subtle pl-6">
      {rows.map((row) => (
        <li key={row.key} className="relative pb-8 last:pb-0">
          <span
            className="absolute -left-[21px] mt-1.5 size-2.5 rounded-full border-2 border-primary bg-background"
            aria-hidden
          />
          <div className="text-sm font-medium text-foreground">{row.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{row.datetimeLabel}</div>
        </li>
      ))}
    </ul>
  );
}

export function buildDefaultContestTimelineItems({
  registrationDeadline,
  startsAt,
  endsAt,
  formatDate,
  labels,
}: {
  registrationDeadline: string | null;
  startsAt: string | null;
  endsAt: string | null;
  formatDate: (value: string | null) => string;
  labels: { registrationDeadline: string; kickoff: string; end: string };
}): TimelineItem[] {
  return [
    {
      key: "registration_deadline",
      label: labels.registrationDeadline,
      value: formatDate(registrationDeadline),
      icon: <Calendar className="size-5" aria-hidden />,
    },
    {
      key: "kickoff",
      label: labels.kickoff,
      value: formatDate(startsAt),
      icon: <Flag className="size-5" aria-hidden />,
    },
    {
      key: "end",
      label: labels.end,
      value: formatDate(endsAt),
      icon: <Timer className="size-5" aria-hidden />,
    },
  ];
}

export function buildContestTimelineRows({
  milestones,
  registrationDeadline,
  startsAt,
  endsAt,
  formatDateTime,
  defaultLabels,
}: {
  milestones: ContestTimelineMilestone[];
  registrationDeadline: string | null;
  startsAt: string | null;
  endsAt: string | null;
  formatDateTime: (value: string | null) => string;
  defaultLabels: { registrationDeadline: string; kickoff: string; end: string };
}): ContestTimelineRow[] {
  if (milestones.length > 0) {
    return milestones.map((m, i) => ({
      key: `milestone-${i}-${m.at}`,
      title: m.title,
      datetimeLabel: formatDateTime(m.at),
    }));
  }
  return [
    {
      key: "registration_deadline",
      title: defaultLabels.registrationDeadline,
      datetimeLabel: formatDateTime(registrationDeadline),
    },
    {
      key: "kickoff",
      title: defaultLabels.kickoff,
      datetimeLabel: formatDateTime(startsAt),
    },
    {
      key: "end",
      title: defaultLabels.end,
      datetimeLabel: formatDateTime(endsAt),
    },
  ];
}
