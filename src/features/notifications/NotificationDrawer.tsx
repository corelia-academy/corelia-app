import { X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NotificationInbox } from "./NotificationInbox";

export function NotificationDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("common");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="h-dvh min-h-0 w-[min(30rem,100vw)]! max-w-none! bg-background p-0 data-[side=right]:border-stroke-divider">
        <SheetHeader className="shrink-0 gap-sm p-3xl pr-14">
          <SheetTitle className="font-display text-heading-medium leading-[1.2] text-action-text">{t("header.notifications")}</SheetTitle>
          <SheetDescription className="text-body-medium leading-[1.4] tracking-[0.02em] text-foreground-subtle">{t("notifications.drawerSubtitle")}</SheetDescription>
        </SheetHeader>
        <SheetClose className="absolute top-6 right-6 inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-foreground transition-colors after:absolute after:-inset-3 hover:text-foreground-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <X className="size-5" aria-hidden />
          <span className="sr-only">{t("actions.close")}</span>
        </SheetClose>
        <div className="scrollbar-design min-h-0 flex-1 overflow-y-auto px-3xl pb-3xl pt-5">
          <NotificationInbox drawer onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
