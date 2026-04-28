import { useEffect, useState } from "react";
import {
  applyCourseLessonLocaleContent,
  applyCourseLocaleContent,
  applyCourseSectionLocaleContent,
  getCourse,
  getCourseLessonLocaleContentMap,
  getCourseLessons,
  getCourseLocaleContent,
  getCourseSectionLocaleContentMap,
  getCourseSections,
  pickCourseContentLocale,
  touchEnrollment,
} from "@/lib/courses";
import i18n from "@/i18n";
import type { Course, CourseLesson, CourseSection } from "@/types/courses";

interface UseLearnCourseLoadInput {
  courseId: string | undefined;
  loadCourseErrorFallback: string;
}

interface UseLearnCourseLoadResult {
  course: Course | null;
  sections: CourseSection[];
  lessons: CourseLesson[];
  loading: boolean;
  error: string | null;
  setError: (next: string | null) => void;
}

export function useLearnCourseLoad({
  courseId,
  loadCourseErrorFallback,
}: UseLearnCourseLoadInput): UseLearnCourseLoadResult {
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    touchEnrollment(courseId).catch(() => {});

    Promise.all([getCourse(courseId), getCourseSections(courseId), getCourseLessons(courseId)])
      .then(([courseRow, sectionsRow, lessonsRow]) => {
        if (cancelled) return;
        const base = courseRow ?? null;
        if (!base) {
          setCourse(null);
          setSections(sectionsRow);
          setLessons(lessonsRow);
          return;
        }

        // Avoid flashing the error state: we render once `loading` flips false,
        // so ensure we have a non-null course before locale content finishes loading.
        setCourse(base);
        setSections(sectionsRow);
        setLessons(lessonsRow);

        const contentLocale = pickCourseContentLocale(base, i18n.language);
        void (async () => {
          const localizedCourse = applyCourseLocaleContent(
            base,
            await getCourseLocaleContent(courseId, contentLocale).catch(() => null),
          );
          const [sectionMap, lessonMap] = await Promise.all([
            getCourseSectionLocaleContentMap(courseId, contentLocale).catch(() => new Map()),
            getCourseLessonLocaleContentMap(courseId, contentLocale).catch(() => new Map()),
          ]);
          const localizedSections = sectionsRow.map((s) =>
            applyCourseSectionLocaleContent(s, sectionMap.get(s.id) ?? null),
          );
          const localizedLessons = lessonsRow.map((l) =>
            applyCourseLessonLocaleContent(l, lessonMap.get(l.id) ?? null),
          );
          if (cancelled) return;
          setCourse(localizedCourse);
          setSections(localizedSections);
          setLessons(localizedLessons);
        })();
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : loadCourseErrorFallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, loadCourseErrorFallback]);

  return {
    course,
    sections,
    lessons,
    loading: courseId ? loading : false,
    error,
    setError,
  };
}

