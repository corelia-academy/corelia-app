import { BarChart3, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

export function ContestDetailAnalyticsPanel({ vm }: { vm: ContestDetailViewModel }) {
  const {
    contest,
    translate,
    isManageView,
    canViewAggregate,
    activeManageSection,
    handleExportLeaderboardCsv,
  } = vm;

  if (!isManageView || !canViewAggregate || activeManageSection !== "analytics") {
    return null;
  }

  return (
    <Card id="analytics">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="size-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {translate("workspace.manage.analyticsTitle")}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {translate("workspace.manage.analyticsDescription")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {translate("workspace.manage.metricApplications")}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {Number(contest.metrics_snapshot.registrations_total ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {translate("workspace.manage.metricApproved")}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {Number(contest.metrics_snapshot.approved_registrations ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {translate("workspace.manage.metricSubmissions")}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {Number(contest.metrics_snapshot.submissions_total ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {translate("workspace.manage.metricScored")}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {Number(contest.metrics_snapshot.scored_submissions ?? 0)}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-medium text-foreground">
              {translate("workspace.manage.publishedLeaderboard")}
            </h3>
            {contest.published_leaderboard.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportLeaderboardCsv}
              >
                {translate("workspace.manage.exportCsv")}
              </Button>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {contest.published_leaderboard.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-5">
                <div className="text-sm font-medium text-foreground">
                  {translate("workspace.manage.leaderboardNotPublishedTitle")}
                </div>
                <div className="mt-2 text-sm text-foreground-muted">
                  {translate("workspace.manage.leaderboardNotPublishedHint")}
                </div>
              </div>
            ) : (
              contest.published_leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.submission_id}
                  className="rounded-2xl border border-border-subtle bg-surface-base shadow-card px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        #{entry.rank} · {entry.submission_title}
                      </div>
                      <div className="mt-1 text-sm text-foreground-muted">
                        {entry.contestant_name || entry.contestant_user_id}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {entry.average_score}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-primary" aria-hidden />
            <h3 className="text-base font-medium text-foreground">
              {translate("workspace.manage.winnersHeading")}
            </h3>
          </div>
          <div className="mt-3 space-y-3">
            {contest.winner_announcements.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-5">
                <div className="text-sm font-medium text-foreground">
                  {translate("workspace.manage.winnersEmptyTitle")}
                </div>
                <div className="mt-2 text-sm text-foreground-muted">
                  {translate("workspace.manage.winnersEmptyHint")}
                </div>
              </div>
            ) : (
              contest.winner_announcements.map((winner) => (
                <div
                  key={winner.submission_id}
                  className="rounded-2xl border border-border-subtle bg-surface-base shadow-card px-4 py-3"
                >
                  <div className="text-sm font-medium text-foreground">
                    {winner.award_title}
                  </div>
                  <div className="mt-1 text-sm text-foreground-muted">
                    {winner.contestant_name || winner.contestant_user_id} ·{" "}
                    {winner.submission_title}
                  </div>
                  {winner.note && (
                    <div className="mt-1 text-sm text-foreground-muted">
                      {winner.note}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

