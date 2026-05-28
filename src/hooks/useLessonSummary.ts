import { useCallback, useEffect, useState } from "react";

import {
  invokeGenerateLessonSummary,
  type LessonSummary,
} from "@/lib/lessonSummary";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

type State = {
  summary: LessonSummary | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  summary: null,
  loading: false,
  generating: false,
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
  courseId: string | null | undefined;
  locale?: "vi" | "en";
}) {
  const { lessonId, courseId, locale } = params;
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<State>(INITIAL_STATE);

  const fetchExisting = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !lessonId) {
      setState(INITIAL_STATE);
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase
      .from("lesson_summaries")
      .select("id,key_points,practical_tips,locale,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .eq("locale", locale ?? "vi")
      .maybeSingle<DbSummaryRow>();
    if (error) {
      setState({ summary: null, loading: false, generating: false, error: error.message });
      return;
    }
    setState({
      summary: data ? fromRow(data) : null,
      loading: false,
      generating: false,
      error: null,
    });
  }, [isAuthenticated, lessonId, user?.id]);

  useEffect(() => {
    void fetchExisting();
  }, [fetchExisting]);

  const generate = useCallback(
    async (options?: { force?: boolean }) => {
      if (!lessonId || !courseId) return null;
      if (!isAuthenticated) {
        setState((prev) => ({
          ...prev,
          error: "Bạn cần đăng nhập để dùng tính năng này.",
        }));
        return null;
      }
      setState((prev) => ({ ...prev, generating: true, error: null }));
      try {
        const response = await invokeGenerateLessonSummary({
          lessonId,
          courseId,
          locale,
          force: options?.force,
        });
        setState({
          summary: response.summary,
          loading: false,
          generating: false,
          error: null,
        });
        return response.summary;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          generating: false,
          error:
            error instanceof Error
              ? error.message
              : "Không thể tóm tắt bài học lúc này.",
        }));
        return null;
      }
    },
    [courseId, isAuthenticated, lessonId, locale],
  );

  return {
    summary: state.summary,
    loading: state.loading,
    generating: state.generating,
    error: state.error,
    generate,
    refetch: fetchExisting,
  };
}
