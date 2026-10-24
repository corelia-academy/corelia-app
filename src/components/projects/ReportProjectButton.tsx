import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  PROJECT_REPORT_NOTE_MAX,
  PROJECT_REPORT_REASONS,
  reportProject,
  type ProjectReportReason,
} from "@/lib/projectReports";
import { useAuth } from "@/stores/authStore";
import type { Project } from "@/types/projects";

export function ReportProjectButton({ project }: { project: Pick<Project, "id" | "owner_id" | "visibility" | "blocked"> }) {
  const { user } = useAuth();
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProjectReportReason>("spam");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => reportProject(project.id, reason, note),
    onSuccess: () => { setOpen(false); toast.success(t("projects.report.success")); },
  });
  if (!user || user.id === project.owner_id || project.blocked || project.visibility === "private") return null;
  const error = mutation.error
    ? t(mutation.error.message.includes("rate_limited") ? "projects.report.rateLimited" : "projects.report.failed")
    : null;
  return <>
    <Button type="button" size="small" variant="cta" hierarchy="tertiary" onClick={() => {
      setReason("spam"); setNote(""); mutation.reset(); setOpen(true);
    }}>{t("projects.report.action")}</Button>
    <Dialog open={open} onOpenChange={next => { if (!mutation.isPending) setOpen(next); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!mutation.isPending}>
        <DialogTitle>{t("projects.report.title")}</DialogTitle>
        <DialogDescription>{t("projects.report.description")}</DialogDescription>
        <label className="grid gap-2 text-label-medium font-body">{t("projects.report.reason")}
          <select className="min-h-11 rounded-md border border-border bg-surface-base px-3" value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value as ProjectReportReason)}>
            {PROJECT_REPORT_REASONS.map(value => <option key={value} value={value}>{t(`projects.report.reasons.${value}`)}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-label-medium font-body">{t("projects.report.note")}
          <textarea maxLength={PROJECT_REPORT_NOTE_MAX} rows={3} value={note} disabled={mutation.isPending} onChange={event => setNote(event.target.value)} className="rounded-md border border-border bg-surface-base p-3 text-body-medium font-body" />
          <span className="text-body-small font-body text-foreground-muted">{note.length} / {PROJECT_REPORT_NOTE_MAX}</span>
        </label>
        {error ? <p role="alert" className="text-body-medium font-body text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="cta" hierarchy="secondary" disabled={mutation.isPending} onClick={() => setOpen(false)}>{t("projects.management.cancel")}</Button>
          <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t("projects.management.saving") : t("projects.report.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
