import { getBatchCourseLocaleContent } from "@/lib/courses";
import { getBatchCareerTrackLocaleContent } from "@/lib/careerTracks";
import { getBatchHackathonLocaleContent } from "@/lib/hackathons";
import { normalizeContentLocale } from "@/lib/entityLocales";
import { supabase } from "@/lib/supabase";

export type SearchEntityType = "project" | "hackathon" | "course" | "career_track" | "profile";

export interface SearchResultRow {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  href: string;
  rank: number;
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
  if (!locale) return rows;
  const language = normalizeContentLocale(locale);
  const ids = (type: SearchEntityType) => rows.filter(row => row.entity_type === type).map(row => row.entity_id);
  const [courses, tracks, hackathons] = await Promise.all([
    getBatchCourseLocaleContent(ids("course"), language),
    getBatchCareerTrackLocaleContent(ids("career_track"), language),
    getBatchHackathonLocaleContent(ids("hackathon"), language),
  ]);
  return rows.map(row => {
    const localized = row.entity_type === "course" ? courses.get(row.entity_id)
      : row.entity_type === "career_track" ? tracks.get(row.entity_id)
      : row.entity_type === "hackathon" ? hackathons.get(row.entity_id) : null;
    return localized ? { ...row, title: localized.title ?? row.title } : row;
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
