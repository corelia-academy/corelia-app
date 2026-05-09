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

export function LanguageSwitcher() {
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
          <Button size="icon" variant="ghost" aria-label="Language">
            <Globe className="size-4" />
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

