import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";

export type LessonSummary = {
  id: string;
  keyPoints: string[];
  practicalTips: string[];
  locale: "vi" | "en";
  createdAt: string;
  updatedAt: string;
};

export type GenerateLessonSummaryRequest = {
  lessonId: string;
  courseId: string;
  locale?: "vi" | "en";
  force?: boolean;
};

export type GenerateLessonSummaryResponse = {
  cached: boolean;
  summary: LessonSummary;
};

function lessonSummaryFunctionUrl(): string {
  const explicit = import.meta.env.VITE_GENERATE_LESSON_SUMMARY_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-lesson-summary`;
}

export async function invokeGenerateLessonSummary(
  body: GenerateLessonSummaryRequest,
): Promise<GenerateLessonSummaryResponse> {
  const url = lessonSummaryFunctionUrl();
  if (!url) throw new Error("Missing Supabase functions URL");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Bạn cần đăng nhập để dùng tính năng này.");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseFunctionHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Không kết nối được Edge Function generate-lesson-summary.");
  }

  const payload = (await res.json().catch(() => ({}))) as {
    cached?: boolean;
    summary?: LessonSummary;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(payload.message?.trim() || `http_error:${res.status}`);
  }
  if (!payload.summary || !Array.isArray(payload.summary.keyPoints)) {
    throw new Error("Phản hồi summary không hợp lệ.");
  }
  return {
    cached: Boolean(payload.cached),
    summary: payload.summary,
  };
}
