import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import type { Enrollment } from "@/types/courses";
import { intlLocale } from "@/lib/intl";
import type { FocusCard } from "../utils/homeTypes";
import { perfMeasureEnd, perfMeasureStart } from "@/lib/perfTelemetry";
import { formatCourseMeta, pickCourseFormat } from "../utils/homeFormat";

export function useHomeUserDashboard(user: User | null, t: TFunction<"common">) {
  const [loading, setLoading] = useState(true);
  const [focusCards, setFocusCards] = useState<FocusCard[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      perfMeasureStart("home.dashboard_wave");

      try {
        const { getMyEnrollments, getCourse, getCourseLessons, getCourseSections, getLessonProgressForCourse, sortLessonsByCurriculum, computeProgressPercent, getNextLesson, backfillMissingEnrollmentsForUser } = await import("@/lib/courses");

        const enrollmentsInitial = await getMyEnrollments(user.id).catch(() => [] as Enrollment[]);

        const created = await backfillMissingEnrollmentsForUser(user.id).catch(() => 0);
        const enrollments = created > 0
          ? await getMyEnrollments(user.id).catch(() => enrollmentsInitial)
          : enrollmentsInitial;

        const enrollmentCards = await Promise.all<FocusCard | null>(
          enrollments
            .slice(0, 2)
            .map(async (enrollment): Promise<FocusCard | null> => {
              const [course, lessons, sections, progress] = await Promise.all([
                getCourse(enrollment.course_id),
                getCourseLessons(enrollment.course_id).catch(() => []),
                getCourseSections(enrollment.course_id).catch(() => []),
                getLessonProgressForCourse(user.id, enrollment.course_id).catch(() => []),
              ]);
              if (!course) return null;
              const sortedLessons = sortLessonsByCurriculum(lessons, sections);
              const percent = computeProgressPercent(sortedLessons, progress);
              const nextLesson = getNextLesson(sortedLessons, progress);
              const format = pickCourseFormat(course);
              const card: FocusCard = {
                id: course.id,
                title: course.title,
                format,
                progress: percent,
                nextStep:
                  format === "online"
                    ? nextLesson?.title
                      ? t("home.focus.nextLesson", { title: nextLesson.title })
                      : t("home.focus.allLessonsCompleted")
                    : t("home.focus.lastAccessed", {
                        date: new Date(enrollment.last_accessed_at).toLocaleDateString(
                          intlLocale(),
                        ),
                      }),
                meta: formatCourseMeta(course, format),
                action: `/learn/${course.id}`,
                thumbnailUrl: course.thumbnail_url,
                lastAccessedAt: enrollment.last_accessed_at,
              };
              return card;
            }),
        );

        if (!cancelled) {
          setFocusCards(
            enrollmentCards.filter((item): item is FocusCard => item != null),
          );
          setIssuedCertificates(
            enrollments.filter((item) => !!item.certificate_issued_at).length,
          );
        }
      } finally {
        if (!cancelled) {
          perfMeasureEnd("home.dashboard_wave", { userId: user.id });
          setLoading(false);
        }
      }
    }

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  return { loading, focusCards, issuedCertificates };
}
