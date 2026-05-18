import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, NavLink } from "react-router";
import {
  ArrowUpRight,
  CornerDownLeft,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConversationHistory } from "@/components/course-ai/ConversationHistory";
import { CoraLearningMemorySummary } from "@/components/course-ai/CoraLearningMemorySummary";
import { CoraMemoryDeltaCard } from "@/components/course-ai/CoraMemoryDeltaCard";
import { QuotaExceededPrompt } from "@/components/course-ai/QuotaExceededPrompt";
import { CoraRecommendedActions } from "@/components/course-ai/CoraRecommendedActions";
import { CoraRecommendedEntities } from "@/components/course-ai/CoraRecommendedEntities";
import { buildPersonalizedSuggestions } from "@/components/course-ai/suggestions";
import { useCoraAI } from "@/hooks/useCoraAI";
import { useAuth } from "@/stores/authStore";
import { cn } from "@/lib/utils";

import { CoraShell } from "./CoraShell";
import { getCoraStatusLabel } from "./status";
import { getAssistantSurfaceMeta, resolveAssistantContext } from "./context";
import { shouldShowGlobalCoraAssistant } from "./visibility";

export function CoraAssistantCard({
  pathname,
  isAuthenticated,
  compact,
  onRequestHide,
  shellClassName,
}: {
  pathname: string;
  isAuthenticated: boolean;
  compact?: boolean;
  onRequestHide?: () => void;
  shellClassName?: string;
}) {
  const { t } = useTranslation("common");
  const { aiSubscription, daysUntilExpiry } = useAuth();
  const context = resolveAssistantContext(pathname);
  const surface = getAssistantSurfaceMeta(context);
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
    assistantContext: context,
    autoCreateSession: true,
  });

  const rawSuggestions = t(surface.suggestionsKey, { returnObjects: true });
  const fallbackSuggestions = buildPersonalizedSuggestions({
    t,
    context,
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
      description={String(t("coraWidget.description"))}
      meta={
        <div className="space-y-3">
          <CoraRecommendedEntities entities={recommendedEntities} />
          <CoraRecommendedActions actions={recommendedActions} />
          <CoraMemoryDeltaCard delta={memoryDelta} />
          <CoraLearningMemorySummary memory={learningMemory} />
        </div>
      }
      onRequestHide={onRequestHide}
      hideLabel={String(t("coraWidget.hideAction"))}
      className={shellClassName ?? "max-h-[min(78vh,640px)]"}
      body={
        messages.length > 0 ? (
          <ConversationHistory
            messages={messages}
            isStreaming={isStreaming}
            className="min-h-0 flex-1"
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                <Sparkles className="size-3.5" aria-hidden />
                {t("coraWidget.suggestionsLabel")}
              </div>
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
          </div>
        )
      }
      footer={
        <>
          <textarea
            rows={compact ? 2 : 3}
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
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-[11px] leading-snug",
                error ? "text-destructive" : "text-foreground-muted",
              )}
            >
              {error?.type === "quota_exceeded"
                ? t("coraWidget.quotaExceededHint")
                : error
                  ? error.message
                  : quotaInfo?.throttled
                    ? t("coraWidget.throttleHint")
                    : null}
            </p>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => void handleSubmit()}
              disabled={isLoading || !draft.trim()}
            >
              {isLoading ? t("coraWidget.sendingAction") : t("coraWidget.sendAction")}
              {!isLoading && <CornerDownLeft className="ml-1.5 size-3.5" aria-hidden />}
            </Button>
          </div>
          {messages.length === 0 ? (
            <div className="mt-2 flex justify-end">
              <Button
                render={<NavLink to={surface.action.to} />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="shrink-0"
              >
                {t(surface.action.label)}
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </>
      }
    />
  );
}

export function GlobalCoraAssistant() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation("common");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!shouldShowGlobalCoraAssistant(location.pathname)) {
    return null;
  }

  return (
    <>
      <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 xl:hidden">
        <Button
          type="button"
          onClick={() => setMobileOpen(true)}
          size="lg"
          className="h-12 rounded-full px-4 shadow-[var(--elevation-3)]"
        >
          <MessageSquareText className="size-4" />
          {t("coraWidget.openAction")}
        </Button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="bottom"
          className="h-[min(82vh,720px)] max-w-none p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("coraWidget.title")}</SheetTitle>
          </SheetHeader>
          <CoraAssistantCard
            pathname={location.pathname}
            isAuthenticated={isAuthenticated}
            onRequestHide={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
