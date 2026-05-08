import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, Package, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublicProjects } from "@/lib/projects";
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
  const { t } = useTranslation("common");
  const [items, setItems] = useState<Array<{ project: Project; ownerLabel: string | null; ownerHandle: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const entries = await listPublicProjects();
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
  }, [t]);

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              {t("projects.title")}
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
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
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
            {t("projects.empty")}
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map(({ project, ownerHandle, ownerLabel }) => {
              const href = sourceLink(project);
              return (
                <div
                  key={project.id}
                  className="rounded-md border border-border-subtle bg-card p-4 shadow-card"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {project.title}
                    </div>
                    {ownerHandle ? (
                      <div className="mt-1 text-xs text-muted-foreground">
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
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
                    </div>
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

