import { Calendar, Flag, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { ContestTimelineMilestone } from "@/types/contests";
import type { ContestTimelineRow } from "./ContestTimeline";

type TimelineItem = {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
};

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
