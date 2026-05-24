import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/useLocale";
import { useTranslation } from "react-i18next";

export function LanguageSettingsCard() {
  const { t: tCommon } = useTranslation("common");
  const { t } = useTranslation("account");
  const { language, setLanguage } = useLocale();

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">
          {t("settings.language.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("settings.language.description")}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void setLanguage("vi")}
          className={cn(
            "flex min-h-11 items-center justify-between rounded-md border px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            language === "vi"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border-subtle bg-surface-base hover:bg-surface-raised",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {tCommon("language.vi")}
            </div>
            <div className="mt-0.5 text-xs text-foreground-muted">
              {t("settings.language.viMeta")}
            </div>
          </div>
          {language === "vi" ? (
            <span className="text-xs font-medium text-primary">
              {t("settings.language.active_vi")}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => void setLanguage("en")}
          className={cn(
            "flex min-h-11 items-center justify-between rounded-md border px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            language === "en"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border-subtle bg-surface-base hover:bg-surface-raised",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {tCommon("language.en")}
            </div>
            <div className="mt-0.5 text-xs text-foreground-muted">
              {t("settings.language.enMeta")}
            </div>
          </div>
          {language === "en" ? (
            <span className="text-xs font-medium text-primary">
              {t("settings.language.active_en")}
            </span>
          ) : null}
        </button>
      </div>
    </section>
  );
}

