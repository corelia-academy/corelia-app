import { useCallback, useEffect, useMemo, useState } from "react";

import {
  mapAssistantContextToBackendContext,
  type AssistantContext,
  type BackendAssistantContext,
} from "@/components/course-ai/context";
import { invokeCoraAi } from "@/lib/coraAi";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";
import { useCoraStore } from "@/stores/coraStore";

export type CoraMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  cached?: boolean;
  sources?: CoraSourceRef[];
};

export type CoraSourceRef = {
  topic?: string | null;
  subtopic?: string | null;
  category?: string | null;
  track?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  locale?: "vi" | "en" | null;
  label?: string | null;
  href?: string | null;
};

export type CoraQuotaInfo = {
  allowed: boolean;
  throttled: boolean;
  haikuOnly: boolean;
  monthlyUsed: number;
  monthlyLimit: number | null;
  windowUsed: number;
  windowSoftCap: number | null;
  windowHours: number;
  tier: "free" | "student" | "pro" | "bootcamp";
  quotaUnit: "message" | "token" | "both";
  monthlyTokensUsed: number;
  monthlyTokensLimit: number | null;
  rollingTokensUsed: number;
  rollingTokensCap: number | null;
};

export type CoraLearningMemory = {
  weakTopics: string[];
  strongTopics: string[];
  learningStyle: string | null;
  summary: string | null;
  totalQuestions: number;
};

export type CoraMemoryDelta = {
  newWeakTopic: string | null;
  newStrongTopic: string | null;
  learningStyle: string | null;
  summary: string | null;
  totalQuestions: number;
};

export type CoraRecommendedAction = {
  label: string;
  to: string;
  reason: string;
};

export type CoraRecommendedEntity = {
  kind: "course" | "career" | "hackathon";
  title: string;
  to: string;
  reason: string;
  subtitle?: string | null;
  badge?: string | null;
};

export type CoraError =
  | { type: "auth"; message: string }
  | { type: "quota_exceeded"; message: string; used?: number; limit?: number | null; tier?: string }
  | { type: "generic"; message: string };

export type CoraSessionSummary = {
  id: string;
  title: string | null;
  lastMessageAt: string;
  messageCount: number;
  lessonId: string | null;
  lessonTitle: string | null;
};

type UseCoraAIOptions = {
  assistantContext: AssistantContext | "lesson";
  lessonId?: string | null;
  courseId?: string | null;
  autoCreateSession?: boolean;
};

type ConversationRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  session_id?: string | null;
  cached?: boolean | null;
  sources?: CoraSourceRef[] | null;
};

type SendMessageResponse = {
  message?: string;
  used?: number;
  limit?: number | null;
  tier?: string;
  quota?: CoraQuotaInfo;
  sessionId?: string | null;
  cached?: boolean;
  assistantMessage?: {
    role: "assistant";
    content: string;
    createdAt: string;
  };
  sources?: CoraSourceRef[];
  suggestedPrompts?: string[];
  memoryDelta?: CoraMemoryDelta;
  recommendedActions?: CoraRecommendedAction[];
  recommendedEntities?: CoraRecommendedEntity[];
};

type LearningProfileRow = {
  weak_topics?: string[] | null;
  strong_topics?: string[] | null;
  learning_style?: string | null;
  ai_summary?: string | null;
  total_questions?: number | null;
};

type StreamMetaEvent = {
  sessionId?: string | null;
  quota?: CoraQuotaInfo;
  sources?: CoraSourceRef[];
  suggestedPrompts?: string[];
  recommendedActions?: CoraRecommendedAction[];
  recommendedEntities?: CoraRecommendedEntity[];
};

type StreamDoneEvent = StreamMetaEvent & {
  createdAt?: string;
  fullText?: string;
  memoryDelta?: CoraMemoryDelta;
};

async function consumeEventStream(
  response: Response,
  handlers: {
    onMeta?: (event: StreamMetaEvent) => void;
    onDelta?: (delta: string) => void;
    onDone?: (event: StreamDoneEvent) => void;
  },
) {
  if (!response.body) throw new Error("Cora stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary === -1) break;
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventName = "";
      let data = "";
      for (const line of rawEvent.split(/\r?\n/)) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;

      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (eventName === "meta") {
        handlers.onMeta?.(parsed as StreamMetaEvent);
      } else if (eventName === "delta") {
        if (typeof parsed.text === "string") handlers.onDelta?.(parsed.text);
      } else if (eventName === "done") {
        handlers.onDone?.(parsed as StreamDoneEvent);
      } else if (eventName === "error") {
        throw new Error(typeof parsed.message === "string" ? parsed.message : "Cora stream failed.");
      }
    }
  }
}

