import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/useLocale";
import { useTranslation } from "react-i18next";

export function LanguageSettingsCard() {
  const { t: tCommon } = useTranslation("common");
  const { t } = useTranslation("account");
  const { language, setLanguage } = useLocale();

  return (
    <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">
          {t("settings.language.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.language.description")}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void setLanguage("vi")}
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-3 text-left transition-colors duration-150",
            language === "vi"
              ? "border-primary bg-primary/10"
              : "border-border-subtle bg-background hover:bg-muted/30",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {tCommon("language.vi")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
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
            "flex items-center justify-between rounded-md border px-3 py-3 text-left transition-colors duration-150",
            language === "en"
              ? "border-primary bg-primary/10"
              : "border-border-subtle bg-background hover:bg-muted/30",
          )}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {tCommon("language.en")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
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

