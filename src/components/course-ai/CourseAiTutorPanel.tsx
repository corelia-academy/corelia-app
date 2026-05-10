import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export function CourseAiTutorPanel(props: {
  courseTitle: string;
  lessonTitle?: string | null;
  className?: string;
}) {
  const { courseTitle, lessonTitle, className } = props;
  const { t } = useTranslation("courses");

  const suggestions = useMemo(() => {
    const raw = t("detail.aiTutor.suggestions", { returnObjects: true });
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [t]);

  const handleSuggestionClick = () => {
    toast.message(String(t("detail.aiTutor.chipToast")));
  };

  return (
    <div
      className={cn(
        "flex max-h-[min(72vh,560px)] min-h-[280px] flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-base",
        className,
      )}
    >
      <div className="border-border-subtle shrink-0 border-b px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-foreground">{t("detail.aiTutor.sheetTitle")}</h2>
        <p className="mt-0.5 text-xs leading-snug text-foreground-muted">
          {t("detail.aiTutor.sheetDescription")}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="space-y-1 text-xs text-foreground-muted">
          <p className="font-medium text-foreground">
            {t("detail.aiTutor.contextCourse", {
              title: courseTitle.trim() || "—",
            })}
          </p>
          {lessonTitle?.trim() ? (
            <p>{t("detail.aiTutor.contextLesson", { title: lessonTitle.trim() })}</p>
          ) : null}
        </div>

        <div className="flex gap-2 rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-snug text-foreground-muted">
          <Info className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <p>{t("detail.aiTutor.comingSoonHint")}</p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            {t("detail.aiTutor.suggestionsLabel")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((label) => (
              <button
                key={label}
                type="button"
                className={cn(
                  "max-w-full rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-left text-[11px] leading-snug text-foreground-muted",
                  "transition-colors hover:border-border hover:bg-surface-overlay hover:text-foreground",
                )}
                onClick={handleSuggestionClick}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-border-subtle shrink-0 border-t bg-surface-float px-3 py-2.5 sm:px-4">
        <textarea
          disabled
          rows={2}
          placeholder={String(t("detail.aiTutor.inputPlaceholder"))}
          className={cn(
            "w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none",
            "placeholder:text-foreground-subtle",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <p className="mt-1.5 text-[11px] leading-snug text-foreground-muted">
          {t("detail.aiTutor.footerCaption")}
        </p>
      </div>
    </div>
  );
}
