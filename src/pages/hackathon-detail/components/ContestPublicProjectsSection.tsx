import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Contest } from "@/types/hackathons";

export function ContestPublicProjectsSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("detail.projects.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.projects.sectionDescription")}
        </p>
        {contest.status !== "ended" || contest.published_leaderboard.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-8 text-center">
            <div className="text-sm font-medium text-foreground">
              {t("detail.projects.emptyTitle")}
            </div>
            <div className="mt-2 text-sm text-foreground-muted">
              {t("detail.projects.emptyHint")}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contest.published_leaderboard.map((entry) => (
              <div
                key={entry.submission_id}
                className="flex flex-col rounded-md border border-border-subtle bg-surface-base p-4"
              >
                <div className="text-xs text-foreground-muted">#{entry.rank}</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {entry.submission_title}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {entry.team_name || entry.contestant_name || entry.contestant_user_id}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {t("detail.projects.scoreLine", {
                    score: entry.average_score,
                    count: entry.score_count,
                  })}
                </div>
                {entry.summary ? (
                  <p className="mt-3 line-clamp-4 text-xs leading-5 text-foreground-muted">
                    {entry.summary}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.demo_url ? (
                    <Button
                      render={
                        <a href={entry.demo_url} target="_blank" rel="noreferrer" />
                      }
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t("detail.projects.viewDemo")}
                    </Button>
                  ) : null}
                  {entry.repo_url ? (
                    <Button
                      render={
                        <a href={entry.repo_url} target="_blank" rel="noreferrer" />
                      }
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t("detail.projects.viewRepo")}
                    </Button>
                  ) : null}
                  {entry.slide_url ? (
                    <Button
                      render={
                        <a href={entry.slide_url} target="_blank" rel="noreferrer" />
                      }
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t("detail.projects.viewSlides")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

