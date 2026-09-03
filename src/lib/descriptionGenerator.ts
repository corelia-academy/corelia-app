import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";
import type { SupportedCourseLocale } from "../types/courses";

export type DescriptionGeneratorType = "course" | "lesson" | "hackathon";
export type DescriptionGeneratorAction = "generate" | "translate";
export type DescriptionGeneratorTargetField =
  | "title"
  | "short_description"
  | "description"
  | "description_markdown"
  | "learning_outcomes";
export type DescriptionTranslationBundleKind =
  | "course_info"
  | "section"
  | "lesson"
  | "assignment"
  | "hackathon";

export type HackathonTranslationItem = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  descriptionMarkdown?: string;
};

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

export type DescriptionSourceInput = {
  id?: string;
  title?: string;
  shortDescription?: string;
  markdownDescription?: string;
  transcript?: string;
  youtubeUrl?: string;
};

export type DescriptionTranslationBundle = {
  title?: string;
  shortDescription?: string;
  description?: string;
  markdownDescription?: string;
  learningOutcomes?: string[];
  instructions?: string;
  resourcesMarkdown?: string;
  prizeDescriptionMarkdown?: string;
  tracks?: HackathonTranslationItem[];
  sectors?: HackathonTranslationItem[];
  techStacks?: HackathonTranslationItem[];
  timeline?: HackathonTranslationItem[];
};

type GenerateDescriptionRequestCommon = {
  targetField: DescriptionGeneratorTargetField;
  intent?: "practice";
  locale: SupportedCourseLocale;
  sourceLocale?: SupportedCourseLocale;
  sourceInputs?: DescriptionSourceInput[];
  sourceBundle?: DescriptionTranslationBundle;
  youtubeUrl?: string;
  lessonTitle?: string;
};

type CareerTrackTranslationRequest = GenerateDescriptionRequestCommon & {
  action: "translate";
  type: "course";
  targetField: "description";
  bundleKind: "course_info";
  careerTrackId: string;
  hackathonId?: never;
  courseId?: never;
  sectionId?: never;
  lessonId?: never;
};

type HackathonTranslationRequest = GenerateDescriptionRequestCommon & {
  action: "translate";
  type: "hackathon";
  targetField: "description";
  bundleKind: "hackathon";
  hackathonId: string;
  sourceBundle: DescriptionTranslationBundle;
  careerTrackId?: never;
  courseId?: never;
  sectionId?: never;
  lessonId?: never;
};

type CourseOrLessonDescriptionRequest = GenerateDescriptionRequestCommon & {
  action?: DescriptionGeneratorAction;
  type: "course" | "lesson";
  bundleKind?: DescriptionTranslationBundleKind;
  careerTrackId?: never;
  hackathonId?: never;
  courseId?: string;
  sectionId?: string;
  lessonId?: string;
};

export type GenerateDescriptionRequest =
  | CareerTrackTranslationRequest
  | HackathonTranslationRequest
  | CourseOrLessonDescriptionRequest;

export function serializeGenerateDescriptionRequest(body: GenerateDescriptionRequest): string {
  return JSON.stringify(body);
}

export type GenerateDescriptionResponse = {
  description: string;
  bundle?: DescriptionTranslationBundle | null;
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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseFunctionHeaders(token),
        "Content-Type": "application/json",
      },
      body: serializeGenerateDescriptionRequest(body),
    });
  } catch {
    throw new Error("Không kết nối được Edge Function generate-description. Kiểm tra deploy/CORS.");
  }
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
    bundle:
      json.bundle && typeof json.bundle === "object"
        ? (json.bundle as DescriptionTranslationBundle)
        : null,
    sources: json.sources,
    warning: typeof json.warning === "string" ? json.warning : null,
  };
}
