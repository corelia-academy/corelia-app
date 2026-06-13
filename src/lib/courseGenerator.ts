import { supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import {
  addLesson,
  addSection,
  createCourse,
  setCourseLocaleContent,
} from "@/lib/courses";
import { supabase } from "@/lib/supabase";
import type {
  Course,
  CourseInsert,
  CourseLevel,
  SupportedCourseLocale,
} from "@/types/courses";
import type { User } from "@supabase/supabase-js";

export type GenerateCourseMode = "prompt" | "youtube_playlist" | "youtube_video_list";

export interface GenerateCourseRequest {
  mode: GenerateCourseMode;
  locale: SupportedCourseLocale;
  prompt?: string;
  playlistUrl?: string;
  videoUrls?: string[];
  maxVideos?: number;
  targetLevel?: CourseLevel;
  sectionsCount?: number;
}

export interface GeneratedCourseLesson {
  title: string;
  youtube_url?: string;
  duration_seconds?: number;
  video_primary_locale?: SupportedCourseLocale;
}

export interface GeneratedCourseSection {
  title: string;
  lessons: GeneratedCourseLesson[];
}

export interface GeneratedCourseSkeleton {
  title: string;
  slug?: string;
  description: string;
  short_description?: string;
  learning_outcomes: string[];
  sections: GeneratedCourseSection[];
  is_external_aggregated?: boolean;
  external_source_urls?: string[];
  external_source_attribution_note?: string | null;
  warnings?: string[];
}

export interface CourseGenerationQuote {
  estimated_cost: number;
  model: string;
  tier: string;
  message_balance: number | null;
  available: boolean;
  would_exceed: boolean;
  balance_after: number | null;
}

export interface CourseGenerationReserve extends CourseGenerationQuote {
  reserved: boolean;
  generation_id: number;
  reserved_cost: number;
  reason?: string | null;
}

export interface GenerateCourseResponse {
  course: GeneratedCourseSkeleton;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    model?: string;
  };
}

function generationFunctionUrl(): string {
  const explicit = import.meta.env.VITE_GENERATE_COURSE_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-course`;
}

function estimateVideosCount(req: Pick<GenerateCourseRequest, "mode" | "videoUrls" | "maxVideos">): number {
  if (req.mode === "youtube_video_list") return req.videoUrls?.filter(Boolean).length ?? 0;
  if (req.mode === "youtube_playlist") return Math.max(1, Math.min(200, Number(req.maxVideos ?? 12) || 12));
  return 0;
}

export async function quoteCourseGeneration(
  req: Pick<GenerateCourseRequest, "mode" | "videoUrls" | "maxVideos" | "sectionsCount">,
): Promise<CourseGenerationQuote> {
  const { data, error } = await supabase.rpc("quote_course_generation_cost", {
    p_mode: req.mode,
    p_videos_count: estimateVideosCount(req),
    p_sections_count: req.sectionsCount ?? 6,
  });
  if (error) throw new Error(error.message);
  return data as CourseGenerationQuote;
}

export async function reserveCourseGeneration(
  req: GenerateCourseRequest,
): Promise<CourseGenerationReserve> {
  const { data, error } = await supabase.rpc("reserve_course_generation", {
    p_mode: req.mode,
    p_videos_count: estimateVideosCount(req),
    p_sections_count: req.sectionsCount ?? 6,
    p_payload: {
      locale: req.locale,
      targetLevel: req.targetLevel ?? "all",
      prompt: req.prompt ?? null,
      playlistUrl: req.playlistUrl ?? null,
      videoUrls: req.videoUrls ?? [],
      maxVideos: req.maxVideos ?? null,
    },
  });
  if (error) throw new Error(error.message);
  const reservation = data as CourseGenerationReserve;
  if (!reservation.reserved) {
    throw new Error(reservation.reason || "course_generation_quota_exceeded");
  }
  return reservation;
}

export async function invokeGenerateCourse(
  req: GenerateCourseRequest,
): Promise<GenerateCourseResponse> {
  const url = generationFunctionUrl();
  if (!url) throw new Error("Missing Supabase functions URL");
  const reservation = await reserveCourseGeneration(req);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ban can dang nhap de dung tinh nang nay.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...req,
      generationId: reservation.generation_id,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<GenerateCourseResponse> & {
    message?: string;
  };
  if (!res.ok) throw new Error(json.message?.trim() || `http_error:${res.status}`);
  if (!json.course || !Array.isArray(json.course.sections)) {
    throw new Error("Phan hoi generate course khong hop le.");
  }
  return {
    course: json.course,
    usage: json.usage,
  };
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function applyGeneratedCourse(
  skeleton: GeneratedCourseSkeleton,
  args: {
    profileId: string;
    profileName: string;
    locale: SupportedCourseLocale;
    level?: CourseLevel;
    thumbnailUrl?: string;
    viewer?: User | null;
  },
): Promise<Course> {
  const coursePayload: CourseInsert = {
    title: skeleton.title,
    slug: skeleton.slug?.trim() || slugFromTitle(skeleton.title),
    description: skeleton.description,
    short_description: skeleton.short_description ?? "",
    learning_outcomes: skeleton.learning_outcomes ?? [],
    thumbnail_url:
      args.thumbnailUrl ||
      "https://placehold.co/640x360/1e3a5f/fff?text=Corelia+Course",
    instructor_id: args.profileId,
    instructor_name: args.profileName,
    level: args.level ?? "all",
    total_duration_seconds: 0,
    published: false,
    access_model: "free",
    owner_type: "external_partner",
    is_external_aggregated: skeleton.is_external_aggregated ?? false,
    external_source_urls: skeleton.external_source_urls ?? [],
    external_source_attribution_note:
      skeleton.external_source_attribution_note ?? null,
    i18n: {
      supported_locales: [args.locale],
      primary_content_locale: args.locale,
      default_video_primary_locale: args.locale,
      subtitle_note_policy: "suggest",
    },
  };

  const course = await createCourse(coursePayload, args.viewer ?? undefined);
  await setCourseLocaleContent(course.id, args.locale, {
    title: skeleton.title,
    slug: coursePayload.slug,
    description: skeleton.description,
    short_description: skeleton.short_description ?? "",
    learning_outcomes: skeleton.learning_outcomes ?? [],
  });

  for (const [sectionIndex, section] of skeleton.sections.entries()) {
    const createdSection = await addSection(course.id, {
      title: section.title,
      order: sectionIndex,
    });
    for (const [lessonIndex, lesson] of section.lessons.entries()) {
      await addLesson(course.id, {
        section_id: createdSection.id,
        title: lesson.title,
        lesson_format: lesson.youtube_url ? "video" : "article",
        youtube_url: lesson.youtube_url,
        duration_seconds: Number(lesson.duration_seconds ?? 0),
        video_primary_locale: lesson.video_primary_locale ?? args.locale,
        order: lessonIndex,
      });
    }
  }

  return course;
}
