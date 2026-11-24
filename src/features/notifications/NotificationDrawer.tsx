import { useTranslation } from "react-i18next";
import { SideDrawer } from "@/components/ui/side-drawer";
import { NotificationInbox } from "./NotificationInbox";

export function NotificationDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("common");
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      size="30vw"
      title={t("header.notifications")}
      description={t("notifications.drawerSubtitle")}
      closeLabel={t("actions.close")}
    >
      <NotificationInbox drawer onNavigate={() => onOpenChange(false)} />
    </SideDrawer>
  );
}
