import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDefaultContestTimelineItems } from "@/components/hackathons/contestTimelineBuilders";
import {
  ContestTimeline,
  ContestTimelineVertical,
  type ContestTimelineRow,
} from "@/components/hackathons/ContestTimeline";
import { downloadContestCalendarIcs } from "@/lib/hackathonCalendar";
import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";

export function ContestPublicTimelineSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
  milestonesCustom: boolean;
  timelineRows: ContestTimelineRow[];
  formatDateTime: (value: string | null) => string;
}) {
  const { contest, t, milestonesCustom, timelineRows, formatDateTime } = props;

  return (
    <HackathonSectionCard
      id="timeline"
      title={t("detail.sections.timeline")}
      description={t("detail.sections.timelineDescription")}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => downloadContestCalendarIcs(contest)}
        >
          <Download className="size-4" aria-hidden />
          {t("detail.sections.addToCalendar")}
        </Button>
      }
    >
      <p className="mb-4 text-xs text-foreground-muted">
        {t("detail.sections.timelineUtcNote")}
      </p>
      {milestonesCustom ? (
        <ContestTimelineVertical rows={timelineRows} />
      ) : (
        <ContestTimeline
          items={buildDefaultContestTimelineItems({
            registrationDeadline: contest.registration_deadline,
            startsAt: contest.starts_at,
            submissionDeadline: contest.submission_deadline,
            endsAt: contest.ends_at,
            formatDate: formatDateTime,
            labels: {
              registrationDeadline: t("detail.timeline.registrationDeadline"),
              kickoff: t("detail.timeline.kickoff"),
              submissionDeadline: t("detail.timeline.submissionDeadline"),
              end: t("detail.timeline.end"),
            },
          })}
        />
      )}
    </HackathonSectionCard>
  );
}

