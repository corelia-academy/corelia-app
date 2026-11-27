import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/useLocale";
import type { SupportedLanguage } from "@/i18n";
import { CONTENT_LOCALES, LOCALE_META } from "@/lib/locales";
import { SettingsRow } from "./SettingsLayout";

export function LanguageSettingsCard() {
  const { t } = useTranslation("account");
  const { language, setLanguage } = useLocale();

  return (
    <SettingsRow
      title={t("settings.language.title")}
      description={t("settings.language.description")}
      action={
        <div className="w-[200px]">
          <DropdownMenu>
            <DropdownMenuTriggerWithIndicator
              indicatorClassName="[&_svg]:size-5 [&_svg]:text-foreground"
              type="button"
              aria-label={`${t("settings.language.title")}: ${LOCALE_META[language].endonym}`}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground"
            >
              <span aria-hidden="true">{LOCALE_META[language].flag}</span>
              <span className="min-w-0 flex-1 truncate">{LOCALE_META[language].endonym}</span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent layout="multiple-list" align="end" className="w-max min-w-(--anchor-width) max-w-(--available-width)">
              <DropdownMenuList>
                <DropdownMenuRadioGroup value={language} onValueChange={(next) => void setLanguage(next as SupportedLanguage)}>
                  {CONTENT_LOCALES.map((locale) => (
                    <DropdownMenuRadioItem key={locale} size="large" value={locale}>
                      <DropdownMenuItemContent
                        leading={<span aria-hidden="true">{LOCALE_META[locale].flag}</span>}
                        supportingText={t(`settings.language.meta.${locale}`)}
                      >
                        {LOCALE_META[locale].endonym}
                      </DropdownMenuItemContent>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuList>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );
}
