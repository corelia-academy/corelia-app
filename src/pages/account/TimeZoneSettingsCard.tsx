import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useTimeZone } from "@/hooks/useTimeZone";
import { intlLocale } from "@/lib/intl";
import { AUTO_TIMEZONE, detectTimeZone, listTimeZones, timeZoneOffsetLabel } from "@/lib/timezone";

function zoneLabel(timeZone: string) {
  const offset = timeZoneOffsetLabel(timeZone);
  const name = timeZone.replaceAll("_", " ");
  return offset ? `(${offset}) ${name}` : name;
}

export function TimeZoneSettingsCard() {
  const { t } = useTranslation("account");
  const { preference, timeZone, setPreference } = useTimeZone();
  const detected = detectTimeZone();
  const zones = useMemo(() => listTimeZones().map((zone) => ({ zone, label: zoneLabel(zone) })), []);
  const now = new Intl.DateTimeFormat(intlLocale(), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date());

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div className="min-w-0">
        <h2 className="text-heading-medium font-display text-foreground">
          {t("settings.timezone.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("settings.timezone.description")}
        </p>
      </div>

      <label htmlFor="settings-timezone" className="mt-4 block text-xs font-medium text-foreground-muted">
        {t("settings.timezone.label")}
      </label>
      <select
        id="settings-timezone"
        value={preference}
        onChange={(event) => {
          setPreference(event.target.value).catch((error) => {
            console.error("[TimeZoneSettingsCard] failed to persist timezone:", error);
            toast.error(t("settings.timezone.saveFailed"));
          });
        }}
        className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface-base px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <option value={AUTO_TIMEZONE}>{t("settings.timezone.auto", { timezone: zoneLabel(detected) })}</option>
        {zones.map(({ zone, label }) => (
          <option key={zone} value={zone}>{label}</option>
        ))}
      </select>
      <p className="mt-2 text-xs text-foreground-muted">
        {t("settings.timezone.current", { time: now })}
      </p>
    </section>
  );
}
