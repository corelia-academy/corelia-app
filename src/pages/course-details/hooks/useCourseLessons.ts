import { useEffect, useState } from "react";
import {
  applyCourseLessonLocaleContent,
  getCourseLessonLocaleContentMap,
  getCourseLessons,
  pickCourseContentLocale,
} from "@/lib/courses";
import i18n from "@/i18n";
import type { Course, CourseLesson } from "@/types/courses";

interface UseCourseLessonsInput {
  resolvedCourseId: string | null;
  course: Course | null;
  previewOnly: boolean;
  onError: (message: string) => void;
  loadLessonsErrorFallback: string;
}

interface UseCourseLessonsResult {
  lessons: CourseLesson[];
  loaded: boolean;
}

export function useCourseLessons({
  resolvedCourseId,
  course,
  previewOnly,
  onError,
  loadLessonsErrorFallback,
}: UseCourseLessonsInput): UseCourseLessonsResult {
  const requestKey =
    resolvedCourseId && course
      ? `${resolvedCourseId}:${previewOnly}:${i18n.language}:${course.updated_at}`
      : "";
  const [loadedResult, setLoadedResult] = useState<{
    requestKey: string;
    lessons: CourseLesson[];
  }>({ requestKey: "", lessons: [] });

  useEffect(() => {
    if (!resolvedCourseId || !course || !requestKey) return;
    let cancelled = false;

    getCourseLessons(resolvedCourseId, { previewOnly })
      .then((rows) => {
        if (cancelled) return;
        const contentLocale = pickCourseContentLocale(course, i18n.language);
        void (async () => {
          const map = await getCourseLessonLocaleContentMap(
            resolvedCourseId,
            contentLocale,
          ).catch(() => new Map());
          const localized = rows.map((l) =>
            applyCourseLessonLocaleContent(l, map.get(l.id) ?? null),
          );
          if (!cancelled) {
            setLoadedResult({ requestKey, lessons: localized });
          }
        })();
      })
      .catch((e) => {
        if (!cancelled) {
          onError(e instanceof Error ? e.message : loadLessonsErrorFallback);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    resolvedCourseId,
    course,
    previewOnly,
    onError,
    loadLessonsErrorFallback,
    requestKey,
  ]);

  const loaded = Boolean(requestKey) && loadedResult.requestKey === requestKey;
  return { lessons: loaded ? loadedResult.lessons : [], loaded };
}
