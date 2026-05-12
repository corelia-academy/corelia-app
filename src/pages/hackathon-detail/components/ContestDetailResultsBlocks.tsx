import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { cn } from "@/lib/utils";

export function ContestDetailResultsBlocks({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    contest,
    translate,
    isManageView,
    canViewAggregate,
    activeManageSection,
    isManager,
    leaderboard,
    winnerAwards,
    setWinnerAwards,
    winnerNotes,
    setWinnerNotes,
    publishingResults,
    handlePublishResults,
    handleExportLeaderboardCsv,
  } = vm;

  return (
    <>
      {isManageView &&
        canViewAggregate &&
        activeManageSection === "overview" && (
          <Card id="results">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="size-5 text-primary" aria-hidden />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {translate("workspace.manage.outcomesTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {translate("workspace.manage.outcomesDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                    {translate("workspace.manage.metricApplications")}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-foreground">
                    {Number(
                      contest.metrics_snapshot.registrations_total ?? 0,
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                    {translate("workspace.manage.metricApproved")}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-foreground">
                    {Number(
                      contest.metrics_snapshot.approved_registrations ?? 0,
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                    {translate("workspace.manage.metricSubmissions")}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-foreground">
                    {Number(
                      contest.metrics_snapshot.submissions_total ?? 0,
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                    {translate("workspace.manage.metricScored")}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-foreground">
                    {Number(
                      contest.metrics_snapshot.scored_submissions ?? 0,
                    )}
                  </div>
                </div>
              </div>

              {isManager && leaderboard.length > 0 && (
                <div className="mt-4 rounded-md border border-border-subtle bg-surface-base p-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.publishResultsHeading")}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {leaderboard.slice(0, 5).map((entry) => (
                      <div
                        key={entry.submission_id}
                        className="rounded-md border border-border-subtle bg-surface-raised p-3"
                      >
                        <div className="text-sm font-medium text-foreground">
                          #{entry.rank} · {entry.submission_title}
                        </div>
                        <div className="mt-1 text-sm text-foreground-muted">
                          {entry.contestant_name ||
                            entry.contestant_user_id}{" "}
                          ·{" "}
                          {translate("workspace.manage.entryAverageScore", {
                            score: entry.average_score,
                          })}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input
                            value={
                              winnerAwards[entry.submission_id] ?? ""
                            }
                            onChange={(e) =>
                              setWinnerAwards((prev) => ({
                                ...prev,
                                [entry.submission_id]: e.target.value,
                              }))
                            }
                            className="h-11 rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                            placeholder={translate(
                              "detail.forms.awards.awardPlaceholder",
                            )}
                          />
                          <input
                            value={
                              winnerNotes[entry.submission_id] ?? ""
                            }
                            onChange={(e) =>
                              setWinnerNotes((prev) => ({
                                ...prev,
                                [entry.submission_id]: e.target.value,
                              }))
                            }
                            className="h-11 rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                            placeholder={translate(
                              "detail.forms.awards.notePlaceholder",
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    className="mt-4"
                    disabled={publishingResults}
                    onClick={() => void handlePublishResults()}
                  >
                    {publishingResults
                      ? translate("detail.labels.publishing")
                      : translate("detail.labels.publishResults")}
                  </Button>
                </div>
              )}

              <div className="mt-4">
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
                        {translate(
                          "workspace.manage.leaderboardNotPublishedTitle",
                        )}
                      </div>
                      <div className="mt-2 text-sm text-foreground-muted">
                        {translate(
                          "workspace.manage.leaderboardNotPublishedHint",
                        )}
                      </div>
                    </div>
                  ) : (
                    contest.published_leaderboard
                      .slice(0, 10)
                      .map((entry) => (
                        <div
                          key={entry.submission_id}
                          className="rounded-md border border-border-subtle bg-surface-base px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                #{entry.rank} · {entry.submission_title}
                              </div>
                              <div className="mt-1 text-sm text-foreground-muted">
                                {entry.contestant_name ||
                                  entry.contestant_user_id}
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

              <div className="mt-4">
                <h3 className="text-base font-medium text-foreground">
                  {translate("workspace.manage.winnersHeading")}
                </h3>
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
                        className="rounded-md border border-border-subtle bg-surface-base px-4 py-3"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {winner.award_title}
                        </div>
                        <div className="mt-1 text-sm text-foreground-muted">
                          {winner.contestant_name ||
                            winner.contestant_user_id}{" "}
                          · {winner.submission_title}
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
        )}

      {!isManageView &&
        contest.status === "ended" &&
        (contest.published_leaderboard.length > 0 ||
          contest.winner_announcements.length > 0) && (
          <Card id="results" className={cn("scroll-mt-36")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="size-5 text-primary" aria-hidden />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {translate("detail.public.results.cardTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {translate("detail.public.results.cardDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-base font-medium text-foreground">
                  {translate("detail.public.results.leaderboardHeading")}
                </h3>
                <div className="mt-3 space-y-3">
                  {contest.published_leaderboard.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-5">
                      <div className="text-sm font-medium text-foreground">
                        {translate(
                          "detail.public.results.leaderboardEmptyTitle",
                        )}
                      </div>
                      <div className="mt-2 text-sm text-foreground-muted">
                        {translate(
                          "detail.public.results.leaderboardEmptyHint",
                        )}
                      </div>
                    </div>
                  ) : (
                    contest.published_leaderboard
                      .slice(0, 10)
                      .map((entry) => (
                        <div
                          key={entry.submission_id}
                          className="rounded-md border border-border-subtle bg-surface-base px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                #{entry.rank} · {entry.submission_title}
                              </div>
                              <div className="mt-1 text-sm text-foreground-muted">
                                {entry.contestant_name ||
                                  entry.contestant_user_id}
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

              <div className="mt-4">
                <h3 className="text-base font-medium text-foreground">
                  {translate("detail.public.results.winnersHeading")}
                </h3>
                <div className="mt-3 space-y-3">
                  {contest.winner_announcements.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-5">
                      <div className="text-sm font-medium text-foreground">
                        {translate(
                          "detail.public.results.winnersEmptyTitle",
                        )}
                      </div>
                      <div className="mt-2 text-sm text-foreground-muted">
                        {translate(
                          "detail.public.results.winnersEmptyHint",
                        )}
                      </div>
                    </div>
                  ) : (
                    contest.winner_announcements.map((winner) => (
                      <div
                        key={winner.submission_id}
                        className="rounded-md border border-border-subtle bg-surface-base px-4 py-3"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {winner.award_title}
                        </div>
                        <div className="mt-1 text-sm text-foreground-muted">
                          {winner.contestant_name ||
                            winner.contestant_user_id}{" "}
                          · {winner.submission_title}
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
        )}
    </>
  );
}
