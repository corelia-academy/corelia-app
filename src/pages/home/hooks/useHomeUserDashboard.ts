import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { TFunction } from "i18next";
import type { OfflineCourse } from "@/types/offline";
import type { HomeDashboardConfig } from "@/types/dashboard";
import type { Enrollment } from "@/types/courses";
import {
  computeProgressPercent,
  getCourse,
  getCourseLessons,
  getCourseSections,
  getLessonProgressForCourse,
  getMyEnrollments,
  getNextLesson,
  sortLessonsByCurriculum,
} from "@/lib/courses";
import { getHomeDashboardConfig } from "@/lib/dashboardConfig";
import { intlLocale } from "@/lib/intl";
import { listOfflineCourses } from "@/lib/offline";
import type { FocusCard } from "../utils/homeTypes";
import { formatCourseMeta, pickCourseFormat } from "../utils/homeFormat";

export function useHomeUserDashboard(user: User | null, t: TFunction<"common">) {
  const [loading, setLoading] = useState(true);
  const [focusCards, setFocusCards] = useState<FocusCard[]>([]);
  const [offlineCourses, setOfflineCourses] = useState<OfflineCourse[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState(0);
  const [dashboardConfig, setDashboardConfig] =
    useState<HomeDashboardConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const [enrollments, offlineCourseList, homeConfig] = await Promise.all([
          getMyEnrollments(user.uid).catch(() => [] as Enrollment[]),
          listOfflineCourses().catch(() => [] as OfflineCourse[]),
          getHomeDashboardConfig().catch(() => null),
        ]);

        const enrollmentCards = await Promise.all<FocusCard | null>(
          enrollments
            .slice(0, 2)
            .map(async (enrollment): Promise<FocusCard | null> => {
              const course = await getCourse(enrollment.course_id);
              if (!course) return null;
              const [lessons, sections] = await Promise.all([
                getCourseLessons(course.id).catch(() => []),
                getCourseSections(course.id).catch(() => []),
              ]);
              const progress = await getLessonProgressForCourse(
                user.uid,
                course.id,
              ).catch(() => []);
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
          setOfflineCourses(offlineCourseList.filter((item) => item.published));
          setIssuedCertificates(
            enrollments.filter((item) => !!item.certificate_issued_at).length,
          );
          setDashboardConfig(homeConfig);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  return { loading, focusCards, offlineCourses, issuedCertificates, dashboardConfig };
}

