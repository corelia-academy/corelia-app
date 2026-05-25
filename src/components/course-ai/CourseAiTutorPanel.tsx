import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useCoraStore } from "@/stores/coraStore";
import { CornerDownLeft, FileText, Paperclip, Video, X } from "lucide-react";

import { uploadCoraImageAttachment } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { ConversationHistory } from "@/components/course-ai/ConversationHistory";
import { CoraHistoryPopover } from "@/components/course-ai/CoraHistoryPopover";
import { CoraShell } from "@/components/course-ai/CoraShell";
import { QuotaExceededPrompt } from "@/components/course-ai/QuotaExceededPrompt";
import { SuggestionPills } from "@/components/course-ai/SuggestionPills";
import { buildPersonalizedSuggestions } from "@/components/course-ai/suggestions";
import { useCoraAI } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";
import type { LessonFormat } from "@/types/courses";

const FORMAT_ICON: Record<string, React.ElementType> = {
  video: Video,
  article: FileText,
};

export function CourseAiTutorPanel(props: {
  courseTitle: string;
  courseId?: string | null;
  lessonTitle?: string | null;
  lessonId?: string | null;
  lessonFormat?: LessonFormat | null;
  className?: string;
  hideShellHeader?: boolean;
  /** When set, header shows the dismiss control (e.g. sidebar close). */
  onRequestHide?: () => void;
}) {
  const {
    courseTitle,
    courseId,
    lessonTitle,
    lessonId,
    lessonFormat,
    className,
    hideShellHeader,
    onRequestHide,
  } = props;
  const { t } = useTranslation("courses");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasLessonContext = Boolean(lessonId?.trim());

  // Build/cleanup local preview URL
  useEffect(() => {
    if (!attachedFile) {
      setAttachmentPreview(null);
      return;
    }
    const url = URL.createObjectURL(attachedFile);
    setAttachmentPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachedFile]);
  const {
    messages,
    sendMessage,
    explainSelectedText,
    isLoading,
    isStreaming,
    error,
    quotaInfo,
    learningMemory,
    suggestedPrompts,
    lastSubmittedMessage,
    clearHistory,
    sessionId,
    newSession,
    switchSession,
    listSessionsForContext,
  } = useCoraAI({
    assistantContext: hasLessonContext ? "lesson" : "courses",
    lessonId,
    courseId,
    autoCreateSession: !hasLessonContext || Boolean(courseId),
  });

  const rawSuggestions = t("detail.aiTutor.suggestions", { returnObjects: true });
  const formatKey = lessonFormat && ["video", "article", "quiz", "practice"].includes(lessonFormat)
    ? `coraWidget.formatSuggestions.${lessonFormat}` as const
    : null;
  const formatSuggestions = formatKey
    ? (tCommon(formatKey, { returnObjects: true }) as string[] | string)
    : [];
  const formatList = Array.isArray(formatSuggestions) ? formatSuggestions : [];
  const baseSuggestions = formatList.length > 0
    ? formatList
    : Array.isArray(rawSuggestions) ? (rawSuggestions as string[]) : [];

  const fallbackSuggestions = buildPersonalizedSuggestions({
    t: tCommon,
    context: hasLessonContext ? "lesson" : "courses",
    baseSuggestions,
    learningMemory,
  });
  const suggestions = suggestedPrompts.length > 0 ? suggestedPrompts : fallbackSuggestions;

  const handleSuggestionClick = (label: string) => {
    void sendMessage(label);
  };

  const pendingExplainRequest = useCoraStore((s) => s.pendingExplainRequest);
  const clearExplainRequest = useCoraStore((s) => s.clearExplainRequest);
  const explainBubbleTemplate = tCommon("coraWidget.explainUserBubble", {
    snippet: "{{snippet}}",
    defaultValue: "Explain this passage: \"{{snippet}}\"",
  });
  useEffect(() => {
    if (!pendingExplainRequest) return;
    // Only consume the request when this panel matches the lesson the user was on.
    if (
      pendingExplainRequest.lessonId &&
      lessonId &&
      pendingExplainRequest.lessonId !== lessonId
    ) {
      return;
    }
    const text = pendingExplainRequest.text;
    clearExplainRequest();
    void explainSelectedText(text, explainBubbleTemplate);
  }, [
    pendingExplainRequest,
    lessonId,
    clearExplainRequest,
    explainSelectedText,
    explainBubbleTemplate,
  ]);

  const visionAllowed =
    quotaInfo?.tier === "pro" || quotaInfo?.tier === "bootcamp";

  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
  const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

  const handleFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error(String(tCommon("coraWidget.attachImageBadType")));
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(String(tCommon("coraWidget.attachImageTooLarge")));
      return;
    }
    setAttachedFile(file);
  };

  const handleAttachClick = () => {
    if (!visionAllowed) {
      toast.error(String(tCommon("coraWidget.attachImageTierLocked")));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text && !attachedFile) return;
    if (uploading) return;

    let uploadedAttachment:
      | { kind: "image"; url: string; path: string; mime: string }
      | null = null;

    if (attachedFile) {
      if (!user?.id) {
        toast.error(String(tCommon("coraWidget.attachImageTierLocked")));
        return;
      }
      setUploading(true);
      try {
        const { url, path } = await uploadCoraImageAttachment(user.id, attachedFile);
        uploadedAttachment = {
          kind: "image",
          url,
          path,
          mime: attachedFile.type,
        };
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Upload ảnh thất bại.",
        );
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    setDraft("");
    setAttachedFile(null);
    await sendMessage(text, {
      attachments: uploadedAttachment ? [uploadedAttachment] : undefined,
    });
  };

  const FormatIcon = lessonFormat ? FORMAT_ICON[lessonFormat] : null;
  const formatLabel = lessonFormat === "video"
    ? tCommon("coraWidget.lessonFormatVideo")
    : lessonFormat === "article"
      ? tCommon("coraWidget.lessonFormatArticle")
      : lessonFormat === "quiz"
        ? tCommon("coraWidget.lessonFormatQuiz")
        : lessonFormat === "practice"
          ? tCommon("coraWidget.lessonFormatPractice")
          : null;

  return (
    <CoraShell
      title={String(t("detail.aiTutor.sheetTitle"))}
      hideHeader={hideShellHeader}
      onRequestHide={onRequestHide}
      hideLabel={onRequestHide ? String(tCommon("coraWidget.hideAction")) : undefined}
      onClearHistory={messages.length > 0 && !isLoading && !hasLessonContext ? () => { void clearHistory(); } : undefined}
      clearHistoryLabel={String(tCommon("coraWidget.clearHistoryAction"))}
      onNewSession={Boolean(courseId) && !isLoading && messages.length > 0 ? () => { void newSession(); } : undefined}
      newSessionLabel={String(tCommon("coraWidget.newChatAction"))}
      historySlot={
        courseId ? (
          <CoraHistoryPopover
            loadSessions={listSessionsForContext}
            onSelect={switchSession}
            activeSessionId={sessionId}
            currentLessonId={lessonId ?? null}
          />
        ) : null
      }
      className={cn("h-full rounded-md shadow-none", className)}
      body={
        messages.length > 0 ? (
          <ConversationHistory messages={messages} isStreaming={isStreaming} className="min-h-0 flex-1" />
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
            {/* Context block */}
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-1.5">
                {tCommon("coraWidget.contextLabel")}
              </p>
              <p className="text-xs font-medium text-foreground leading-snug">
                {courseTitle.trim() || "—"}
              </p>
              {lessonTitle?.trim() ? (
                <p className="mt-0.5 text-xs text-foreground-muted leading-snug">{lessonTitle.trim()}</p>
              ) : null}
              {formatLabel ? (
                <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-foreground-subtle">
                  {FormatIcon ? <FormatIcon className="size-3" aria-hidden /> : null}
                  {formatLabel}
                </span>
              ) : null}
            </div>

            {/* Suggestions */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                {tCommon("coraWidget.suggestionsLabel")}
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
          {attachedFile && attachmentPreview ? (
            <div className="mb-2 inline-flex items-start gap-2 rounded-md border border-border-subtle bg-surface-raised p-2">
              <img
                src={attachmentPreview}
                alt={attachedFile.name}
                className="size-16 rounded object-cover"
              />
              <div className="flex flex-col text-[11px] leading-tight text-foreground-muted">
                <span className="truncate max-w-[140px] text-foreground">
                  {attachedFile.name}
                </span>
                <span>{Math.round(attachedFile.size / 1024)} KB</span>
                {uploading ? (
                  <span className="text-primary">
                    {tCommon("coraWidget.attachImageUploading")}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="ml-auto rounded p-1 text-foreground-muted hover:bg-surface-base"
                aria-label={String(tCommon("coraWidget.removeAttachment"))}
                disabled={uploading}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={handleFilePicked}
          />
          <textarea
            rows={2}
            value={draft}
            disabled={isLoading || uploading}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && !uploading) void handleSubmit();
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
          {error && error.type !== "quota_exceeded" ? (
            <p className="mt-1.5 text-[11px] leading-snug text-destructive">
              {error.message}
            </p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAttachClick}
              disabled={isLoading || uploading}
              title={String(
                visionAllowed
                  ? tCommon("coraWidget.attachImageLabel")
                  : tCommon("coraWidget.attachImageTierLocked"),
              )}
              aria-label={String(tCommon("coraWidget.attachImageLabel"))}
              className={cn(
                "h-8 px-2",
                !visionAllowed && "opacity-50",
              )}
            >
              <Paperclip className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={
                isLoading ||
                uploading ||
                (!draft.trim() && !attachedFile)
              }
            >
              {uploading
                ? tCommon("coraWidget.attachImageUploading")
                : isLoading
                  ? tCommon("coraWidget.sendingAction")
                  : tCommon("coraWidget.sendAction")}
              {!isLoading && !uploading && (
                <CornerDownLeft className="ml-1.5 size-3.5" aria-hidden />
              )}
            </Button>
          </div>
        </>
      }
    />
  );
}
