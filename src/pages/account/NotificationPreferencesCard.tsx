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
import { useAuth } from "@/stores/authStore";

function Toggle({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          checked ? "bg-primary" : "bg-border",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block size-5 rounded-full bg-primary-foreground shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

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

  function toggle(key: keyof NotificationPreferences) {
    const next = { ...prefs, [key]: !prefs[key] };
    saveMutation.mutate(next);
  }

  if (preferencesQuery.isPending) return null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t("settings.notifications.title")}
      </h2>
      <p className="mt-1 text-sm text-foreground-muted">
        {t("settings.notifications.description")}
      </p>

      <div className="mt-4 divide-y divide-border-subtle rounded-md border border-border-subtle px-4">
        <Toggle
          id="pref-email-learning"
          checked={prefs.email_learning_reminders}
          onChange={() => !saveMutation.isPending && toggle("email_learning_reminders")}
          label={t("settings.notifications.emailLearningReminders")}
          description={t("settings.notifications.emailLearningRemindersDesc")}
        />
        <Toggle
          id="pref-email-course"
          checked={prefs.email_course_blast}
          onChange={() => !saveMutation.isPending && toggle("email_course_blast")}
          label={t("settings.notifications.emailCourseBlast")}
        />
        <Toggle
          id="pref-email-track"
          checked={prefs.email_track_blast}
          onChange={() => !saveMutation.isPending && toggle("email_track_blast")}
          label={t("settings.notifications.emailTrackBlast")}
        />
        <Toggle
          id="pref-inapp-course"
          checked={prefs.in_app_course_blast}
          onChange={() => !saveMutation.isPending && toggle("in_app_course_blast")}
          label={t("settings.notifications.inAppCourseBlast")}
        />
        <Toggle
          id="pref-inapp-track"
          checked={prefs.in_app_track_blast}
          onChange={() => !saveMutation.isPending && toggle("in_app_track_blast")}
          label={t("settings.notifications.inAppTrackBlast")}
        />
      </div>
    </section>
  );
}
