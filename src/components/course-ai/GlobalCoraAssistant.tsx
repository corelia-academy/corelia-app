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
import { QuotaExceededPrompt } from "@/components/course-ai/QuotaExceededPrompt";
import { SuggestionPills } from "@/components/course-ai/SuggestionPills";
import { buildPersonalizedSuggestions } from "@/components/course-ai/suggestions";
import { useCoraAI } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

import { useAuth } from "@/stores/authStore";

import { CoraShell } from "./CoraShell";
import { getAssistantSurfaceMeta, resolveAssistantContext } from "./context";
import { shouldShowGlobalCoraAssistant } from "./visibility";

export function CoraAssistantCard({
  pathname,
  compact,
  onRequestHide,
  shellClassName,
}: {
  pathname: string;
  compact?: boolean;
  onRequestHide?: () => void;
  shellClassName?: string;
}) {
  const { t } = useTranslation("common");
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
    lastSubmittedMessage,
    clearHistory,
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
      tagline={String(t(surface.descriptionKey))}
      onRequestHide={onRequestHide}
      hideLabel={String(t("coraWidget.hideAction"))}
      onClearHistory={messages.length > 0 && !isLoading ? () => { void clearHistory(); } : undefined}
      clearHistoryLabel={String(t("coraWidget.clearHistoryAction"))}
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
              <SuggestionPills suggestions={suggestions} onSelect={handleSuggestionClick} />
            </div>
          </div>
        )
      }
      footer={
        <>
          {messages.length > 0 && suggestedPrompts.length > 0 ? (
            <div className="mb-2.5 border-b border-border-subtle pb-2.5">
              <SuggestionPills suggestions={suggestedPrompts} onSelect={handleSuggestionClick} />
            </div>
          ) : null}
          <textarea
            rows={compact ? 2 : 3}
            value={draft}
            disabled={isLoading}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading) void handleSubmit();
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
              subtitle={String(t("coraWidget.quotaExceededSubtitle"))}
              currentTier={error.tier ?? quotaInfo?.tier}
              resetDate={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)}
              onRetry={
                lastSubmittedMessage
                  ? () => { void sendMessage(lastSubmittedMessage); }
                  : undefined
              }
              className="mt-2"
            />
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-[11px] leading-snug",
                error && error.type !== "quota_exceeded" ? "text-destructive" : "text-foreground-muted",
              )}
            >
              {error && error.type !== "quota_exceeded" ? error.message : null}
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
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user || !shouldShowGlobalCoraAssistant(location.pathname)) {
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
          showCloseButton={false}
          className="h-[80dvh] max-h-[80dvh] min-h-[80dvh] max-w-none flex flex-col p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("coraWidget.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CoraAssistantCard
              pathname={location.pathname}
              onRequestHide={() => setMobileOpen(false)}
              shellClassName="flex h-full min-h-0 flex-1 flex-col rounded-none border-0 shadow-none"
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
