import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConversationHistory } from "@/components/course-ai/ConversationHistory";
import { CoraShell } from "@/components/course-ai/CoraShell";
import { QuotaExceededPrompt } from "@/components/course-ai/QuotaExceededPrompt";
import { SuggestionPills } from "@/components/course-ai/SuggestionPills";
import { buildPersonalizedSuggestions } from "@/components/course-ai/suggestions";
import { useCoraAI } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

export function CourseAiTutorPanel(props: {
  courseTitle: string;
  courseId?: string | null;
  lessonTitle?: string | null;
  lessonId?: string | null;
  className?: string;
  /** When set, header shows the dismiss control (e.g. sidebar close). */
  onRequestHide?: () => void;
}) {
  const { courseTitle, courseId, lessonTitle, lessonId, className, onRequestHide } = props;
  const { t } = useTranslation("courses");
  const { t: tCommon } = useTranslation("common");
  const [draft, setDraft] = useState("");
  const hasLessonContext = Boolean(lessonId?.trim());
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
    assistantContext: hasLessonContext ? "lesson" : "courses",
    lessonId,
    courseId,
    autoCreateSession: !hasLessonContext || Boolean(courseId),
  });

  const rawSuggestions = t("detail.aiTutor.suggestions", { returnObjects: true });
  const fallbackSuggestions = buildPersonalizedSuggestions({
    t: tCommon,
    context: hasLessonContext ? "lesson" : "courses",
    baseSuggestions: Array.isArray(rawSuggestions) ? (rawSuggestions as string[]) : [],
    learningMemory,
  });
  const suggestions = suggestedPrompts.length > 0 ? suggestedPrompts : fallbackSuggestions;

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
      eyebrow={String(t("detail.aiTutor.tabLabel"))}
      title={String(t("detail.aiTutor.sheetTitle"))}
      tagline={String(t("detail.aiTutor.sheetDescription"))}
      onRequestHide={onRequestHide}
      hideLabel={onRequestHide ? String(tCommon("coraWidget.hideAction")) : undefined}
      onClearHistory={messages.length > 0 && !isLoading && !hasLessonContext ? () => { void clearHistory(); } : undefined}
      clearHistoryLabel={String(tCommon("coraWidget.clearHistoryAction"))}
      className={cn("h-full rounded-md shadow-none", className)}
      body={
        messages.length > 0 ? (
          <ConversationHistory messages={messages} isStreaming={isStreaming} className="min-h-0 flex-1" />
        ) : (
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

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                {t("detail.aiTutor.suggestionsLabel")}
              </p>
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
            rows={2}
            value={draft}
            disabled={isLoading}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading) void handleSubmit();
              }
            }}
            placeholder={String(t("detail.aiTutor.inputPlaceholder"))}
            className={cn(
              "w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none",
              "placeholder:text-foreground-subtle",
            )}
          />
          {error?.type === "quota_exceeded" ? (
            <QuotaExceededPrompt
              title={String(tCommon("coraWidget.quotaExceededTitle"))}
              subtitle={String(tCommon("coraWidget.quotaExceededSubtitle"))}
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
          <p
            className={cn(
              "mt-1.5 text-[11px] leading-snug",
              error && error.type !== "quota_exceeded" ? "text-destructive" : "text-foreground-muted",
            )}
          >
            {error && error.type !== "quota_exceeded"
              ? error.message
              : t("detail.aiTutor.liveFooterCaption")}
          </p>
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={isLoading || !draft.trim()}
            >
              {isLoading ? tCommon("coraWidget.sendingAction") : tCommon("coraWidget.sendAction")}
              {!isLoading && <CornerDownLeft className="ml-1.5 size-3.5" aria-hidden />}
            </Button>
          </div>
        </>
      }
    />
  );
}
