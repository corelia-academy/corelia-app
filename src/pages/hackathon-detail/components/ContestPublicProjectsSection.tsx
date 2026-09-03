import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import { getProjectCoverImageUrl } from "@/lib/projects";
import { publicHackathonShowcaseQueryOptions } from "@/features/hackathons/hackathonQueries";
import { projectHeartsQueryOptions } from "@/features/projects/projectSocialQueries";
import type { Contest } from "@/types/hackathons";
import type { ContestLinkedShowcaseProject } from "@/types/projects";
import {
  buildContestShowcaseRows,
  type ContestShowcaseDisplayRow,
} from "@/pages/hackathon-detail/utils/contestShowcase";
import { useAuth } from "@/stores/authStore";

const EMPTY_SHOWCASE_PROJECTS: ContestLinkedShowcaseProject[] = [];
const EMPTY_TEAM_BY_SUBMISSION: Record<string, string> = {};
const EMPTY_HEART_IDS = new Set<string>();

export function ContestPublicProjectsSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const { user } = useAuth();
  const portfolioQuery = useQuery(publicHackathonShowcaseQueryOptions(contest.id));
  const showcaseProjects = portfolioQuery.data?.projects ?? EMPTY_SHOWCASE_PROJECTS;
  const teamBySubmission =
    portfolioQuery.data?.teamBySubmission ?? EMPTY_TEAM_BY_SUBMISSION;
  const projectIds = useMemo(
    () => showcaseProjects.map((project) => project.id).filter(Boolean),
    [showcaseProjects],
  );
  const heartsQuery = useQuery(projectHeartsQueryOptions(user?.id, projectIds));
  const heartedIds = heartsQuery.data ?? EMPTY_HEART_IDS;

  const displayRows: ContestShowcaseDisplayRow[] = useMemo(
    () =>
      buildContestShowcaseRows(
        showcaseProjects,
        contest.published_leaderboard ?? [],
      ),
    [contest.published_leaderboard, showcaseProjects],
  );

  const submissionsTotal = Number(contest.metrics_snapshot?.submissions_total ?? 0);

  return (
    <HackathonSectionCard
      id="projects"
      title={t("detail.projects.sectionTitle")}
      description={t("detail.projects.sectionDescription")}
    >
      {portfolioQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : displayRows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-8 text-center">
          <div className="text-sm font-medium text-foreground">
            {t("detail.projects.emptyTitle")}
          </div>
          <div className="mt-2 text-sm text-foreground-muted">
            {submissionsTotal > 0 && showcaseProjects.length === 0
              ? t("detail.projects.emptyHintSyncing")
              : t("detail.projects.emptyHint")}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4"
              >
                {getProjectCoverImageUrl(row) ? (
                  <div className="mb-4 overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
                    <img
                      src={getProjectCoverImageUrl(row) ?? ""}
                      alt={row.title}
                      className="h-44 w-full object-contain p-3"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                {typeof row.rank === "number" ? (
                  <div className="text-xs text-foreground-muted">#{row.rank}</div>
                ) : null}
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {row.title}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {t("detail.projects.teamLine", {
                    names:
                      teamBySubmission[row.submissionId] ||
                      row.contestant_fallback ||
                      "—",
                  })}
                </div>
                {typeof row.average_score === "number" &&
                typeof row.score_count === "number" ? (
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {t("detail.projects.scoreLine", {
                      score: row.average_score,
                      count: row.score_count,
                    })}
                  </div>
                ) : null}
                {row.summary ? (
                  <p className="mt-3 line-clamp-4 text-xs leading-5 text-foreground-muted">
                    {row.summary}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {row.demo_url ? (
                    <Button
                      render={
                        <a href={row.demo_url} target="_blank" rel="noreferrer" />
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
                  {row.repo_url ? (
                    <Button
                      render={
                        <a href={row.repo_url} target="_blank" rel="noreferrer" />
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
                  {row.slide_url ? (
                    <Button
                      render={
                        <a href={row.slide_url} target="_blank" rel="noreferrer" />
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
                  {row.video_url ? (
                    <Button
                      render={
                        <a href={row.video_url} target="_blank" rel="noreferrer" />
                      }
                      nativeButton={false}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t("common:projects.video")}
                    </Button>
                  ) : null}
                </div>
                {row.projectId ? (
                  <ProjectSocialBlock
                    projectId={row.projectId}
                    likeCount={row.likeCount}
                    hearted={heartedIds.has(row.projectId)}
                    className="mt-3"
                  />
                ) : null}
              </div>
          ))}
        </div>
      )}
    </HackathonSectionCard>
  );
}
