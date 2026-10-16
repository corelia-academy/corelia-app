import { useTranslation } from "react-i18next";
import { NotificationInbox } from "@/features/notifications/NotificationInbox";

export default function NotificationsPage() {
  const { t } = useTranslation("common");
  return <div className="container-app py-6 sm:py-8"><div className="mx-auto max-w-2xl">
    <h1 className="font-display text-display-small">{t("header.notifications")}</h1>
    <NotificationInbox />
  </div></div>;
}
