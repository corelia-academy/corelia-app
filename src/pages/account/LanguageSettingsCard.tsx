import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/useLocale";
import { CONTENT_LOCALES, LOCALE_META } from "@/lib/locales";
import { useTranslation } from "react-i18next";

export function LanguageSettingsCard() {
  const { t } = useTranslation("account");
  const { language, setLanguage } = useLocale();

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div className="min-w-0">
        <h2 className="text-heading-medium font-display text-foreground">
          {t("settings.language.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("settings.language.description")}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {CONTENT_LOCALES.map((locale) => {
          const meta = LOCALE_META[locale];
          const active = language === locale;
          return (
            <button
              key={locale}
              type="button"
              onClick={() => void setLanguage(locale)}
              aria-pressed={active}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                active
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border-subtle bg-surface-base hover:bg-surface-raised",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="text-xl">{meta.flag}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground" lang={locale}>
                    {meta.endonym}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground-muted">
                    {t(`settings.language.meta.${locale}`)}
                  </div>
                </div>
              </div>
              {active ? (
                <span className="text-xs font-medium text-primary">
                  {t("settings.language.active")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
