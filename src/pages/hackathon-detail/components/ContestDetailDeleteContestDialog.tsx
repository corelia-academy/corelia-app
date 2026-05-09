import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contest } from "@/types/hackathons";

export function ContestDetailDeleteContestDialog({
  translate,
  contest,
  deleteDialogOpen,
  setDeleteDialogOpen,
  deleteConfirmText,
  setDeleteConfirmText,
  deletingContest,
  handleDeleteContest,
}: {
  translate: (key: string, options?: Record<string, unknown>) => string;
  contest: Contest | null;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (text: string) => void;
  deletingContest: boolean;
  handleDeleteContest: () => Promise<void>;
}) {
  return (
    <Dialog
      open={deleteDialogOpen}
      onOpenChange={(open) => {
        if (!deletingContest) {
          setDeleteDialogOpen(open);
          if (open) setDeleteConfirmText("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate("workspace.manage.deleteDialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground-muted">
          {contest?.title
            ? translate("workspace.manage.deleteDialogBodyWithTitle", {
                title: contest.title,
              })
            : translate("detail.dialogs.delete.descriptionManager")}
        </p>
        {contest?.title ? (
          <div className="mt-3 space-y-2">
            <div className="text-sm font-medium text-foreground">
              {translate("workspace.manage.deleteTypeToConfirm", {
                title: contest.title,
              })}
            </div>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              placeholder={contest.title}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deletingContest}
          >
            {translate("workspace.manage.deleteDialogCancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDeleteContest()}
            disabled={
              !contest ||
              deletingContest ||
              deleteConfirmText.trim() !== (contest?.title ?? "")
            }
          >
            {deletingContest ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {translate("workspace.manage.deleteDialogDeleting")}
              </>
            ) : (
              <>
                <Trash2 className="size-4" aria-hidden />
                {translate("workspace.manage.deleteContestConfirm")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
