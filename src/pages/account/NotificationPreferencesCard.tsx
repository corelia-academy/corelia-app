import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

type Prefs = {
  email_course_blast: boolean;
  email_track_blast: boolean;
  in_app_course_blast: boolean;
  in_app_track_blast: boolean;
};

const DEFAULT_PREFS: Prefs = {
  email_course_blast: true,
  email_track_blast: true,
  in_app_course_blast: true,
  in_app_track_blast: true,
};

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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void supabase
      .from("notification_preferences")
      .select("email_course_blast, email_track_blast, in_app_course_blast, in_app_track_blast")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setPrefs({
            email_course_blast: data.email_course_blast ?? true,
            email_track_blast: data.email_track_blast ?? true,
            in_app_course_blast: data.in_app_course_blast ?? true,
            in_app_track_blast: data.in_app_track_blast ?? true,
          });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function save(next: Prefs) {
    if (!user?.id) return;
    setPrefs(next);
    setSaving(true);
    try {
      const { error } = await supabase.from("notification_preferences").upsert(
        { user_id: user.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      if (error) throw new Error(error.message);
      toast.success(t("settings.notifications.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi khi lưu tuỳ chọn");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    void save(next);
  }

  if (loading) return null;

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
          id="pref-email-course"
          checked={prefs.email_course_blast}
          onChange={() => !saving && toggle("email_course_blast")}
          label={t("settings.notifications.emailCourseBlast")}
        />
        <Toggle
          id="pref-email-track"
          checked={prefs.email_track_blast}
          onChange={() => !saving && toggle("email_track_blast")}
          label={t("settings.notifications.emailTrackBlast")}
        />
        <Toggle
          id="pref-inapp-course"
          checked={prefs.in_app_course_blast}
          onChange={() => !saving && toggle("in_app_course_blast")}
          label={t("settings.notifications.inAppCourseBlast")}
        />
        <Toggle
          id="pref-inapp-track"
          checked={prefs.in_app_track_blast}
          onChange={() => !saving && toggle("in_app_track_blast")}
          label={t("settings.notifications.inAppTrackBlast")}
        />
      </div>
    </section>
  );
}
