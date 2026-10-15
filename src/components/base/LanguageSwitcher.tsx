import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/useLocale";
import { useTranslation } from "react-i18next";
import { CONTENT_LOCALES, LOCALE_META } from "@/lib/locales";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact = true, className }: { compact?: boolean; className?: string }) {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useLocale();

  const options = CONTENT_LOCALES.map((value) => ({
    value,
    label: LOCALE_META[value].endonym,
    flag: LOCALE_META[value].flag,
  }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="small" variant="cta" hierarchy="tertiary" iconOnly={compact} className={cn(compact ? undefined : "min-h-11 px-2", className)} aria-label={t("language.switchLabel")}>
            <Globe className="size-4" />
            {!compact ? <span className="text-xs font-semibold uppercase">{language}</span> : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => void setLanguage(opt.value)}
          >
            <span aria-hidden="true">{opt.flag}</span>
            <span className="flex-1" lang={opt.value}>{opt.label}</span>
            {language === opt.value ? (
              <span className="text-xs text-foreground-muted">✓</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
