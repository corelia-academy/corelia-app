import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { listContestShowcaseProjects } from "@/lib/projects";
import { listMyProjectHeartIds } from "@/lib/projectSocial";
import type { Contest } from "@/types/hackathons";
import type { ContestLinkedShowcaseProject } from "@/types/projects";
import {
  buildContestShowcaseRows,
  type ContestShowcaseDisplayRow,
} from "@/pages/hackathon-detail/utils/contestShowcase";
import { useAuth } from "@/stores/authStore";
import { cn } from "@/lib/utils";

export function ContestPublicProjectsSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const { user } = useAuth();
  const [showcaseProjects, setShowcaseProjects] = useState<ContestLinkedShowcaseProject[]>(
    [],
  );
  const [heartedByProjectId, setHeartedByProjectId] = useState<Record<string, boolean>>({});
  const [teamBySubmission, setTeamBySubmission] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    void listContestShowcaseProjects(contest.id)
      .then((rows) => {
        if (!cancelled) setShowcaseProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setShowcaseProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [contest.id]);

  useEffect(() => {
    const ids = showcaseProjects.map((p) => p.id).filter(Boolean);
    if (ids.length === 0 || !user) {
      queueMicrotask(() => setHeartedByProjectId({}));
      return;
    }
    let cancelled = false;
    void listMyProjectHeartIds(ids).then((set) => {
      if (cancelled) return;
      const next: Record<string, boolean> = {};
      for (const id of ids) next[id] = set.has(id);
      setHeartedByProjectId(next);
    });
    return () => {
      cancelled = true;
    };
  }, [showcaseProjects, user]);

  const displayRows: ContestShowcaseDisplayRow[] = useMemo(
    () =>
      buildContestShowcaseRows(
        showcaseProjects,
        contest.published_leaderboard ?? [],
      ),
    [contest.published_leaderboard, showcaseProjects],
  );

  useEffect(() => {
    if (showcaseProjects.length === 0) {
      queueMicrotask(() => setTeamBySubmission({}));
      return;
    }
    let cancelled = false;
    const projectIds = showcaseProjects.map((p) => p.id);
    void (async () => {
      const { data: collabs } = await supabase
        .from("project_collaborators")
        .select("project_id,user_id")
        .in("project_id", projectIds);
      if (cancelled) return;

      const userIds = new Set<string>();
      for (const c of collabs ?? []) {
        userIds.add(c.user_id);
      }
      for (const p of showcaseProjects) {
        userIds.add(p.owner_id);
      }

      const { data: profiles } =
        userIds.size > 0
          ? await supabase
              .from("public_profiles")
              .select("id,full_name,username")
              .in("id", Array.from(userIds))
          : { data: [] };
      if (cancelled) return;

      const label = (uid: string) => {
        const pr = (profiles ?? []).find((x) => x.id === uid);
        return (
          (pr?.full_name as string | undefined)?.trim() ||
          (pr?.username as string | undefined)?.trim() ||
          uid
        );
      };

      const next: Record<string, string> = {};
      for (const proj of showcaseProjects) {
        const sid = proj.source_submission_id ?? proj.id;
        const names: string[] = [label(proj.owner_id)];
        for (const c of collabs ?? []) {
          if (c.project_id === proj.id && c.user_id !== proj.owner_id) {
            names.push(label(c.user_id));
          }
        }
        next[sid] = names.filter(Boolean).join(", ");
      }
      if (!cancelled) setTeamBySubmission(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [showcaseProjects]);

  const submissionsTotal = Number(contest.metrics_snapshot?.submissions_total ?? 0);

  return (
    <Card id="projects" className={cn("scroll-mt-36")}>
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("detail.projects.sectionTitle")}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("detail.projects.sectionDescription")}
        </p>
        {displayRows.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border-subtle bg-surface-base px-4 py-8 text-center">
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col rounded-md border border-border-subtle bg-surface-base p-4"
              >
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
                </div>
                {row.projectId ? (
                  <ProjectSocialBlock
                    projectId={row.projectId}
                    ownerId={
                      row.ownerId ??
                      showcaseProjects.find((p) => p.id === row.projectId)?.owner_id ??
                      ""
                    }
                    likeCount={row.likeCount}
                    hearted={heartedByProjectId[row.projectId] ?? false}
                    variant="compact"
                    className="mt-3"
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
