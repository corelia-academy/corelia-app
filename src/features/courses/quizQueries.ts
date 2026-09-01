import { queryOptions } from "@tanstack/react-query";

import { getLessonQuizResult, getSectionQuizResult } from "@/lib/quizAttempts";
import { getLessonQuestions, getSectionQuestions } from "@/lib/sectionQuestions";
import type { SectionQuestion, SectionQuizResult } from "@/types/questions";

export interface SectionQuizQueryData {
  questions: SectionQuestion[];
  existingResult: SectionQuizResult | null;
}

export const quizKeys = {
  all: ["lesson-quiz"] as const,
  detail: (userId: string, courseId: string, lessonId: string) =>
    [...quizKeys.all, userId, courseId, lessonId] as const,
  section: (userId: string, courseId: string, sectionId: string) =>
    [...quizKeys.all, "section", userId, courseId, sectionId] as const,
};

export function sectionQuizQueryOptions(input: {
  userId: string | undefined;
  courseId: string;
  sectionId: string;
}) {
  const userId = input.userId ?? "";
  return queryOptions({
    queryKey: quizKeys.section(
      userId || "missing",
      input.courseId,
      input.sectionId,
    ),
    queryFn: async ({ signal }): Promise<SectionQuizQueryData> => {
      const questions = await getSectionQuestions(
        input.courseId,
        input.sectionId,
        undefined,
        signal,
      );
      const existingResult = questions.length
        ? await getSectionQuizResult(
            input.courseId,
            input.sectionId,
            questions.length,
            signal,
          )
        : null;
      return { questions, existingResult };
    },
    enabled: Boolean(userId && input.courseId && input.sectionId),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function lessonQuizQueryOptions(input: {
  userId: string | undefined;
  courseId: string;
  lessonId: string;
}) {
  const userId = input.userId ?? "";
  return queryOptions({
    queryKey: quizKeys.detail(userId || "missing", input.courseId, input.lessonId),
    queryFn: async ({ signal }) => {
      const questions = await getLessonQuestions(
        input.courseId,
        input.lessonId,
        undefined,
        signal,
      );
      const existingResult = questions.length
        ? await getLessonQuizResult(
            input.courseId,
            input.lessonId,
            questions.length,
            signal,
          )
        : null;
      return { questions, existingResult };
    },
    enabled: Boolean(userId && input.courseId && input.lessonId),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}
