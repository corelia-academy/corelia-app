import { useMutation } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { leaveProject } from "@/lib/projectCollaboration";

type ProjectSelfLeaveButtonProps = {
  projectId: string;
  onLeft?: () => void;
};

export function ProjectSelfLeaveButton({ projectId, onLeft }: ProjectSelfLeaveButtonProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => leaveProject(projectId),
    onSuccess: () => {
      setOpen(false);
      toast.success(t("projects.team.leftProject"));
      onLeft?.();
    },
    onError: () => toast.error(t("projects.team.leaveProjectFailed")),
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { mutation.reset(); setOpen(true); }}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
        {t(mutation.isPending ? "projects.team.leavingProject" : "projects.team.leaveProject")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) setOpen(next); }}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!mutation.isPending}>
          <DialogTitle>{t("projects.team.leaveProjectTitle")}</DialogTitle>
          <DialogDescription>{t("projects.team.leaveProjectConfirm")}</DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t(mutation.isPending ? "projects.team.leavingProject" : "projects.team.leaveProjectAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
