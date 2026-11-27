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
import flagCn from "flag-icons/flags/4x3/cn.svg";
import flagEs from "flag-icons/flags/4x3/es.svg";
import flagGb from "flag-icons/flags/4x3/gb.svg";
import flagJp from "flag-icons/flags/4x3/jp.svg";
import flagKr from "flag-icons/flags/4x3/kr.svg";
import flagTw from "flag-icons/flags/4x3/tw.svg";
import flagVn from "flag-icons/flags/4x3/vn.svg";
import { CONTENT_LOCALES, type ContentLocale } from "@/lib/locales";
import { SettingsRow } from "./SettingsLayout";

// Dùng ảnh vì emoji cờ có máy chỉ hiện hai chữ cái. Tiếng Anh dùng cờ Anh theo Figma
const FLAG_SRC: Record<ContentLocale, string> = {
  en: flagGb, "zh-CN": flagCn, ko: flagKr, es: flagEs, "zh-TW": flagTw, vi: flagVn, ja: flagJp,
};

export function LanguageSettingsCard() {
  const { t } = useTranslation("account");
  const { language, setLanguage } = useLocale();

  return (
    <SettingsRow
      title={t("settings.language.title")}
      description={t("settings.language.description")}
      action={
        <div className="w-max min-w-[200px] max-w-full">
          <DropdownMenu>
            <DropdownMenuTriggerWithIndicator
              indicatorClassName="[&_svg]:size-5 [&_svg]:text-foreground"
              type="button"
              aria-label={`${t("settings.language.title")}: ${t(`settings.language.meta.${language}`)}`}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground"
            >
              <img src={FLAG_SRC[language]} alt="" className="h-[15px] w-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t(`settings.language.meta.${language}`)}</span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent layout="multiple-list" align="end" className="w-max min-w-(--anchor-width) max-w-(--available-width)">
              <DropdownMenuList className="max-h-none">
                <DropdownMenuRadioGroup value={language} onValueChange={(next) => void setLanguage(next as SupportedLanguage)}>
                  {CONTENT_LOCALES.map((locale) => (
                    <DropdownMenuRadioItem
                      key={locale}
                      size="large"
                      value={locale}
                      className="[&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
                    >
                      <DropdownMenuItemContent leading={<img src={FLAG_SRC[locale]} alt="" className="h-[18px] w-6" />}>
                        {t(`settings.language.meta.${locale}`)}
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
