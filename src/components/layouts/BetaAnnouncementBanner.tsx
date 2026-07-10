import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const BETA_BANNER_ENABLED = true;

export function BetaAnnouncementBanner() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");

  if (!BETA_BANNER_ENABLED) return null;

  return (
    <>
      <div
        role="status"
        className="flex min-h-5 w-full flex-wrap items-center justify-center gap-x-1 bg-primary-foreground px-2 py-0.5 text-center text-[9px] font-semibold leading-3 text-foreground sm:text-[10px]"
      >
        <span className="flex size-3 shrink-0 items-center justify-center rounded-sm bg-foreground/15">
          <Info className="size-2" aria-hidden />
        </span>

        <span className="sm:hidden">{t("betaAnnouncement.summaryCompact")}</span>
        <span className="hidden sm:inline">{t("betaAnnouncement.summary")}</span>

        <button
          type="button"
          aria-haspopup="dialog"
          className="shrink-0 cursor-pointer underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70"
          onClick={() => setOpen(true)}
        >
          {t("betaAnnouncement.seeMore")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("betaAnnouncement.modal.title")}</DialogTitle>
            <DialogDescription>
              {t("betaAnnouncement.modal.description")}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-foreground-muted">
            {t("betaAnnouncement.modal.details")}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("actions.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
