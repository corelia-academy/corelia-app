import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Info, Sparkles, Target } from "lucide-react";
import { NavLink } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CoraShell } from "@/components/course-ai/CoraShell";
import { getAssistantSurfaceMeta } from "@/components/course-ai/context";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/courses";

import type { FocusCard } from "../utils/homeTypes";

export function DashboardAiAssistantPanel({
  focusCards,
  courseCatalog,
}: {
  focusCards: FocusCard[];
  courseCatalog: Course[];
}) {
  const { t } = useTranslation("common");
  const surface = getAssistantSurfaceMeta("home");

  const activeCourse = focusCards[0] ?? null;
  const suggestedCourse = courseCatalog[0] ?? null;
  const rawSuggestions = t(surface.suggestionsKey, { returnObjects: true });
  const suggestions = Array.isArray(rawSuggestions) ? (rawSuggestions as string[]) : [];

  const handleSuggestionClick = () => {
    toast.message(String(t("coraWidget.chipToast")));
  };

  return (
    <CoraShell
      eyebrow={String(t("coraWidget.eyebrow"))}
      title={String(t("coraWidget.title"))}
      status={String(t("coraWidget.status"))}
      description={String(t(surface.descriptionKey))}
      className="rounded-lg shadow-none"
      body={
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-3">
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                <Target className="size-3.5" aria-hidden />
                {t("coraWidget.dashboard.learningContextLabel")}
              </div>
              {activeCourse ? (
                <div className="mt-2">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {activeCourse.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-foreground-muted">
                    <span>{t("home.sections.progress")}</span>
                    <span>{activeCourse.progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-base">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${activeCourse.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                    {activeCourse.nextStep}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                  {t("coraWidget.dashboard.noProgress")}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                <Sparkles className="size-3.5" aria-hidden />
                {t("coraWidget.dashboard.discoveryContextLabel")}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {suggestedCourse?.title || t("coraWidget.dashboard.discoveryFallbackTitle")}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                {suggestedCourse?.short_description ||
                  suggestedCourse?.description ||
                  t("coraWidget.dashboard.discoveryFallbackDescription")}
              </p>
            </div>
          </div>

          <div className="flex gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 text-[11px] leading-snug text-foreground-muted">
            <Info className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
            <p>{t("coraWidget.comingSoonHint")}</p>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
              {t("coraWidget.suggestionsLabel")}
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

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              render={<NavLink to={activeCourse?.action || "/courses"} />}
              nativeButton={false}
              className="w-full justify-between"
            >
              {activeCourse
                ? t("coraWidget.dashboard.continueLearningAction")
                : t(surface.action.label)}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              render={<NavLink to={surface.action.to} />}
              nativeButton={false}
              variant="outline"
              className="w-full justify-between"
            >
              {t("coraWidget.dashboard.secondaryAction")}
              <BookOpen className="size-4" />
            </Button>
          </div>
        </div>
      }
      footer={
        <>
          <textarea
            disabled
            rows={2}
            placeholder={String(t("coraWidget.inputPlaceholder"))}
            className={cn(
              "w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none",
              "placeholder:text-foreground-subtle",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-foreground-muted">
            {t("coraWidget.footerCaption")}
          </p>
        </>
      }
    />
  );
}
