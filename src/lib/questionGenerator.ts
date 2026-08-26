import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";
import type { SupportedCourseLocale } from "../types/courses";
import type { SectionQuestionData } from "../types/questions";

export type DescriptionSourceKind = "short_description" | "description_markdown" | "transcript";

export type GeneratedQuestionSource = {
  lessonId: string;
  lessonTitle: string;
  sourceKinds: DescriptionSourceKind[];
  snippet?: string;
};

export type GenerateQuestionsRequest = {
  courseId: string;
  sectionId?: string;
  lessonId?: string;
  sourceLessonIds?: string[];
  locale: SupportedCourseLocale;
  count?: number;
};

export type GenerateQuestionsResponse = {
  questions: SectionQuestionData[];
  sources: GeneratedQuestionSource[];
  warning?: string | null;
};

function generateQuestionsFunctionUrl(): string {
  const explicit = import.meta.env.VITE_GENERATE_QUESTIONS_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-questions`;
}

export async function invokeGenerateQuestions(
  body: GenerateQuestionsRequest,
): Promise<GenerateQuestionsResponse> {
  const url = generateQuestionsFunctionUrl();
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
    throw new Error("Không kết nối được Edge Function generate-questions. Kiểm tra deploy/CORS.");
  }

  const json = (await res.json().catch(() => ({}))) as Partial<GenerateQuestionsResponse> & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(json.message?.trim() || `http_error:${res.status}`);
  }
  if (!Array.isArray(json.questions)) {
    throw new Error("Phản hồi generate questions không hợp lệ.");
  }

  return {
    questions: json.questions as SectionQuestionData[],
    sources: json.sources ?? [],
    warning: typeof json.warning === "string" ? json.warning : null,
  };
}
