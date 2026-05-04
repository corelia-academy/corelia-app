import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildDefaultContestTimelineItems,
  ContestTimeline,
  ContestTimelineVertical,
  type ContestTimelineRow,
} from "@/components/contests/ContestTimeline";
import { downloadContestCalendarIcs } from "@/lib/contestCalendar";
import type { Contest } from "@/types/contests";

export function ContestDetailPublicOverviewExtras({
  contest,
  translate,
  formatDate,
  timelineRows,
  publicJourney,
}: {
  contest: Contest;
  translate: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (value: string | null) => string;
  timelineRows: ContestTimelineRow[];
  publicJourney: { title: string; description: string }[];
}) {
  return (
    <>
      {(contest.prizes ?? []).length > 0 ? (
        <Card id="prizes">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium tracking-tight text-foreground">
              {translate("detail.prizes.sectionTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {translate("detail.prizes.sectionDescription")}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(contest.prizes ?? []).map((prize, index) => (
                <div
                  key={`${prize.rank_label}-${prize.title}-${index}`}
                  className="rounded-2xl border border-border-subtle bg-muted/15 p-5"
                >
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {prize.rank_label}
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    {prize.title}
                  </div>
                  {prize.value_display ? (
                    <div className="mt-2 text-sm font-medium text-primary">
                      {prize.value_display}
                    </div>
                  ) : null}
                  {prize.description ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {prize.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(contest.faqs ?? []).length > 0 ? (
        <Card id="faqs">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium tracking-tight text-foreground">
              {translate("detail.faqs.sectionTitle")}
            </h2>
            <div className="mt-6 space-y-3">
              {(contest.faqs ?? []).map((faq, index) => (
                <details
                  key={`${faq.question}-${index}`}
                  className="group rounded-2xl border border-border-subtle bg-background px-4 py-3"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      {faq.question}
                      <span className="text-xs text-muted-foreground group-open:rotate-180">
                        ▼
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card id="timeline">
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium tracking-tight text-foreground">
                {translate("detail.sections.timeline")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {translate("detail.sections.timelineDescription")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {translate("detail.sections.timelineUtcNote")}
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
              {translate("detail.sections.addToCalendar")}
            </Button>
          </div>
          <div className="mt-6">
            {(contest.timeline_milestones ?? []).length > 0 ? (
              <ContestTimelineVertical rows={timelineRows} />
            ) : (
              <ContestTimeline
                items={buildDefaultContestTimelineItems({
                  registrationDeadline: contest.registration_deadline,
                  startsAt: contest.starts_at,
                  endsAt: contest.ends_at,
                  formatDate,
                  labels: {
                    registrationDeadline: translate(
                      "detail.timeline.registrationDeadline",
                    ),
                    kickoff: translate("detail.timeline.kickoff"),
                    end: translate("detail.timeline.end"),
                  },
                })}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-medium tracking-tight text-foreground">
            {translate("detail.sections.howToParticipate")}
          </h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {publicJourney.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border-subtle bg-background p-4"
              >
                <div className="text-sm font-medium text-foreground">
                  {step.title}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
