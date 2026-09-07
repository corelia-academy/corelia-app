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
import type { SupportedLanguage } from "@/i18n";

export function LanguageSwitcher({ compact = true }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useLocale();

  const options: { value: SupportedLanguage; label: string }[] = [
    { value: "vi", label: t("language.vi") },
    { value: "en", label: t("language.en") },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size={compact ? "icon" : "default"} variant="ghost" className={compact ? undefined : "min-h-11 px-2"} aria-label={t("language.switchLabel")}>
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
            <span className="flex-1">{opt.label}</span>
            {language === opt.value ? (
              <span className="text-xs text-foreground-muted">✓</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

