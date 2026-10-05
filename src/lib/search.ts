import {
  getBatchCourseLocaleContent,
  getCoursesByIds,
  getLessonCountsByCourseIds,
} from "@/lib/courses";
import { getBatchHackathonLocaleContent } from "@/lib/hackathons";
import { normalizeContentLocale } from "@/lib/entityLocales";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/types/courses";

export type SearchEntityType = "project" | "hackathon" | "course" | "profile";

export interface SearchResultRow {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  href: string;
  rank: number;
  course?: Pick<Course, "thumbnail_url" | "level" | "total_duration_seconds">;
  lessonCount?: number;
}

export interface TrendingSearchRow {
  query: string;
  searches: number;
}

export async function searchPublic(query: string, limit: number, offset = 0, locale?: string) {
  const { data, error } = await supabase.rpc("search_public", {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SearchResultRow[];
  const courseIds = rows
    .filter((row) => row.entity_type === "course")
    .map((row) => row.entity_id);
  const language = locale ? normalizeContentLocale(locale) : null;
  const localizationPromise = language
    ? Promise.all([
        getBatchCourseLocaleContent(courseIds, language),
        getBatchHackathonLocaleContent(
          rows.filter((row) => row.entity_type === "hackathon").map((row) => row.entity_id),
          language,
        ),
      ])
    : Promise.resolve(null);
  const [courseDetails, lessonCounts, localization] = await Promise.all([
    getCoursesByIds(courseIds),
    getLessonCountsByCourseIds(courseIds),
    localizationPromise,
  ]);

  return rows.map(row => {
    const course = row.entity_type === "course" ? courseDetails.get(row.entity_id) : null;
    const localized = row.entity_type === "course" ? localization?.[0].get(row.entity_id)
      : row.entity_type === "hackathon" ? localization?.[1].get(row.entity_id) : null;

    return {
      ...row,
      ...(course
        ? {
            course: {
              thumbnail_url: course.thumbnail_url,
              level: course.level,
              total_duration_seconds: course.total_duration_seconds,
            },
            lessonCount: lessonCounts.get(row.entity_id) ?? 0,
          }
        : {}),
      ...(localized?.title ? { title: localized.title } : {}),
    };
  });
}

export async function listTrendingSearches(limit = 8) {
  const { data, error } = await supabase.rpc("list_trending_searches", { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrendingSearchRow[];
}

export async function logSearchQuery(query: string) {
  const { error } = await supabase.rpc("log_search_query", { p_query: query });
  if (error) throw new Error(error.message);
}
