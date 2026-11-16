import { useTranslation } from "react-i18next";
import type { UserNotificationRow } from "@/lib/notifications";

/** Background moderation hid the owner's project; the row itself links to it. */
export function ProjectAutoHiddenNotification({ notification: n }: { notification: UserNotificationRow }) {
  const { t } = useTranslation("common");
  const title = typeof n.payload.project_title === "string" && n.payload.project_title
    ? n.payload.project_title
    : t("notifications.projectFallback");
  return <>
    <div className="font-medium text-foreground">{t("notifications.projectAutoHiddenTitle")}</div>
    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("notifications.projectAutoHiddenBody", { title })}</p>
  </>;
}
