import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildDefaultContestTimelineItems } from "@/components/contests/contestTimelineBuilders";
import {
  ContestTimeline,
  ContestTimelineVertical,
  type ContestTimelineRow,
} from "@/components/contests/ContestTimeline";
import { downloadContestCalendarIcs } from "@/lib/contestCalendar";
import type { Contest } from "@/types/contests";

export function ContestPublicTimelineSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
  milestonesCustom: boolean;
  timelineRows: ContestTimelineRow[];
  formatDateTime: (value: string | null) => string;
}) {
  const { contest, t, milestonesCustom, timelineRows, formatDateTime } = props;

  return (
    <Card id="timeline">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("detail.sections.timeline")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("detail.sections.timelineDescription")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("detail.sections.timelineUtcNote")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => downloadContestCalendarIcs(contest)}
          >
            <Download className="size-4" aria-hidden />
            {t("detail.sections.addToCalendar")}
          </Button>
        </div>
        <div className="mt-6">
          {milestonesCustom ? (
            <ContestTimelineVertical rows={timelineRows} />
          ) : (
            <ContestTimeline
              items={buildDefaultContestTimelineItems({
                registrationDeadline: contest.registration_deadline,
                startsAt: contest.starts_at,
                endsAt: contest.ends_at,
                formatDate: formatDateTime,
                labels: {
                  registrationDeadline: t("detail.timeline.registrationDeadline"),
                  kickoff: t("detail.timeline.kickoff"),
                  end: t("detail.timeline.end"),
                },
              })}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

