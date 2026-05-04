import { Gavel, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailJudgingPanel({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    contest,
    translate,
    isManageView,
    canJudge,
    activeManageSection,
    submissions,
    leaderboard,
    scoreDrafts,
    setScoreDrafts,
    scoreDraftTotal,
    savingScoreId,
    handleScoreSave,
  } = vm;

  if (!isManageView || !canJudge || activeManageSection !== "judging") {
    return null;
  }

  return (
    <Card id="judging">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Gavel className="size-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-lg font-medium tracking-tight text-foreground">
              {translate("workspace.manage.judgingTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate("workspace.manage.judgingDescription")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate("workspace.manage.judgingWeightsLine", {
                product: contest.rubric_weights.product,
                technical: contest.rubric_weights.technical,
                presentation: contest.rubric_weights.presentation,
                impact: contest.rubric_weights.impact,
              })}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Trophy
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {translate("workspace.manage.judgingEmptyTitle")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {translate("workspace.manage.judgingEmptyHint")}
                </p>
              </div>
            </div>
          ) : (
            submissions.map((submission) => {
              const draft = scoreDrafts[submission.id] ?? {
                product: "0",
                technical: "0",
                presentation: "0",
                impact: "0",
                note: "",
              };
              const boardEntry = leaderboard.find(
                (item) => item.submission_id === submission.id,
              );
              return (
                <div
                  key={submission.id}
                  className="rounded-2xl border border-border-subtle bg-background p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {translate("workspace.manage.rankCurrent", {
                          rank: boardEntry?.rank ?? "—",
                        })}
                      </div>
                      <div className="mt-1 text-lg font-medium text-foreground">
                        {submission.title}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {submission.contestant_name || submission.user_id}
                        {submission.team_name
                          ? ` · ${submission.team_name}`
                          : ""}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                      {translate("workspace.manage.averageScores")}{" "}
                      <span className="font-medium text-foreground">
                        {boardEntry?.average_score ?? 0}
                      </span>{" "}
                      ·{" "}
                      {translate("workspace.manage.scoreAttempts", {
                        count: boardEntry?.score_count ?? 0,
                      })}
                    </div>
                  </div>

                  {submission.summary && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {submission.summary}
                    </p>
                  )}

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                      {translate("workspace.manage.demoPrefix")}{" "}
                      {submission.demo_url ||
                        translate("detail.labels.noDemo")}
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                      {translate("workspace.manage.repoPrefix")}{" "}
                      {submission.repo_url ||
                        translate("detail.labels.noDemo")}
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                      {translate("workspace.manage.slidePrefix")}{" "}
                      {submission.slide_url ||
                        translate("detail.labels.noDemo")}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {(
                      [
                        ["product", "workspace.manage.criterionProduct"],
                        ["technical", "workspace.manage.criterionTechnical"],
                        [
                          "presentation",
                          "workspace.manage.criterionPresentation",
                        ],
                        ["impact", "workspace.manage.criterionImpact"],
                      ] as const
                    ).map(([key, labelKey]) => (
                      <div key={key}>
                        <label className="text-sm font-medium text-foreground">
                          {translate(labelKey)}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={25}
                          value={
                            draft[key as keyof typeof draft] as string
                          }
                          onChange={(e) =>
                            setScoreDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                ...draft,
                                [key]: e.target.value,
                              },
                            }))
                          }
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-medium text-foreground">
                      {translate("workspace.manage.scoreNoteLabel")}
                    </label>
                    <textarea
                      rows={3}
                      value={draft.note}
                      onChange={(e) =>
                        setScoreDrafts((prev) => ({
                          ...prev,
                          [submission.id]: {
                            ...draft,
                            note: e.target.value,
                          },
                        }))
                      }
                      className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border-subtle bg-card px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {translate("workspace.manage.rawTotal")}{" "}
                      <span className="font-medium text-foreground">
                        {scoreDraftTotal(submission.id)}
                      </span>
                      /100
                    </span>
                    <span>{translate("workspace.manage.criteriaHint")}</span>
                  </div>

                  <Button
                    type="button"
                    className="mt-4"
                    disabled={savingScoreId === submission.id}
                    onClick={() => void handleScoreSave(submission.id)}
                  >
                    {savingScoreId === submission.id
                      ? translate("detail.labels.saving")
                      : translate("detail.labels.saveScore")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
