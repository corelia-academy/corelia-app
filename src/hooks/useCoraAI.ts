import { useCallback, useEffect, useMemo, useState } from "react";

import {
  mapAssistantContextToBackendContext,
  type AssistantContext,
  type BackendAssistantContext,
} from "@/components/course-ai/context";
import { invokeCoraAi } from "@/lib/coraAi";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

export type CoraMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  cached?: boolean;
};

export type CoraQuotaInfo = {
  allowed: boolean;
  throttled: boolean;
  haikuOnly: boolean;
  monthlyUsed: number;
  monthlyLimit: number | null;
  dailyUsed: number;
  dailySoftCap: number | null;
  tier: "free" | "student" | "pro" | "bootcamp";
};

export type CoraError =
  | { type: "auth"; message: string }
  | { type: "quota_exceeded"; message: string; used?: number; limit?: number | null; tier?: string }
  | { type: "generic"; message: string };

type UseCoraAIOptions = {
  assistantContext: AssistantContext | "lesson";
  lessonId?: string | null;
  autoCreateSession?: boolean;
};

type ConversationRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  session_id?: string | null;
  cached?: boolean | null;
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
};

type StreamMetaEvent = {
  sessionId?: string | null;
  quota?: CoraQuotaInfo;
};

type StreamDoneEvent = StreamMetaEvent & {
  createdAt?: string;
  fullText?: string;
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

function backendContextFor(options: UseCoraAIOptions): BackendAssistantContext {
  return mapAssistantContextToBackendContext(options.assistantContext);
}

export function useCoraAI(options: UseCoraAIOptions) {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<CoraMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<CoraError | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<CoraQuotaInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);

  const backendContext = useMemo(() => backendContextFor(options), [options]);
  const historyKey = options.lessonId ?? sessionId;

  const createSession = useCallback(async () => {
    if (!user?.id || backendContext === "lesson") return null;
    const { data, error: insertError } = await supabase
      .from("ai_chat_sessions")
      .insert({
        user_id: user.id,
        context_type: backendContext,
      })
      .select("id")
      .single<{ id: string }>();
    if (insertError) throw new Error(insertError.message);
    setSessionId(data.id);
    return data.id;
  }, [backendContext, user?.id]);

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
      .select("id,role,content,created_at,session_id,cached")
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
      })),
    );
  }, [backendContext, isAuthenticated, options.lessonId, sessionId, user?.id]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setQuotaInfo(null);
    if (backendContext !== "lesson") {
      setSessionId(null);
    }
  }, [backendContext, options.lessonId]);

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

  const sendMessage = useCallback(
    async (text: string) => {
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
          sessionId: currentSessionId,
          stream: true,
        });
        const contentType = response.headers.get("content-type") ?? "";

        if (response.ok && contentType.includes("text/event-stream")) {
          await consumeEventStream(response, {
            onMeta: (event) => {
              if (event.sessionId && event.sessionId !== sessionId) setSessionId(event.sessionId);
              if (event.quota) setQuotaInfo(event.quota);
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
              if (event.quota) setQuotaInfo(event.quota);
              if (typeof event.fullText === "string") {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === tempAssistantId
                      ? {
                          ...message,
                          content: event.fullText ?? message.content,
                          createdAt: event.createdAt ?? message.createdAt,
                        }
                      : message,
                  ),
                );
              }
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
          throw new Error(String(payload.message ?? "Cora AI chưa phản hồi được."));
        }

        if (payload.sessionId && payload.sessionId !== sessionId) {
          setSessionId(payload.sessionId);
        }
        if (payload.quota) {
          setQuotaInfo(payload.quota);
        }
        if (payload.assistantMessage?.content) {
          setMessages((current) => [
            ...current.filter((message) => message.id !== tempAssistantId),
            {
              id: tempAssistantId,
              role: "assistant",
              content: payload.assistantMessage.content,
              createdAt: payload.assistantMessage.createdAt,
              cached: Boolean(payload.cached),
            },
          ]);
        }
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
      options.lessonId,
      sessionId,
    ],
  );

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    quotaInfo,
    sessionId,
    lastSubmittedMessage,
    createSession,
    loadHistory,
    sendMessage,
  };
}
