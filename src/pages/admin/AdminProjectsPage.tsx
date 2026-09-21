import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProjectManagementControls } from "@/components/projects/ProjectManagementControls";
import { listContests } from "@/lib/hackathons";
import { transferProjectHackathon } from "@/lib/projectSubmission";
import { listProjectsForModeration } from "@/lib/projects";
import { useAuth } from "@/stores/authStore";
import type { Project } from "@/types/projects";

function TransferProject({ project }: { project: Pick<Project, "id" | "source_id" | "source_type"> }) {
  const { t, i18n } = useTranslation("common");
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [tracks, setTracks] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const contests = useQuery({
    queryKey: ["hackathons", "staff-transfer", user?.id, i18n.resolvedLanguage],
    queryFn: () => listContests(user, i18n.resolvedLanguage ?? "vi"),
    enabled: open && Boolean(user),
  });
  const selected = contests.data?.find(item => item.id === target);
  const mutation = useMutation({
    mutationFn: () => transferProjectHackathon({ project_id: project.id, target_hackathon_id: target, track_ids: tracks, reason: reason.trim() }),
    onSuccess: async () => {
      setOpen(false); toast.success(t("projects.management.transferSuccess"));
      await client.invalidateQueries();
    },
  });
  return <>
    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>{t("projects.management.transfer")}</Button>
    <Dialog open={open} onOpenChange={next => { if (!mutation.isPending) setOpen(next); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!mutation.isPending}>
        <DialogTitle>{t("projects.management.transfer")}</DialogTitle>
        <DialogDescription>{t("projects.management.transferDescription")}</DialogDescription>
        <p className="text-sm">{t("projects.management.currentHackathon")}: {contests.data?.find(item => item.id === project.source_id)?.title ?? t("projects.management.noHackathon")}</p>
        <label className="grid gap-2 text-sm">{t("projects.management.targetHackathon")}
          <select className="min-h-11 rounded-md border border-border bg-surface-base px-3" value={target} disabled={mutation.isPending} onChange={event => { setTarget(event.target.value); setTracks([]); mutation.reset(); }}>
            <option value="">{t("projects.management.selectHackathon")}</option>
            {contests.data?.filter(item => item.id !== project.source_id || !["hackathon", "contest"].includes(project.source_type)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        {selected ? <fieldset className="space-y-2"><legend className="text-sm">{t("projects.filters.tracks")}</legend>
          {(selected.tracks ?? []).filter(track => track.active !== false).map(track => <label key={track.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={tracks.includes(track.id)} disabled={mutation.isPending} onChange={event => setTracks(current => event.target.checked ? [...current, track.id] : current.filter(id => id !== track.id))} />{track.name}</label>)}
        </fieldset> : null}
        <label className="grid gap-2 text-sm">{t("projects.management.reason")}
          <textarea className="rounded-md border border-border bg-surface-base p-3" rows={3} maxLength={1000} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} />
        </label>
        <p className="text-sm text-foreground-muted">{t("projects.management.transferImpact")}</p>
        {contests.isError || mutation.isError ? <p role="alert" className="text-sm text-destructive">{mutation.error?.message.includes("conflict:hackathon_project_exists") ? t("projects.management.transferConflict") : t("projects.management.transferFailed")}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>{t("projects.management.cancel")}</Button>
          <Button type="button" disabled={!target || !tracks.length || !/[\p{L}\p{N}]/u.test(reason) || mutation.isPending} onClick={() => mutation.mutate()}>{t("projects.management.transfer")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

export default function AdminProjectsPage() {
  const { user, profile } = useAuth();
  const { t } = useTranslation("common");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["projects", "moderation", user?.id, status, page],
    queryFn: () => listProjectsForModeration(page, status),
    enabled: profile?.role === "admin" || profile?.role === "support_staff",
    meta: { scope: "private", userId: user?.id },
  });
  if (profile?.role !== "admin" && profile?.role !== "support_staff") return null;
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
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" render={<NavLink to={`/projects/${project.slug}/edit`} />} nativeButton={false}>{t("projects.management.edit")}</Button><TransferProject project={project} /><ProjectManagementControls moderation project={project} /></div>
        </li>)}
      </ul>
      <div className="mt-4 flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("projects.management.previous")}</Button><Button variant="outline" disabled={(page + 1) * 20 >= query.data.count} onClick={() => setPage(p => p + 1)}>{t("projects.management.next")}</Button></div>
    </>}
  </section>;
}
