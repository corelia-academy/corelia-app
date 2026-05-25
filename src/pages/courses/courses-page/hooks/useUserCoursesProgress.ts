import { useEffect, useState } from "react";
import { useAuth } from "@/stores/authStore";
import {
  computeProgressPercent,
  getCourseLessons,
  getCourseSections,
  getLessonProgressForCourse,
  getMyEnrollments,
  sortLessonsByCurriculum,
} from "@/lib/courses";

export interface CourseProgressEntry {
  enrolled: boolean;
  percent: number;
}

/**
 * For the signed-in user, returns a map of courseId → enrollment + progress.
 * Empty map for guests. Best-effort: failures yield empty.
 */
export function useUserCoursesProgress() {
  const { user } = useAuth();
  const [map, setMap] = useState<Map<string, CourseProgressEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const enrollments = await getMyEnrollments(user.id).catch(() => []);
        if (enrollments.length === 0) {
          if (!cancelled) setMap(new Map());
          return;
        }
        const entries = await Promise.all(
          enrollments.map(async (e) => {
            const [lessons, sections, progress] = await Promise.all([
              getCourseLessons(e.course_id).catch(() => []),
              getCourseSections(e.course_id).catch(() => []),
              getLessonProgressForCourse(user.id, e.course_id).catch(() => []),
            ]);
            const sorted = sortLessonsByCurriculum(lessons, sections);
            const percent = computeProgressPercent(sorted, progress);
            return [e.course_id, { enrolled: true, percent }] as const;
          }),
        );
        if (cancelled) return;
        setMap(new Map(entries));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { progressByCourse: map, loading };
}
