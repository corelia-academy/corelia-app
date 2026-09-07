import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ProjectManagementControls } from "@/components/projects/ProjectManagementControls";
import { listProjectsForModeration } from "@/lib/projects";
import { useAuth } from "@/stores/authStore";

export default function AdminProjectsPage() {
  const { user, profile } = useAuth();
  const { t } = useTranslation("common");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["projects", "moderation", user?.id, status, page],
    queryFn: () => listProjectsForModeration(page, status),
    enabled: profile?.role === "admin",
    meta: { scope: "private", userId: user?.id },
  });
  if (profile?.role !== "admin") return null;
  return <section className="m-4 rounded-xl border border-border bg-surface-base p-4 sm:m-6">
    <h1 className="text-xl font-semibold">{t("projects.management.manage")}</h1>
    <label className="mt-4 flex flex-wrap items-center gap-3 text-sm">{t("projects.management.status")}
      <select className="min-h-11 rounded-md border border-border bg-surface-base px-3" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
        {(["all", "blocked", "public", "unlisted", "private"] as const).map(value => <option key={value} value={value}>{t(`projects.management.${value}`)}</option>)}
      </select>
    </label>
    {query.isPending ? <p role="status" className="mt-4">{t("projects.loading")}</p> : query.isError ? <div role="alert" className="mt-4"><p>{t("projects.management.failed")}</p><Button onClick={() => void query.refetch()}>{t("projects.retry")}</Button></div> : <>
      {!query.data.items.length ? <p className="mt-4">{t("projects.empty")}</p> : null}
      <ul className="mt-4 divide-y divide-border">
        {query.data.items.map(project => <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1"><NavLink className="block truncate underline" to={`/projects/${project.slug}`}>{project.title}</NavLink><p className="text-xs text-foreground-muted">{t(`projects.management.${project.blocked ? "blocked" : project.visibility}`)}</p></div>
          <ProjectManagementControls moderation project={project} />
        </li>)}
      </ul>
      <div className="mt-4 flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("projects.management.previous")}</Button><Button variant="outline" disabled={(page + 1) * 20 >= query.data.count} onClick={() => setPage(p => p + 1)}>{t("projects.management.next")}</Button></div>
    </>}
  </section>;
}
