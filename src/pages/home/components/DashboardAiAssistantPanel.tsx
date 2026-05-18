import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  Sparkles,
  Target,
} from "lucide-react";
import { NavLink } from "react-router";

import { Button } from "@/components/ui/button";
import { ConversationHistory } from "@/components/course-ai/ConversationHistory";
import { CoraLearningMemorySummary } from "@/components/course-ai/CoraLearningMemorySummary";
import { CoraMemoryDeltaCard } from "@/components/course-ai/CoraMemoryDeltaCard";
import { CoraRecommendedActions } from "@/components/course-ai/CoraRecommendedActions";
import { CoraRecommendedEntities } from "@/components/course-ai/CoraRecommendedEntities";
import { CoraShell } from "@/components/course-ai/CoraShell";
import { getAssistantSurfaceMeta } from "@/components/course-ai/context";
import { QuotaExceededPrompt } from "@/components/course-ai/QuotaExceededPrompt";
import { buildPersonalizedSuggestions } from "@/components/course-ai/suggestions";
import { getCoraStatusLabel } from "@/components/course-ai/status";
import { useCoraAI } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
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
  const { aiSubscription, daysUntilExpiry } = useAuth();
  const surface = getAssistantSurfaceMeta("home");
  const [draft, setDraft] = useState("");
  const {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    quotaInfo,
    learningMemory,
    suggestedPrompts,
    memoryDelta,
    recommendedActions,
    recommendedEntities,
    lastSubmittedMessage,
  } = useCoraAI({
    assistantContext: "home",
    autoCreateSession: true,
  });

  const activeCourse = focusCards[0] ?? null;
  const suggestedCourse = courseCatalog[0] ?? null;
  const rawSuggestions = t(surface.suggestionsKey, { returnObjects: true });
  const fallbackSuggestions = buildPersonalizedSuggestions({
    t,
    context: "home",
    baseSuggestions: Array.isArray(rawSuggestions)
      ? (rawSuggestions as string[])
      : [],
    learningMemory,
  });
  const suggestions =
    suggestedPrompts.length > 0 ? suggestedPrompts : fallbackSuggestions;

  const handleSuggestionClick = (label: string) => {
    void sendMessage(label);
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendMessage(text);
  };

  return (
    <CoraShell
      eyebrow={String(t("coraWidget.eyebrow"))}
      title={String(t("coraWidget.title"))}
      status={getCoraStatusLabel({
        t,
        quotaInfo,
        aiSubscription,
        daysUntilExpiry,
      })}
      description={String(t(surface.descriptionKey))}
      meta={
        <div className="space-y-3">
          <CoraRecommendedEntities entities={recommendedEntities} />
          <CoraRecommendedActions actions={recommendedActions} />
          <CoraMemoryDeltaCard delta={memoryDelta} />
          <CoraLearningMemorySummary memory={learningMemory} />
        </div>
      }
      className="max-h-[calc(100vh-5rem)] rounded-lg shadow-none"
      body={
        messages.length > 0 ? (
          <ConversationHistory
            messages={messages}
            isStreaming={isStreaming}
            className="min-h-0 flex-1"
          />
        ) : (
          <div className="space-y-4 px-4 py-4">
            {activeCourse ? (
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                  <Target className="size-3.5" aria-hidden />
                  {t("coraWidget.dashboard.learningContextLabel")}
                </div>
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
                  {activeCourse.nextStep ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                      {activeCourse.nextStep}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {suggestedCourse?.short_description ||
            suggestedCourse?.description ? (
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                  <Sparkles className="size-3.5" aria-hidden />
                  {t("coraWidget.dashboard.discoveryContextLabel")}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {suggestedCourse.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                  {suggestedCourse.short_description ||
                    suggestedCourse.description}
                </p>
              </div>
            ) : null}

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
                    onClick={() => handleSuggestionClick(label)}
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
        )
      }
      footer={
        <>
          <textarea
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={String(t("coraWidget.inputPlaceholder"))}
            className={cn(
              "w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none",
              "placeholder:text-foreground-subtle",
            )}
          />
          {error?.type === "quota_exceeded" ? (
            <QuotaExceededPrompt
              title={String(t("coraWidget.quotaExceededTitle"))}
              description={String(
                t("coraWidget.quotaExceededDescription", {
                  used: error.used ?? quotaInfo?.monthlyUsed ?? 0,
                  limit: error.limit ?? quotaInfo?.monthlyLimit ?? 0,
                  tier: error.tier ?? quotaInfo?.tier ?? "free",
                }),
              )}
              ctaLabel={String(t("coraWidget.quotaExceededCta"))}
              ctaTo="/cora"
              retryLabel={String(t("coraWidget.retryAction"))}
              onRetry={
                lastSubmittedMessage
                  ? () => {
                      void sendMessage(lastSubmittedMessage);
                    }
                  : undefined
              }
              className="mt-2"
            />
          ) : null}
          {error ? (
            <p className="mt-2 text-[11px] leading-snug text-destructive">
              {error.type === "quota_exceeded"
                ? t("coraWidget.quotaExceededHint")
                : error.message}
            </p>
          ) : quotaInfo?.throttled ? (
            <p className="mt-2 rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-snug text-foreground-muted">
              {t("coraWidget.throttleHint")}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={isLoading || !draft.trim()}
            >
              {isLoading
                ? t("coraWidget.sendingAction")
                : t("coraWidget.sendAction")}
              {!isLoading && (
                <CornerDownLeft className="ml-1.5 size-3.5" aria-hidden />
              )}
            </Button>
          </div>
        </>
      }
    />
  );
}
