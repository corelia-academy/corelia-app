import { useCallback, useEffect, useState } from "react";

import type { LessonSummary } from "@/lib/lessonSummary";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

type State = {
  summary: LessonSummary | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  summary: null,
  loading: false,
  error: null,
};

type DbSummaryRow = {
  id: string;
  key_points: unknown;
  practical_tips: unknown;
  locale: "vi" | "en";
  created_at: string;
  updated_at: string;
};

function normalizeStringArray(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, max);
}

function fromRow(row: DbSummaryRow): LessonSummary {
  return {
    id: row.id,
    keyPoints: normalizeStringArray(row.key_points, 5),
    practicalTips: normalizeStringArray(row.practical_tips, 3),
    locale: row.locale === "en" ? "en" : "vi",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useLessonSummary(params: {
  lessonId: string | null | undefined;
  courseId?: string | null | undefined;
  locale?: "vi" | "en";
}) {
  const { lessonId, locale = "vi" } = params;
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<State>(INITIAL_STATE);
  const userId = user?.id;

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !userId || !lessonId) {
      setState((prev) => (prev.summary ? INITIAL_STATE : prev));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase
      .from("lesson_summaries")
      .select("id,key_points,practical_tips,locale,created_at,updated_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .eq("locale", locale)
      .maybeSingle<DbSummaryRow>();
    if (error) {
      setState({ summary: null, loading: false, error: error.message });
      return;
    }
    setState({
      summary: data ? fromRow(data) : null,
      loading: false,
      error: null,
    });
  }, [isAuthenticated, lessonId, locale, userId]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !userId || !lessonId) {
      return;
    }
    void supabase
      .from("lesson_summaries")
      .select("id,key_points,practical_tips,locale,created_at,updated_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .eq("locale", locale)
      .maybeSingle<DbSummaryRow>()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ summary: null, loading: false, error: error.message });
        } else {
          setState({ summary: data ? fromRow(data) : null, loading: false, error: null });
        }
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, lessonId, locale, userId]);

  return {
    summary: state.summary,
    loading: state.loading,
    error: state.error,
    refetch,
  };
}
