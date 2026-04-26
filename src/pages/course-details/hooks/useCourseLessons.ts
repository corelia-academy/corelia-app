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

export function useCourseLessons({
  resolvedCourseId,
  course,
  previewOnly,
  onError,
  loadLessonsErrorFallback,
}: UseCourseLessonsInput): CourseLesson[] {
  const [lessons, setLessons] = useState<CourseLesson[]>([]);

  useEffect(() => {
    if (!resolvedCourseId || !course) return;
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
          if (!cancelled) setLessons(localized);
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
  ]);

  return lessons;
}
