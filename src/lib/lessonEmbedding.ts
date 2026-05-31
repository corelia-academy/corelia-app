import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";

export type EmbedLessonRequest = {
  courseId: string;
  lessonId?: string;
  force?: boolean;
};

export type EmbedLessonReport = {
  embedded: number;
  skipped: number;
  deleted: number;
};

export type EmbedLessonResponse = {
  ok: true;
  totals: EmbedLessonReport;
  results: Array<{ lessonId: string } & EmbedLessonReport>;
};

function embedLessonFunctionUrl(): string {
  const explicit = import.meta.env.VITE_EMBED_LESSON_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/embed-lesson`;
}

export async function invokeEmbedLesson(
  body: EmbedLessonRequest,
): Promise<EmbedLessonResponse> {
  const url = embedLessonFunctionUrl();
  if (!url) throw new Error("Missing Supabase functions URL");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Partial<EmbedLessonResponse> & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(payload.message?.trim() || `http_error:${res.status}`);
  }
  return {
    ok: true,
    totals: payload.totals ?? { embedded: 0, skipped: 0, deleted: 0 },
    results: payload.results ?? [],
  };
}

/**
 * Fire-and-forget background trigger used after an instructor saves a lesson.
 * Never throws; logs warnings only so the save UX is unaffected by RAG
 * ingestion hiccups (rate-limit, transient OpenAI errors, etc).
 */
export function triggerLessonEmbeddingInBackground(args: {
  courseId: string;
  lessonId: string;
}): void {
  void invokeEmbedLesson(args).catch((err) => {
    console.warn("[embed-lesson] background ingest failed", err);
  });
}