function makeTempId() {
  return `temp-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSources(input: unknown): CoraSourceRef[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const sources = input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      return {
        topic: typeof source.topic === "string" ? source.topic : null,
        subtopic: typeof source.subtopic === "string" ? source.subtopic : null,
        category: typeof source.category === "string" ? source.category : null,
        track: typeof source.track === "string" ? source.track : null,
        sourceTable: typeof source.sourceTable === "string" ? source.sourceTable : null,
        sourceId: typeof source.sourceId === "string" ? source.sourceId : null,
        locale: source.locale === "en" ? "en" : source.locale === "vi" ? "vi" : null,
        label: typeof source.label === "string" ? source.label : null,
        href: typeof source.href === "string" ? source.href : null,
      } satisfies CoraSourceRef;
    })
    .filter(Boolean) as CoraSourceRef[];
  return sources.length > 0 ? sources : undefined;
}

function backendContextFor(options: UseCoraAIOptions): BackendAssistantContext {
  if (options.assistantContext === "lesson" && options.courseId) return "course";
  return mapAssistantContextToBackendContext(options.assistantContext);
}

function normalizeLearningMemory(input: LearningProfileRow | null | undefined): CoraLearningMemory | null {
  if (!input) return null;
  const weakTopics = Array.isArray(input.weak_topics) ? input.weak_topics.filter(Boolean) : [];
  const strongTopics = Array.isArray(input.strong_topics) ? input.strong_topics.filter(Boolean) : [];
  const learningStyle = typeof input.learning_style === "string" ? input.learning_style : null;
  const summary = typeof input.ai_summary === "string" ? input.ai_summary : null;
  const totalQuestions = Number(input.total_questions ?? 0);
  if (weakTopics.length === 0 && strongTopics.length === 0 && !learningStyle && !summary && totalQuestions <= 0) {
    return null;
  }
  return {
    weakTopics,
    strongTopics,
    learningStyle,
    summary,
    totalQuestions,
  };
}

function normalizeMemoryDelta(input: unknown): CoraMemoryDelta | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  return {
    newWeakTopic: typeof raw.newWeakTopic === "string" ? raw.newWeakTopic : null,
    newStrongTopic: typeof raw.newStrongTopic === "string" ? raw.newStrongTopic : null,
    learningStyle: typeof raw.learningStyle === "string" ? raw.learningStyle : null,
    summary: typeof raw.summary === "string" ? raw.summary : null,
    totalQuestions: Number(raw.totalQuestions ?? 0),
  };
}

function normalizeRecommendedActions(input: unknown): CoraRecommendedAction[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      if (
        typeof raw.label !== "string" ||
        typeof raw.to !== "string" ||
        typeof raw.reason !== "string"
      ) return null;
      return {
        label: raw.label,
        to: raw.to,
        reason: raw.reason,
      } satisfies CoraRecommendedAction;
    })
    .filter(Boolean) as CoraRecommendedAction[];
}

function normalizeRecommendedEntities(input: unknown): CoraRecommendedEntity[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      if (
        (raw.kind !== "course" && raw.kind !== "career" && raw.kind !== "hackathon") ||
        typeof raw.title !== "string" ||
        typeof raw.to !== "string" ||
        typeof raw.reason !== "string"
      ) return null;
      return {
        kind: raw.kind,
        title: raw.title,
        to: raw.to,
        reason: raw.reason,
        subtitle: typeof raw.subtitle === "string" ? raw.subtitle : null,
        badge: typeof raw.badge === "string" ? raw.badge : null,
      } satisfies CoraRecommendedEntity;
    })
    .filter(Boolean) as CoraRecommendedEntity[];
}

export function useCoraAI(options: UseCoraAIOptions) {
  const { user, isAuthenticated } = useAuth();
  const syncQuotaInfo = useCoraStore((s) => s.setQuotaInfo);
  const [messages, setMessages] = useState<CoraMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<CoraError | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<CoraQuotaInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [learningMemory, setLearningMemory] = useState<CoraLearningMemory | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [memoryDelta, setMemoryDelta] = useState<CoraMemoryDelta | null>(null);
  const [recommendedActions, setRecommendedActions] = useState<CoraRecommendedAction[]>([]);
  const [recommendedEntities, setRecommendedEntities] = useState<CoraRecommendedEntity[]>([]);

  const backendContext = useMemo(() => backendContextFor(options), [options]);
  const historyKey = backendContext === "course" ? sessionId : (options.lessonId ?? sessionId);

  const createSession = useCallback(async () => {
    if (!user?.id || backendContext === "lesson") return null;

    if (backendContext === "course" && options.courseId) {
      // Reuse most-recent session per (user × course) for default landing.
      // Explicit new-session creation goes through `newSession()`.
      const { data: existing } = await supabase
        .from("ai_chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("context_type", "course")
        .eq("course_id", options.courseId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (existing?.id) { setSessionId(existing.id); return existing.id; }
    } else {
      const { data: existing } = await supabase
        .from("ai_chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("context_type", backendContext)
        .is("course_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (existing?.id) { setSessionId(existing.id); return existing.id; }
    }

    const { data, error: insertError } = await supabase
      .from("ai_chat_sessions")
      .insert({
        user_id: user.id,
        context_type: backendContext,
        ...(options.courseId ? { course_id: options.courseId } : {}),
        ...(options.lessonId ? { lesson_id: options.lessonId } : {}),
      })
      .select("id")
      .single<{ id: string }>();
    if (insertError) throw new Error(insertError.message);
    setSessionId(data.id);
    return data.id;
  }, [backendContext, options.courseId, options.lessonId, user?.id]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setMessages([]);
      return;
    }
    const filterValue = backendContext === "lesson" ? options.lessonId : sessionId;
    if (!filterValue) {
      setMessages([]);
      return;
    }

    let query = supabase
      .from("ai_conversations")
      .select("id,role,content,created_at,session_id,cached,sources")
      .eq("user_id", user?.id ?? "")
      .order("created_at", { ascending: true });
    query =
      backendContext === "lesson"
        ? query.eq("lesson_id", filterValue)
        : query.eq("session_id", filterValue);

    const { data, error: queryError } = await query.returns<ConversationRow[]>();
    if (queryError) throw new Error(queryError.message);
    setMessages(
      (data ?? []).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        cached: Boolean(row.cached),
        sources: normalizeSources(row.sources),
      })),
    );
  }, [backendContext, isAuthenticated, options.lessonId, sessionId, user?.id]);

  const loadLearningMemory = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setLearningMemory(null);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("user_learning_profile")
      .select("weak_topics,strong_topics,learning_style,ai_summary,total_questions")
      .eq("user_id", user.id)
      .maybeSingle<LearningProfileRow>();
    if (queryError) throw new Error(queryError.message);
    setLearningMemory(normalizeLearningMemory(data));
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setQuotaInfo(null);
    setLearningMemory(null);
    setSuggestedPrompts([]);
    setMemoryDelta(null);
    setRecommendedActions([]);
    setRecommendedEntities([]);
    if (backendContext !== "lesson") {
      setSessionId(null);
    }
  }, [backendContext, options.lessonId, options.courseId]);

  useEffect(() => {
    if (!options.autoCreateSession || backendContext === "lesson" || !isAuthenticated || sessionId) {
      return;
    }
    createSession().catch((createError) => {
      setError({ type: "generic", message: createError instanceof Error ? createError.message : "Không thể tạo phiên Cora." });
    });
  }, [backendContext, createSession, isAuthenticated, options.autoCreateSession, sessionId]);

  useEffect(() => {
    loadHistory().catch((historyError) => {
      setError({ type: "generic", message: historyError instanceof Error ? historyError.message : "Không thể tải lịch sử Cora." });
    });
  }, [historyKey, loadHistory]);

  useEffect(() => {
    loadLearningMemory().catch((memoryError) => {
      setError({ type: "generic", message: memoryError instanceof Error ? memoryError.message : "Không thể tải memory của Cora." });
    });
  }, [loadLearningMemory]);

  const sendMessage = useCallback(
    async (
      text: string,
      extras?: { action?: "chat" | "explain_selected_text"; selectedText?: string },
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!isAuthenticated) {
        setError({ type: "auth", message: "Bạn cần đăng nhập để dùng Cora AI." });
        return;
      }

      setIsLoading(true);
      setError(null);
      setLastSubmittedMessage(trimmed);

      const tempUserMessage: CoraMessage = {
        id: makeTempId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const tempAssistantId = makeTempId();
      setMessages((current) => [...current, tempUserMessage]);

      try {
        const currentSessionId =
          backendContext === "lesson" ? null : (sessionId ?? (await createSession()));
        setMessages((current) => [
          ...current,
          {
            id: tempAssistantId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
          },
        ]);
        setIsStreaming(true);
        const response = await invokeCoraAi({
          message: trimmed,
          assistantContext: options.assistantContext,
          lessonId: options.lessonId ?? null,
          courseId: options.courseId ?? null,
          sessionId: currentSessionId,
          stream: true,
          ...(extras?.action ? { action: extras.action } : {}),
          ...(extras?.selectedText ? { selectedText: extras.selectedText } : {}),
        });
        const contentType = response.headers.get("content-type") ?? "";

        if (response.ok && contentType.includes("text/event-stream")) {
          await consumeEventStream(response, {
            onMeta: (event) => {
              if (event.sessionId && event.sessionId !== sessionId) setSessionId(event.sessionId);
              if (event.quota) { setQuotaInfo(event.quota); syncQuotaInfo(event.quota); }
              if (Array.isArray(event.suggestedPrompts)) {
                setSuggestedPrompts(event.suggestedPrompts.filter(Boolean));
              }
              setRecommendedActions(normalizeRecommendedActions(event.recommendedActions));
              setRecommendedEntities(normalizeRecommendedEntities(event.recommendedEntities));
            },
            onDelta: (delta) => {
              setMessages((current) =>
                current.map((message) =>
                  message.id === tempAssistantId
                    ? { ...message, content: `${message.content}${delta}` }
                    : message,
                ),
              );
            },
            onDone: (event) => {
              if (event.sessionId && event.sessionId !== sessionId) setSessionId(event.sessionId);
              if (event.quota) { setQuotaInfo(event.quota); syncQuotaInfo(event.quota); }
              const sources = normalizeSources(event.sources);
              if (typeof event.fullText === "string") {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === tempAssistantId
                      ? {
                          ...message,
                          content: event.fullText ?? message.content,
                          createdAt: event.createdAt ?? message.createdAt,
                          sources,
                        }
                      : message,
                  ),
                );
              }
              setMemoryDelta(normalizeMemoryDelta(event.memoryDelta));
              void loadLearningMemory();
            },
          });
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as SendMessageResponse;

        if (!response.ok) {
          if (response.status === 429 && (payload.used != null || payload.limit != null)) {
            throw {
              type: "quota_exceeded",
              message: String(payload.message ?? "Bạn đã chạm giới hạn Cora AI."),
              used: payload.used,
              limit: payload.limit,
              tier: payload.tier,
            } satisfies CoraError;
          }
          if (response.status === 401) {
            throw { type: "auth", message: "Bạn cần đăng nhập để dùng Cora AI." } satisfies CoraError;
          }
          if (response.status === 429) {
            throw new Error("Cora AI đang nhận quá nhiều yêu cầu, thử lại sau một lát giúp mình.");
          }
          if (response.status >= 500) {
            throw new Error("Cora AI đang gặp trục trặc, thử lại sau ít phút giúp mình.");
          }
          throw new Error(String(payload.message ?? "Cora AI chưa phản hồi được."));
        }

        if (payload.sessionId && payload.sessionId !== sessionId) {
          setSessionId(payload.sessionId);
        }
        if (payload.quota) {
          setQuotaInfo(payload.quota);
          syncQuotaInfo(payload.quota);
        }
        if (Array.isArray(payload.suggestedPrompts)) {
          setSuggestedPrompts(payload.suggestedPrompts.filter(Boolean));
        }
        setRecommendedActions(normalizeRecommendedActions(payload.recommendedActions));
        setRecommendedEntities(normalizeRecommendedEntities(payload.recommendedEntities));
        setMemoryDelta(normalizeMemoryDelta(payload.memoryDelta));
        const assistantMessage = payload.assistantMessage;
        const sources = normalizeSources(payload.sources);
        if (assistantMessage?.content) {
          setMessages((current) => [
            ...current.filter((message) => message.id !== tempAssistantId),
            {
              id: tempAssistantId,
              role: "assistant",
              content: assistantMessage.content,
              createdAt: assistantMessage.createdAt,
              cached: Boolean(payload.cached),
              sources,
            },
          ]);
        }
        await loadLearningMemory();
      } catch (sendError) {
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== tempUserMessage.id && message.id !== tempAssistantId,
          ),
        );
        if (typeof sendError === "object" && sendError && "type" in sendError) {
          setError(sendError as CoraError);
        } else {
          setError({
            type: "generic",
            message: sendError instanceof Error ? sendError.message : "Cora AI đang bận, thử lại giúp mình.",
          });
        }
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [
      backendContext,
      createSession,
      isAuthenticated,
      options.assistantContext,
      options.courseId,
      options.lessonId,
      loadLearningMemory,
      sessionId,
      syncQuotaInfo,
    ],
  );

  const explainSelectedText = useCallback(
    async (selectedText: string, userBubbleLabel?: string) => {
      const trimmed = selectedText.trim();
      if (trimmed.length < 4) return;
      const snippet = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
      const bubble = userBubbleLabel
        ? userBubbleLabel.replace("{{snippet}}", snippet)
        : `Giải thích đoạn: "${snippet}"`;
      await sendMessage(bubble, {
        action: "explain_selected_text",
        selectedText: trimmed,
      });
    },
    [sendMessage],
  );

  const newSession = useCallback(async () => {
    if (!user?.id) return null;
    setMessages([]);
    setSuggestedPrompts([]);
    setRecommendedActions([]);
    setRecommendedEntities([]);
    setMemoryDelta(null);
    setError(null);

    // For lesson-only context (no courseId), there's no chat_session row to create.
    if (backendContext === "lesson") {
      setSessionId(null);
      return null;
    }

    const { data, error: insertError } = await supabase
      .from("ai_chat_sessions")
      .insert({
        user_id: user.id,
        context_type: backendContext,
        ...(options.courseId ? { course_id: options.courseId } : {}),
        ...(options.lessonId ? { lesson_id: options.lessonId } : {}),
      })
      .select("id")
      .single<{ id: string }>();
    if (insertError) {
      setError({ type: "generic", message: insertError.message });
      return null;
    }
    setSessionId(data.id);
    return data.id;
  }, [backendContext, options.courseId, options.lessonId, user?.id]);

  const switchSession = useCallback(
    (id: string) => {
      if (!id || id === sessionId) return;
      setMessages([]);
      setSuggestedPrompts([]);
      setRecommendedActions([]);
      setRecommendedEntities([]);
      setMemoryDelta(null);
      setError(null);
      setSessionId(id);
    },
    [sessionId],
  );

  const listSessionsForContext = useCallback(async (): Promise<CoraSessionSummary[]> => {
    if (!user?.id) return [];

    // Scope: course-level when courseId is present; otherwise the global
    // context_type bucket. Lesson-only (no courseId) currently has no
    // ai_chat_sessions rows so we return empty.
    if (backendContext === "lesson") return [];

    let query = supabase
      .from("ai_chat_sessions")
      .select("id,title,last_message_at,message_count,lesson_id")
      .eq("user_id", user.id)
      .eq("context_type", backendContext)
      .order("last_message_at", { ascending: false })
      .limit(30);
    if (options.courseId) {
      query = query.eq("course_id", options.courseId);
    } else {
      query = query.is("course_id", null);
    }

    type SessionRow = {
      id: string;
      title: string | null;
      last_message_at: string;
      message_count: number;
      lesson_id: string | null;
    };
    const { data, error: queryError } = await query.returns<SessionRow[]>();
    if (queryError) throw new Error(queryError.message);
    const rows = data ?? [];

    // Lesson title hydration is intentionally not fetched here: lessons live in
    // `course_lessons` (composite key) + locales, which makes this query
    // expensive. The popover component uses `lessonId !== currentLessonId` to
    // show a generic "from another lesson" badge, which is enough signal.
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      lastMessageAt: row.last_message_at,
      messageCount: Number(row.message_count ?? 0),
      lessonId: row.lesson_id,
      lessonTitle: null,
    }));
  }, [backendContext, options.courseId, user?.id]);

  const clearHistory = useCallback(async () => {
    if (backendContext === "lesson") return;
    if (!user?.id) return;

    setMessages([]);
    setSuggestedPrompts([]);
    setRecommendedActions([]);
    setRecommendedEntities([]);
    setMemoryDelta(null);
    setError(null);
    setSessionId(null);

    // Insert a new session directly instead of calling createSession(), which
    // would re-use the existing most-recent session via ORDER BY created_at DESC.
    const { data, error: insertError } = await supabase
      .from("ai_chat_sessions")
      .insert({
        user_id: user.id,
        context_type: backendContext,
        ...(options.courseId ? { course_id: options.courseId } : {}),
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError) {
      setError({ type: "generic", message: insertError.message });
      return;
    }
    setSessionId(data.id);
  }, [backendContext, options.courseId, user?.id]);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    quotaInfo,
    learningMemory,
    suggestedPrompts,
    memoryDelta,
    recommendedActions,
    recommendedEntities,
    sessionId,
    lastSubmittedMessage,
    createSession,
    loadHistory,
    loadLearningMemory,
    sendMessage,
    explainSelectedText,
    clearHistory,
    newSession,
    switchSession,
    listSessionsForContext,
  };
}
