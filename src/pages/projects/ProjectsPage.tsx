import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, Package, ShieldAlert } from "lucide-react";

import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectCoverImageUrl, listPublicProjects } from "@/lib/projects";
import { listMyProjectHeartIds } from "@/lib/projectSocial";
import { projectSourceLabelKey } from "@/lib/projectSource";
import { useAuth } from "@/stores/authStore";
import type { Project } from "@/types/projects";

function sourceLink(project: Project): string | null {
  if (project.source_type === "contest" && project.source_id) {
    return `/hackathons/${project.source_id}/overview`;
  }
  if (project.source_type === "course" && project.source_id) {
    return `/courses/${project.source_id}`;
  }
  return null;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("common");
  const [items, setItems] = useState<Array<{ project: Project; ownerLabel: string | null; ownerHandle: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heartedByProjectId, setHeartedByProjectId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const entries = await listPublicProjects(i18n.language);
        if (cancelled) return;
        setItems(
          entries.map(({ project, owner }) => {
            const handle = owner?.username || owner?.ocid || owner?.id || null;
            const label =
              owner?.full_name?.trim() ||
              owner?.username?.trim() ||
              owner?.ocid?.trim() ||
              null;
            return { project, ownerLabel: label, ownerHandle: handle };
          }),
        );
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : t("projects.errors.loadFailed"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t, i18n.language]);

  useEffect(() => {
    const ids = items.map(({ project }) => project.id).filter(Boolean);
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
  }, [items, user]);

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              {t("projects.title")}
            </h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("projects.description")}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <ShieldAlert className="size-6 text-foreground-subtle" aria-hidden />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted sm:p-6">
            {t("projects.empty")}
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map(({ project, ownerHandle, ownerLabel }) => {
              const href = sourceLink(project);
              return (
                <div
                  key={project.id}
                  className="rounded-md border border-border-subtle bg-surface-base p-4"
                >
                  {getProjectCoverImageUrl(project) ? (
                    <div className="mb-4 overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
                      <img
                        src={getProjectCoverImageUrl(project) ?? ""}
                        alt={project.title}
                        className="h-48 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {project.title}
                      </div>
                      <span className="shrink-0 rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                        {t(projectSourceLabelKey(project.source_type))}
                      </span>
                    </div>
                    {ownerHandle ? (
                      <div className="mt-1 text-xs text-foreground-muted">
                        {t("projects.byPrefix")}{" "}
                        <NavLink
                          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                          to={`/u/${ownerHandle}`}
                        >
                          {ownerLabel ?? ownerHandle}
                        </NavLink>
                      </div>
                    ) : null}
                    {project.summary ? (
                      <div className="mt-1 line-clamp-2 text-sm text-foreground-muted">
                        {project.summary}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {href ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={<NavLink to={href} />}
                          nativeButton={false}
                        >
                          {t("projects.viewSource")}
                        </Button>
                      ) : null}
                      {project.demo_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <a href={project.demo_url} target="_blank" rel="noreferrer" />
                          }
                          nativeButton={false}
                          className="gap-1"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          {t("projects.demo")}
                        </Button>
                      ) : null}
                      {project.repo_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <a href={project.repo_url} target="_blank" rel="noreferrer" />
                          }
                          nativeButton={false}
                          className="gap-1"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          {t("projects.repo")}
                        </Button>
                      ) : null}
                      {project.slide_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <a href={project.slide_url} target="_blank" rel="noreferrer" />
                          }
                          nativeButton={false}
                          className="gap-1"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          {t("projects.slides")}
                        </Button>
                      ) : null}
                      {project.screenshot_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <a href={project.screenshot_url} target="_blank" rel="noreferrer" />
                          }
                          nativeButton={false}
                          className="gap-1"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          {t("projects.screenshot")}
                        </Button>
                      ) : null}
                      {project.video_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <a href={project.video_url} target="_blank" rel="noreferrer" />
                          }
                          nativeButton={false}
                          className="gap-1"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          {t("projects.video")}
                        </Button>
                      ) : null}
                    </div>
                    <ProjectSocialBlock
                      projectId={project.id}
                      ownerId={project.owner_id}
                      likeCount={Number(project.like_count ?? 0)}
                      hearted={heartedByProjectId[project.id] ?? false}
                      variant="default"
                      className="mt-3"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
