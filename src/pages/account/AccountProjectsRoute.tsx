import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";

import { ProjectManagementControls } from "@/components/projects/ProjectManagementControls";
import { Button } from "@/components/ui/button";
import type { MyProjectEntry } from "@/lib/projectCollaboration";
import { setMyProjectCollaborationVisibility } from "@/lib/projectCollaboration";
import { accountKeys, accountProjectsQueryOptions } from "@/features/account/accountQueries";
import { useAuth } from "@/stores/authStore";
import { RouteSkeleton } from "@/components/loading/RouteSkeleton";

export function AccountProjectsRoute() {
  const { t } = useTranslation(["common", "account"]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectsQuery = useQuery(accountProjectsQueryOptions(user?.id));
  const [actionError, setActionError] = useState<string | null>(null);

  const visibilityMutation = useMutation({
    mutationFn: async ({ projectId, value }: { projectId: string; value: boolean }) => {
      await setMyProjectCollaborationVisibility(projectId, value);
      return { projectId, value };
    },
    onSuccess: ({ projectId, value }) => {
      if (!user?.id) return;
      queryClient.setQueryData<MyProjectEntry[]>(
        accountKeys.projects(user.id),
        (previous = []) => previous.map((entry) =>
          entry.project.id === projectId
            ? { ...entry, access: { ...entry.access, show_in_portfolio: value } }
            : entry,
        ),
      );
    },
  });

  async function handlePortfolioVisibilityChange(projectId: string, value: boolean) {
    setActionError(null);
    try {
      await visibilityMutation.mutateAsync({ projectId, value });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("account:projects.errors.visibilityFailed"));
    }
  }

  if (projectsQuery.isPending) {
    return <RouteSkeleton variant="list" bare />;
  }
  if (projectsQuery.error) {
    return <div className="text-sm text-destructive">{projectsQuery.error instanceof Error ? projectsQuery.error.message : t("projects.errors.loadFailed")}</div>;
  }

  const entries = projectsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-primary" aria-hidden />
          <h1 className="text-sm font-semibold text-foreground">{t("account:projects.pageTitle")}</h1>
        </div>
        <Button size="small" render={<NavLink to="/projects/new" />} nativeButton={false}>
          {t("account:projects.newProject")}
        </Button>
      </div>

      {actionError ? (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted">
          {t("projects.empty")}
        </div>
      ) : (
        <ul className="grid gap-3">
          {entries.map(({ project, access }) => {
            const isOwner = Boolean(access.is_owner);
            return (
              <li key={project.id} className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-base font-semibold text-foreground">{project.title}</h2>
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                        {isOwner ? t("account:projects.ownerBadge") : t("account:projects.collaboratorBadge")}
                      </span>
                      <span className="text-xs text-foreground-muted">{t(`projects.editor.${project.visibility}`)}</span>
                    </div>
                    {project.summary ? (
                      <p className="line-clamp-2 text-sm text-foreground-muted">{project.summary}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="small" variant="cta" hierarchy="secondary" render={<NavLink to={`/projects/${project.slug}`} />} nativeButton={false}>
                      {t("projects.editor.viewProject")}
                    </Button>
                    {isOwner ? (
                      <>
                        <Button size="small" render={<NavLink to={`/projects/${project.slug}/edit`} />} nativeButton={false}>
                          {t("projects.detail.edit")}
                        </Button>
                        <ProjectManagementControls project={project} />
                      </>
                    ) : null}
                  </div>
                </div>

                {!isOwner ? (
                  <label className="mt-3 flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={Boolean(access.show_in_portfolio)}
                      disabled={visibilityMutation.isPending}
                      onChange={(e) => void handlePortfolioVisibilityChange(project.id, e.target.checked)}
                    />
                    <span className="space-y-1">
                      <span className="block font-medium text-foreground">{t("account:projects.showOnProfileLabel")}</span>
                      <span className="block text-foreground-muted">{t("account:projects.showOnProfileHint")}</span>
                    </span>
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
