import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getLessonProgressForCourse, getMyEnrollments } from "@/lib/courses";

export type CareerCourseProgress = {
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
};

async function fetchTotalLessonsByCourseIds(
  courseIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (courseIds.length === 0) return result;
  const { data, error } = await supabase
    .from("course_lessons")
    .select("course_id")
    .in("course_id", courseIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ course_id: string }>) {
    result.set(row.course_id, (result.get(row.course_id) ?? 0) + 1);
  }
  return result;
}

export function useCareerTrackProgress(
  courseIds: string[],
  userId: string | undefined,
) {
  const [progressByCourse, setProgressByCourse] = useState<
    Map<string, CareerCourseProgress>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const courseIdsKey = useMemo(() => courseIds.join("|"), [courseIds]);

  useEffect(() => {
    if (!userId || courseIds.length === 0) {
      setProgressByCourse(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const enrollments = await getMyEnrollments(userId);
        const enrolledIds = new Set(
          enrollments
            .map((e) => e.course_id)
            .filter((id): id is string => Boolean(id) && courseIds.includes(id)),
        );

        const targetIds = Array.from(enrolledIds);
        if (targetIds.length === 0) {
          if (!cancelled) setProgressByCourse(new Map());
          return;
        }

        const totalsByCourse = await fetchTotalLessonsByCourseIds(targetIds);

        const entries = await Promise.all(
          targetIds.map(async (courseId): Promise<[string, CareerCourseProgress]> => {
            const progress = await getLessonProgressForCourse(userId, courseId).catch(
              () => [],
            );
            const completedLessons = progress.filter(
              (p) => p.completed_at,
            ).length;
            const totalLessons = totalsByCourse.get(courseId) ?? 0;
            const progressPercent =
              totalLessons > 0
                ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
                : 0;
            return [
              courseId,
              { enrolled: true, completedLessons, totalLessons, progressPercent },
            ];
          }),
        );

        if (!cancelled) setProgressByCourse(new Map(entries));
      } catch {
        if (!cancelled) setProgressByCourse(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, courseIdsKey]);

  return { progressByCourse, loading };
}
