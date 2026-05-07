import { useEffect, useState } from "react";
import i18n from "@/i18n";
import type { Contest } from "@/types/contests";
import type { Course } from "@/types/courses";
import {
  applyCourseLocaleContent,
  getBatchCourseLocaleContent,
  getPublishedCourses,
  pickCourseContentLocale,
} from "@/lib/courses";
import { listContests } from "@/lib/contests";
import { perfMeasureEnd, perfMeasureStart } from "@/lib/perfTelemetry";
import { useAuth } from "@/stores/authStore";

export function useHomeCatalogAndContests() {
  const { user } = useAuth();
  const [courseCatalog, setCourseCatalog] = useState<Course[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);

  useEffect(() => {
    let cancelled = false;
    perfMeasureStart("home.catalog_wave");
    void Promise.all([
      getPublishedCourses().catch(() => [] as Course[]),
      listContests(user ?? null).catch(() => [] as Contest[]),
    ])
      .then(([publishedCourses, contestList]) => {
        if (cancelled) return;
        const previewCourses = publishedCourses.slice(0, 8);
        void (async () => {
          const locale = pickCourseContentLocale(previewCourses[0], i18n.language);
          const localeMap = await getBatchCourseLocaleContent(
            previewCourses.map((c) => c.id),
            locale,
          ).catch(() => new Map());
          const localizedPreview = previewCourses.map((c) =>
            applyCourseLocaleContent(c, localeMap.get(c.id) ?? null),
          );
          if (!cancelled) {
            const localizedMap = new Map(localizedPreview.map((c) => [c.id, c]));
            setCourseCatalog(publishedCourses.map((c) => localizedMap.get(c.id) ?? c));
          }
        })();
        setContests(
          contestList.filter(
            (item) => item.status === "published" || item.status === "running",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) {
          perfMeasureEnd("home.catalog_wave", {
            viewer: user?.id ?? "guest",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when user id changes
  }, [user?.id]);

  return { courseCatalog, contests };
}