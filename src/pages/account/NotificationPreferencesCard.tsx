import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  accountKeys,
  notificationPreferencesQueryOptions,
} from "@/features/account/accountQueries";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";
import { resolvedTimeZone } from "@/lib/timezone";
import { useAuth } from "@/stores/authStore";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Toggle } from "@/components/ui/toggle";
import { SettingsRow, SettingsSection } from "./SettingsLayout";

export function NotificationPreferencesCard() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery(notificationPreferencesQueryOptions(user?.id));
  const prefs = preferencesQuery.data ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const saveMutation = useMutation({
    mutationFn: (next: NotificationPreferences) =>
      saveNotificationPreferences(user!.id, next),
    onMutate: async (next) => {
      if (!user?.id) return undefined;
      const key = accountKeys.notificationPreferences(user.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationPreferences>(key);
      queryClient.setQueryData(key, next);
      return { key, previous };
    },
    onError: (error, _next, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      toast.error(error instanceof Error ? error.message : "Lỗi khi lưu tuỳ chọn");
    },
    onSuccess: () => toast.success(t("settings.notifications.saved")),
  });

  function toggle(key: Exclude<keyof NotificationPreferences, "digest_timezone">) {
    const next = { ...prefs, [key]: !prefs[key] };
    if (key === "email_social_digest" && next.email_social_digest) {
      next.digest_timezone = resolvedTimeZone();
    }
    saveMutation.mutate(next);
  }

  if (preferencesQuery.isPending) return null;

  const rows: { key: Exclude<keyof NotificationPreferences, "digest_timezone">; label: string; description?: string }[] = [
    { key: "in_app_likes", label: t("settings.notifications.likes") },
    { key: "in_app_follows", label: t("settings.notifications.follows") },
    { key: "email_social_digest", label: t("settings.notifications.digest"), description: t("settings.notifications.digestDescription", { timezone: prefs.digest_timezone }) },
    { key: "email_learning_reminders", label: t("settings.notifications.emailLearningReminders"), description: t("settings.notifications.emailLearningRemindersDesc") },
    { key: "email_course_blast", label: t("settings.notifications.emailCourseBlast") },
    { key: "in_app_course_blast", label: t("settings.notifications.inAppCourseBlast") },
  ];

  return (
    <SettingsSection title={t("settings.notifications.title")}>
      <p className="text-body-medium text-foreground-subtle">{t("settings.notifications.description")}</p>

      {/* Never present defaults as the user's saved settings when they failed to load. */}
      {preferencesQuery.isError && !preferencesQuery.data ? (
        <QueryErrorState
          message={t("settings.notifications.loadFailed")}
          retrying={preferencesQuery.isFetching}
          onRetry={() => void preferencesQuery.refetch()}
        />
      ) : (
        rows.map(({ key, label, description }) => (
          <SettingsRow
            key={key}
            title={label}
            description={description}
            action={<Toggle aria-label={label} checked={prefs[key]} onCheckedChange={() => { if (!saveMutation.isPending) toggle(key); }} />}
          />
        ))
      )}
    </SettingsSection>
  );
}
