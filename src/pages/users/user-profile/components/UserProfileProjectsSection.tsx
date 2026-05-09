import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import type { PublicProfile } from "@/types/database";
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

export function UserProfileProjectsSection({
  profile,
}: {
  profile: PublicProfile;
}) {
  const { t } = useTranslation("common");
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const select =
          "id,owner_id,title,summary,demo_url,repo_url,slide_url,visibility,source_type,source_id,source_submission_id,created_at,updated_at" as const;

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
        const result = Array.from(byId.values()).sort((a, b) =>
          String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
        );

        setItems(result);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : t("userProfile.errors.loadFailed"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, t]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted sm:p-6">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted sm:p-6">
        {t("userProfile.projects.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((project) => {
        const href = sourceLink(project);
        return (
          <div
            key={project.id}
            className="rounded-md border border-border-subtle bg-surface-base p-4"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {project.title}
              </div>
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
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

