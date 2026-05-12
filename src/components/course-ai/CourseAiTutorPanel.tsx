import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

import { ConversationHistory } from "@/components/course-ai/ConversationHistory";
import { CoraShell } from "@/components/course-ai/CoraShell";
import { QuotaExceededPrompt } from "@/components/course-ai/QuotaExceededPrompt";
import { useCoraAI } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

export function CourseAiTutorPanel(props: {
  courseTitle: string;
  lessonTitle?: string | null;
  lessonId?: string | null;
  className?: string;
}) {
  const { courseTitle, lessonTitle, lessonId, className } = props;
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
    lastSubmittedMessage,
  } = useCoraAI({
    assistantContext: hasLessonContext ? "lesson" : "courses",
    lessonId,
    autoCreateSession: !hasLessonContext,
  });

  const rawSuggestions = t("detail.aiTutor.suggestions", { returnObjects: true });
  const suggestions = Array.isArray(rawSuggestions) ? (rawSuggestions as string[]) : [];

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
      status={String(t("coraWidget.status", { ns: "common" }))}
      description={String(t("detail.aiTutor.sheetDescription"))}
      className={cn("max-h-[min(72vh,560px)] rounded-md shadow-none", className)}
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

            <div className="flex gap-2 rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2 text-[11px] leading-snug text-foreground-muted">
              <Info className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
              <p>{t("detail.aiTutor.liveHint")}</p>
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
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={String(t("detail.aiTutor.inputPlaceholder"))}
            className={cn(
              "w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none",
              "placeholder:text-foreground-subtle",
            )}
          />
          {error?.type === "quota_exceeded" ? (
            <QuotaExceededPrompt
              title={String(tCommon("coraWidget.quotaExceededTitle"))}
              description={String(
                tCommon("coraWidget.quotaExceededDescription", {
                  used: error.used ?? quotaInfo?.monthlyUsed ?? 0,
                  limit: error.limit ?? quotaInfo?.monthlyLimit ?? 0,
                  tier: error.tier ?? quotaInfo?.tier ?? "free",
                }),
              )}
              ctaLabel={String(tCommon("coraWidget.quotaExceededCta"))}
              ctaTo="/account/cora"
              retryLabel={String(tCommon("coraWidget.retryAction"))}
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
          <p
            className={cn(
              "mt-1.5 text-[11px] leading-snug",
              error ? "text-destructive" : "text-foreground-muted",
            )}
          >
            {error?.type === "quota_exceeded"
              ? tCommon("coraWidget.quotaExceededHint")
              : error
              ? error.message
              : quotaInfo?.throttled
                ? t("detail.aiTutor.throttleHint")
                : t("detail.aiTutor.liveFooterCaption")}
          </p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              onClick={() => void handleSubmit()}
              disabled={isLoading || !draft.trim()}
            >
              {isLoading ? tCommon("coraWidget.sendingAction") : tCommon("coraWidget.sendAction")}
            </button>
          </div>
        </>
      }
    />
  );
}
