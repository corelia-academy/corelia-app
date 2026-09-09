import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProjectManagement } from "@/features/projects/useProjectManagement";
import type { ProjectManagementAction } from "@/lib/projectSubmission";
import { useAuth } from "@/stores/authStore";
import type { Project } from "@/types/projects";

export function ProjectManagementControls({ project, onDeleted, moderation = false }: {
  project: Pick<Project, "id" | "owner_id" | "title" | "visibility" | "blocked">;
  onDeleted?: () => void;
  moderation?: boolean;
}) {
  const { user, profile } = useAuth();
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ProjectManagementAction>("delete");
  const [reason, setReason] = useState("");
  const mutation = useProjectManagement(project.id);
  const admin = moderation && profile?.role === "admin";
  if (!user || (!admin && user.id !== project.owner_id)) return null;
  const label = (value: ProjectManagementAction) => t(`projects.management.${value}`);
  const actions: ProjectManagementAction[] = admin
    ? [project.blocked ? "unblock" : "block", ...(!project.blocked ? ["public", "unlisted", "private"] as const : []), "delete"]
    : ["delete"];
  const error = mutation.error ? t(
    mutation.error.message.includes("project_blocked") ? "projects.management.blockedError" :
      mutation.error.message.includes("required_content") ? "projects.management.contentError" : "projects.management.failed",
  ) : null;
  return <>
    <Button type="button" size="sm" variant="outline" onClick={() => {
      setAction(admin ? (project.blocked ? "unblock" : "block") : "delete");
      setReason(""); mutation.reset(); setOpen(true);
    }}>{t(admin ? "projects.management.manage" : "projects.management.delete")}</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) setOpen(next); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!mutation.isPending}>
        <DialogTitle>{t("projects.management.title", { title: project.title })}</DialogTitle>
        <DialogDescription>{t(action === "delete" ? "projects.management.deleteDescription" : "projects.management.description")}</DialogDescription>
        {admin ? <label className="grid gap-2 text-label-medium font-body">{t("projects.management.action")}
          <select className="min-h-11 rounded-md border border-border bg-surface-base px-3" value={action} disabled={mutation.isPending} onChange={e => { setAction(e.target.value as ProjectManagementAction); mutation.reset(); }}>
            {actions.map(value => <option key={value} value={value}>{label(value)}</option>)}
          </select>
        </label> : null}
        {admin || profile?.role === "admin" ? <label className="grid gap-2 text-label-medium font-body">{t("projects.management.reason")}
          <textarea required maxLength={1000} rows={3} value={reason} disabled={mutation.isPending} onChange={e => setReason(e.target.value)} className="rounded-md border border-border bg-surface-base p-3 text-body-medium font-body" />
          <span className="text-body-small font-body text-foreground-muted">{reason.length} / 1000</span>
        </label> : null}
        {error ? <p role="alert" className="text-body-medium font-body text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>{t("projects.management.cancel")}</Button>
          <Button type="button" variant={action === "delete" ? "destructive" : "default"} disabled={mutation.isPending || ((admin || profile?.role === "admin") && !/[\p{L}\p{N}]/u.test(reason))} onClick={async () => {
            try {
              await mutation.mutateAsync({ action, reason: reason.trim() });
              setOpen(false); toast.success(t("projects.management.success"));
              if (action === "delete") onDeleted?.();
            } catch { /* Keep the dialog open with the localized mutation error. */ }
          }}>{mutation.isPending ? t("projects.management.saving") : label(action)}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
