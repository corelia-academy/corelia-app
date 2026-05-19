import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";
import type { SupportedCourseLocale } from "../types/courses";

export type DescriptionGeneratorType = "course" | "lesson";
export type DescriptionGeneratorAction = "generate" | "translate";
export type DescriptionGeneratorTargetField =
  | "short_description"
  | "description"
  | "description_markdown";

export type DescriptionSourceKind =
  | "short_description"
  | "description_markdown"
  | "transcript";

export type DescriptionSource = {
  lessonId: string;
  lessonTitle: string;
  sourceKinds: DescriptionSourceKind[];
  snippet?: string;
};

export type GenerateDescriptionRequest = {
  action?: DescriptionGeneratorAction;
  type: DescriptionGeneratorType;
  targetField: DescriptionGeneratorTargetField;
  locale: SupportedCourseLocale;
  sourceLocale?: SupportedCourseLocale;
  courseId?: string;
  sectionId?: string;
  lessonId?: string;
  youtubeUrl?: string;
};

export type GenerateDescriptionResponse = {
  description: string;
  sources: DescriptionSource[];
  warning?: string | null;
};

export function descriptionGeneratorFunctionUrl(): string {
  const explicit = import.meta.env.VITE_GENERATE_DESCRIPTION_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-description`;
}

export async function invokeGenerateDescription(
  body: GenerateDescriptionRequest,
): Promise<GenerateDescriptionResponse> {
  const url = descriptionGeneratorFunctionUrl();
  if (!url) throw new Error("Missing Supabase functions URL");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Bạn cần đăng nhập để dùng tính năng này.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<GenerateDescriptionResponse> & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(json.message?.trim() || `http_error:${res.status}`);
  }
  if (typeof json.description !== "string" || !Array.isArray(json.sources)) {
    throw new Error("Phản hồi generate description không hợp lệ.");
  }
  return {
    description: json.description,
    sources: json.sources,
    warning: typeof json.warning === "string" ? json.warning : null,
  };
}
