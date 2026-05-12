import { Calendar, Flag, Timer, Upload } from "lucide-react";
import type { ReactNode } from "react";
import type { ContestTimelineMilestone } from "@/types/hackathons";
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
  submissionDeadline,
  endsAt,
  formatDate,
  labels,
}: {
  registrationDeadline: string | null;
  startsAt: string | null;
  submissionDeadline: string | null;
  endsAt: string | null;
  formatDate: (value: string | null) => string;
  labels: {
    registrationDeadline: string;
    kickoff: string;
    submissionDeadline: string;
    end: string;
  };
}): TimelineItem[] {
  const items: TimelineItem[] = [
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
  ];
  if (submissionDeadline?.trim()) {
    items.push({
      key: "submission_deadline",
      label: labels.submissionDeadline,
      value: formatDate(submissionDeadline),
      icon: <Upload className="size-5" aria-hidden />,
    });
  }
  items.push({
    key: "end",
    label: labels.end,
    value: formatDate(endsAt),
    icon: <Timer className="size-5" aria-hidden />,
  });
  return items;
}

export function buildContestTimelineRows({
  milestones,
  registrationDeadline,
  startsAt,
  submissionDeadline,
  endsAt,
  formatDateTime,
  defaultLabels,
}: {
  milestones: ContestTimelineMilestone[];
  registrationDeadline: string | null;
  startsAt: string | null;
  submissionDeadline: string | null;
  endsAt: string | null;
  formatDateTime: (value: string | null) => string;
  defaultLabels: {
    registrationDeadline: string;
    kickoff: string;
    submissionDeadline: string;
    end: string;
  };
}): ContestTimelineRow[] {
  const appendSubmissionWhenSet = (
    rows: ContestTimelineRow[],
  ): ContestTimelineRow[] => {
    if (!submissionDeadline?.trim()) return rows;
    return [
      ...rows,
      {
        key: "submission_deadline",
        title: defaultLabels.submissionDeadline,
        datetimeLabel: formatDateTime(submissionDeadline),
      },
    ];
  };

  if (milestones.length > 0) {
    return appendSubmissionWhenSet(
      milestones.map((m, i) => ({
        key: `milestone-${i}-${m.at}`,
        title: m.title,
        datetimeLabel: formatDateTime(m.at),
      })),
    );
  }

  const rows: ContestTimelineRow[] = [
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
  ];
  if (submissionDeadline?.trim()) {
    rows.push({
      key: "submission_deadline",
      title: defaultLabels.submissionDeadline,
      datetimeLabel: formatDateTime(submissionDeadline),
    });
  }
  rows.push({
    key: "end",
    title: defaultLabels.end,
    datetimeLabel: formatDateTime(endsAt),
  });
  return rows;
}
