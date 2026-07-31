import { useCallback, useEffect, useState } from "react";

import i18n from "@/i18n";
import {
  computeReadinessScore,
  fetchReadinessCheck,
  generateReadinessCheck,
  skipReadinessCheck,
  submitReadinessAnswers,
  type ReadinessCheck,
  type ReadinessUserAnswer,
} from "@/lib/readinessCheck";
import type { SupportedCourseLocale } from "@/types/courses";
import { useAuth } from "@/stores/authStore";

type State = {
  check: ReadinessCheck | null;
  loading: boolean;
  generating: boolean;
  submitting: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  check: null,
  loading: false,
  generating: false,
  submitting: false,
  error: null,
};

export function useReadinessCheck(params: {
  lessonId: string | null | undefined;
  courseId: string | null | undefined;
  locale: SupportedCourseLocale;
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
    try {
      const check = await fetchReadinessCheck({ userId: user.id, lessonId });
      setState({
        check,
        loading: false,
        generating: false,
        submitting: false,
        error: null,
      });
    } catch (error) {
      setState({
        check: null,
        loading: false,
        generating: false,
        submitting: false,
        error:
          error instanceof Error ? error.message : i18n.t("courses:errors.readiness.loadFailed"),
      });
    }
  }, [isAuthenticated, lessonId, user?.id]);

  useEffect(() => {
    void fetchExisting();
  }, [fetchExisting]);

  const generate = useCallback(
    async (prereqIds: string[], options?: { count?: number }) => {
      if (!lessonId || !courseId || !user?.id) return null;
      if (prereqIds.length === 0) return null;
      setState((prev) => ({ ...prev, generating: true, error: null }));
      try {
        const check = await generateReadinessCheck({
          userId: user.id,
          courseId,
          lessonId,
          prereqIds,
          locale,
          count: options?.count,
        });
        setState({
          check,
          loading: false,
          generating: false,
          submitting: false,
          error: null,
        });
        return check;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          generating: false,
          error:
            error instanceof Error
              ? error.message
              : i18n.t("courses:errors.readiness.generateFailed"),
        }));
        return null;
      }
    },
    [courseId, lessonId, locale, user?.id],
  );

  const submit = useCallback(
    async (answers: ReadinessUserAnswer[]) => {
      if (!state.check) return null;
      const { score, passed } = computeReadinessScore(state.check.questions, answers);
      setState((prev) => ({ ...prev, submitting: true, error: null }));
      try {
        await submitReadinessAnswers({
          checkId: state.check.id,
          userAnswers: answers,
          score,
          passed,
        });
        const nowIso = new Date().toISOString();
        const next: ReadinessCheck = {
          ...state.check,
          userAnswers: answers,
          score,
          passed,
          reviewedAt: nowIso,
          updatedAt: nowIso,
        };
        setState((prev) => ({ ...prev, check: next, submitting: false }));
        return next;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          submitting: false,
          error: error instanceof Error ? error.message : i18n.t("courses:errors.readiness.submitFailed"),
        }));
        return null;
      }
    },
    [state.check],
  );

  const skip = useCallback(async () => {
    if (!lessonId || !courseId || !user?.id) return;
    setState((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await skipReadinessCheck({
        userId: user.id,
        courseId,
        lessonId,
        locale,
      });
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        submitting: false,
        check: prev.check
          ? { ...prev.check, skipped: true, reviewedAt: nowIso, updatedAt: nowIso }
          : {
              id: "pending",
              courseId,
              lessonId,
              locale,
              questions: [],
              sourceLessonIds: [],
              userAnswers: [],
              score: null,
              passed: null,
              skipped: true,
              reviewedAt: nowIso,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : i18n.t("courses:errors.readiness.skipFailed"),
      }));
    }
  }, [courseId, lessonId, locale, user?.id]);

  return {
    check: state.check,
    loading: state.loading,
    generating: state.generating,
    submitting: state.submitting,
    error: state.error,
    generate,
    submit,
    skip,
    refetch: fetchExisting,
  };
}
