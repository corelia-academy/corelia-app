import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  applyCourseLocaleContent,
  applyCourseSectionLocaleContent,
  getCourse,
  getCourseBySlug,
  getCourseLocaleContent,
  getCourseSectionLocaleContentMap,
  getCourseSections,
  pickCourseContentLocale,
} from "@/lib/courses";
import i18n from "@/i18n";
import type { Course, CourseSection } from "@/types/courses";

interface UseCourseLoadInput {
  idOrSlug: string | undefined;
  missingIdMessage: string;
  loadCourseErrorFallback: string;
}

interface UseCourseLoadResult {
  course: Course | null;
  sections: CourseSection[];
  resolvedCourseId: string | null;
  loading: boolean;
  error: string | null;
  setError: (next: string | null) => void;
}

export function useCourseLoad({
  idOrSlug,
  missingIdMessage,
  loadCourseErrorFallback,
}: UseCourseLoadInput): UseCourseLoadResult {
  const navigate = useNavigate();
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idOrSlug) return;
    let cancelled = false;

    void (async () => {
      const bySlug = await getCourseBySlug(idOrSlug).catch(() => null);
      const byId = bySlug ? null : await getCourse(idOrSlug).catch(() => null);
      const courseRow = bySlug ?? byId;
      const contentLocale = courseRow
        ? pickCourseContentLocale(courseRow, i18n.language)
        : "vi";
      const localizedCourse = courseRow
        ? applyCourseLocaleContent(
            courseRow,
            await getCourseLocaleContent(courseRow.id, contentLocale).catch(
              () => null,
            ),
          )
        : null;
      const sectionsRow = courseRow
        ? await getCourseSections(courseRow.id)
        : [];
      const localizedSections = courseRow ? sectionsRow.map((s) => s) : [];
      if (courseRow) {
        const map = await getCourseSectionLocaleContentMap(
          courseRow.id,
          contentLocale,
        ).catch(() => new Map());
        for (let i = 0; i < localizedSections.length; i += 1) {
          const s = localizedSections[i];
          localizedSections[i] = applyCourseSectionLocaleContent(
            s,
            map.get(s.id) ?? null,
          );
        }
      }

      if (cancelled) return;
      setCourse(localizedCourse ?? null);
      setResolvedCourseId(courseRow?.id ?? null);
      setSections(localizedCourse ? localizedSections : sectionsRow);
      if (courseRow?.slug && idOrSlug !== courseRow.slug) {
        navigate(`/courses/${courseRow.slug}`, { replace: true });
      }
    })()
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
  }, [idOrSlug, navigate, loadCourseErrorFallback]);

  const effectiveLoading = idOrSlug ? loading : false;
  const effectiveError = idOrSlug ? error : missingIdMessage;

  return {
    course,
    sections,
    resolvedCourseId,
    loading: effectiveLoading,
    error: effectiveError,
    setError,
  };
}
