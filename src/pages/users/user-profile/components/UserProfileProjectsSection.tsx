import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, FolderGit2 } from "lucide-react";

import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import {
  applyProjectLocaleContent,
  getBatchProjectLocaleContent,
  getProjectCoverImageUrl,
} from "@/lib/projects";
import { listMyProjectHeartIds } from "@/lib/projectSocial";
import { pickContentLocale } from "@/lib/entityLocales";
import type { PublicProfile } from "@/types/database";
import type { Project } from "@/types/projects";
import { isHackathonProjectSource, projectSourceLabelKey } from "@/lib/projectSource";
import { useAuth } from "@/stores/authStore";

function sourceLink(project: Project): string | null {
  if (isHackathonProjectSource(project.source_type) && project.source_id) {
    return `/hackathons/${project.source_id}/overview`;
  }
  if (project.source_type === "course" && project.source_id) {
    return `/courses/${project.source_id}`;
  }
  return null;
}

export function UserProfileProjectsSection({
  profile,
}: {
  profile: PublicProfile;
}) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("common");
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heartedByProjectId, setHeartedByProjectId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const select =
          "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;

        const [{ data: owned, error: ownedErr }, { data: collabRows, error: collabErr }] =
          await Promise.all([
            supabase
              .from("projects")
              .select(select)
              .eq("owner_id", profile.id)
              .eq("visibility", "public")
              .order("updated_at", { ascending: false }),
            supabase
              .from("project_collaborators")
              .select("project_id")
              .eq("user_id", profile.id)
              .eq("show_in_portfolio", true),
          ]);

        if (ownedErr) throw new Error(ownedErr.message);
        if (collabErr) throw new Error(collabErr.message);
        if (cancelled) return;

        const collaboratorProjectIds = Array.from(
          new Set((collabRows ?? []).map((row) => row.project_id).filter(Boolean)),
        ) as string[];

        let collaboratorProjects: Project[] = [];
        if (collaboratorProjectIds.length > 0) {
          const { data, error } = await supabase
            .from("projects")
            .select(select)
            .in("id", collaboratorProjectIds)
            .eq("visibility", "public")
            .order("updated_at", { ascending: false });
          if (error) throw new Error(error.message);
          collaboratorProjects = (data ?? []) as Project[];
        }

        const merged = [...((owned ?? []) as Project[]), ...collaboratorProjects];
        const byId = new Map<string, Project>();
        for (const item of merged) byId.set(item.id, item);
        const baseList = Array.from(byId.values()).sort((a, b) =>
          String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
        );

        const preferred = i18n.language;
        const idsByLocale = new Map<"vi" | "en", string[]>();
        for (const p of baseList) {
          const desired = pickContentLocale(p.i18n ?? null, preferred);
          const ids = idsByLocale.get(desired) ?? [];
          ids.push(p.id);
          idsByLocale.set(desired, ids);
        }
        const localeMaps = new Map<"vi" | "en", Map<string, { title?: string; summary?: string | null }>>();
        await Promise.all(
          Array.from(idsByLocale.entries()).map(async ([locale, ids]) => {
            localeMaps.set(locale, await getBatchProjectLocaleContent(ids, locale));
          }),
        );

        setItems(
          baseList.map((p) => {
            const desired = pickContentLocale(p.i18n ?? null, preferred);
            const localized = localeMaps.get(desired)?.get(p.id) ?? null;
            return applyProjectLocaleContent(p, localized);
          }),
        );
      } catch {
        if (cancelled) return;
        setError(t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, t, i18n.language]);

  useEffect(() => {
    const ids = items.map((p) => p.id).filter(Boolean);
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

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("projects.title")}
          </h2>
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("projects.title")}
          </h2>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted shadow-card sm:p-6">
          {error}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("projects.title")}
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted shadow-card">
          {t("userProfile.projects.empty")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("projects.title")}
          </h2>
        </div>
        <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium tabular-nums text-foreground-muted">
          {items.length}
        </span>
      </div>

      <div className="grid gap-4">
        {items.map((project) => {
          const href = sourceLink(project);
          const coverUrl = getProjectCoverImageUrl(project);

          return (
            <article
              key={project.id}
              className="group overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card transition-[background-color,border-color,box-shadow] duration-200 hover:border-border hover:bg-surface-raised"
            >
              <div className="grid min-w-0 gap-0 md:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
                <div className="relative aspect-video overflow-hidden border-b border-border-subtle bg-surface-raised md:aspect-auto md:min-h-56 md:border-r md:border-b-0">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={project.title}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center p-6 text-center">
                      <div>
                        <FolderGit2
                          className="mx-auto size-8 text-foreground-subtle"
                          aria-hidden
                        />
                        <div className="mt-3 line-clamp-2 text-sm font-medium text-foreground-muted">
                          {project.title}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {project.title}
                    </h3>
                    <span className="shrink-0 rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase text-foreground-muted">
                      {t(projectSourceLabelKey(project.source_type))}
                    </span>
                  </div>

                  {project.summary ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground-muted">
                      {project.summary}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-foreground-muted">
                      {t("projects.card.noSummary")}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {href ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={<NavLink to={href} />}
                        nativeButton={false}
                      >
                        {t("userProfile.projects.viewSource")}
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
                        {t("userProfile.projects.demo")}
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
                        {t("userProfile.projects.repo")}
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
                        {t("userProfile.projects.slides")}
                      </Button>
                    ) : null}
                    {project.screenshot_url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <a
                            href={project.screenshot_url}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                        nativeButton={false}
                        className="gap-1"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                        {t("userProfile.projects.screenshot")}
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
                        {t("userProfile.projects.video")}
                      </Button>
                    ) : null}
                  </div>

                  <ProjectSocialBlock
                    projectId={project.id}
                    ownerId={project.owner_id}
                    likeCount={Number(project.like_count ?? 0)}
                    hearted={heartedByProjectId[project.id] ?? false}
                    variant="default"
                    className="mt-4"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
