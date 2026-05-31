import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";

export type LearningPathMilestone = {
  order: number;
  title: string;
  description: string;
  weeks: number;
};

export type LearningPathCourseRef = {
  id: string;
  slug: string | null;
  title: string;
  reason: string;
  order: number;
};

export type LearningPathTrackRef = {
  slug: string;
  title: string;
  reason: string;
  order: number;
};

export type LearningPathWeeklyItem = {
  week: number;
  focus: string;
  actions: string[];
};

export type LearningPath = {
  id: string;
  goal: string;
  locale: "vi" | "en";
  summary: string | null;
  estimatedWeeks: number | null;
  milestones: LearningPathMilestone[];
  recommendedCourses: LearningPathCourseRef[];
  recommendedTracks: LearningPathTrackRef[];
  weeklyPlan: LearningPathWeeklyItem[];
  createdAt: string;
  updatedAt: string;
};

export type GenerateLearningPathRequest = {
  goal: string;
  locale?: "vi" | "en";
  force?: boolean;
};

export type GenerateLearningPathResponse = {
  cached: boolean;
  path: LearningPath;
};

function functionUrl(): string {
  const explicit = import.meta.env.VITE_GENERATE_LEARNING_PATH_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-learning-path`;
}

function normalizeMilestones(input: unknown): LearningPathMilestone[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title : "";
      if (!title) return null;
      return {
        order: typeof o.order === "number" ? o.order : 0,
        title,
        description: typeof o.description === "string" ? o.description : "",
        weeks: typeof o.weeks === "number" ? o.weeks : 1,
      };
    })
    .filter((m): m is LearningPathMilestone => Boolean(m));
}

function normalizeCourses(input: unknown): LearningPathCourseRef[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const title = typeof o.title === "string" ? o.title : "";
      if (!id || !title) return null;
      return {
        id,
        slug: typeof o.slug === "string" ? o.slug : null,
        title,
        reason: typeof o.reason === "string" ? o.reason : "",
        order: typeof o.order === "number" ? o.order : 0,
      };
    })
    .filter((c): c is LearningPathCourseRef => Boolean(c));
}

function normalizeTracks(input: unknown): LearningPathTrackRef[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const slug = typeof o.slug === "string" ? o.slug : "";
      const title = typeof o.title === "string" ? o.title : "";
      if (!slug || !title) return null;
      return {
        slug,
        title,
        reason: typeof o.reason === "string" ? o.reason : "",
        order: typeof o.order === "number" ? o.order : 0,
      };
    })
    .filter((t): t is LearningPathTrackRef => Boolean(t));
}

function normalizeWeekly(input: unknown): LearningPathWeeklyItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const week = typeof o.week === "number" ? o.week : 0;
      const focus = typeof o.focus === "string" ? o.focus : "";
      const actions = Array.isArray(o.actions)
        ? (o.actions as unknown[]).filter((a): a is string => typeof a === "string")
        : [];
      if (week <= 0 && !focus && actions.length === 0) return null;
      return { week, focus, actions };
    })
    .filter((w): w is LearningPathWeeklyItem => Boolean(w));
}

function normalizePath(raw: Record<string, unknown>): LearningPath {
  return {
    id: String(raw.id ?? ""),
    goal: String(raw.goal ?? ""),
    locale: raw.locale === "en" ? "en" : "vi",
    summary: typeof raw.summary === "string" ? raw.summary : null,
    estimatedWeeks:
      typeof raw.estimatedWeeks === "number"
        ? raw.estimatedWeeks
        : typeof raw.estimated_weeks === "number"
          ? (raw.estimated_weeks as number)
          : null,
    milestones: normalizeMilestones(raw.milestones),
    recommendedCourses: normalizeCourses(raw.recommendedCourses ?? raw.recommended_courses),
    recommendedTracks: normalizeTracks(raw.recommendedTracks ?? raw.recommended_tracks),
    weeklyPlan: normalizeWeekly(raw.weeklyPlan ?? raw.weekly_plan),
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : typeof raw.created_at === "string"
          ? (raw.created_at as string)
          : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : typeof raw.updated_at === "string"
          ? (raw.updated_at as string)
          : new Date().toISOString(),
  };
}

export async function invokeGenerateLearningPath(
  body: GenerateLearningPathRequest,
): Promise<GenerateLearningPathResponse> {
  const url = functionUrl();
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
  const payload = (await res.json().catch(() => ({}))) as {
    cached?: boolean;
    path?: Record<string, unknown>;
    message?: string;
  };
  if (!res.ok) throw new Error(payload.message?.trim() || `http_error:${res.status}`);
  if (!payload.path) throw new Error("Phản hồi lộ trình không hợp lệ.");
  return { cached: Boolean(payload.cached), path: normalizePath(payload.path) };
}

export async function listLearningPaths(userId: string): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from("learning_paths")
    .select(
      "id,goal,locale,summary,estimated_weeks,milestones,recommended_courses,recommended_tracks,weekly_plan,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizePath(row as Record<string, unknown>));
}

export async function deleteLearningPath(id: string): Promise<void> {
  const { error } = await supabase.from("learning_paths").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
