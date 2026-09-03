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

export async function searchPublic(query: string, limit: number, offset = 0) {
  const { data, error } = await supabase.rpc("search_public", {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SearchResultRow[];
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
