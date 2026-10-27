import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { notificationTarget } from "@/lib/notificationTarget";
import type { UserNotificationRow } from "@/lib/notifications";

const FIELD_LABEL_KEYS = {
  title: "projects.form.title",
  summary: "projects.form.summary",
  description: "projects.editor.description",
  progress: "projects.editor.progress",
} as const;

// Moderation reports fields as `summary` or `<locale>.summary`.
function fieldLabel(field: string, t: TFunction<"common">): string {
  const [locale, name] = field.includes(".") ? field.split(".", 2) : ["", field];
  const key = Object.hasOwn(FIELD_LABEL_KEYS, name ?? "") ? FIELD_LABEL_KEYS[name as keyof typeof FIELD_LABEL_KEYS] : null;
  const label = key ? t(key) : field;
  return locale ? `${label} (${locale.toUpperCase()})` : label;
}

/** Background moderation hid the owner's project; explain and link to it. */
export function ProjectAutoHiddenNotification({ notification: n, onOpen }: { notification: UserNotificationRow; onOpen: () => void }) {
  const { t } = useTranslation("common");
  const title = typeof n.payload.project_title === "string" && n.payload.project_title
    ? n.payload.project_title
    : t("notifications.projectFallback");
  const fields = Array.isArray(n.payload.fields)
    ? n.payload.fields.filter((field): field is string => typeof field === "string").map(field => fieldLabel(field, t))
    : [];
  return <>
    <div className="font-medium text-foreground">{t("notifications.projectAutoHiddenTitle")}</div>
    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{t("notifications.projectAutoHiddenBody", { title })}</p>
    {fields.length ? <p className="mt-1 text-xs text-foreground-muted">{t("notifications.projectAutoHiddenFields", { fields: fields.join(", ") })}</p> : null}
    <div className="mt-2">
      <Button
        type="button"
        variant="cta" hierarchy="tertiary"
        size="xsmall"
        className="h-auto px-0 py-0 text-xs font-medium underline-offset-4 hover:underline"
        render={<NavLink to={notificationTarget(n.payload)} />}
        nativeButton={false}
        onClick={onOpen}
      >
        {t("notifications.viewProject")}
      </Button>
    </div>
  </>;
}
