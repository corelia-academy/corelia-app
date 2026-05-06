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

export function useHomeCatalogAndContests() {
  const [courseCatalog, setCourseCatalog] = useState<Course[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getPublishedCourses().catch(() => [] as Course[]),
      listContests().catch(() => [] as Contest[]),
    ]).then(([publishedCourses, contestList]) => {
      if (cancelled) return;
      // Localize only what Home actually shows (avoid N+1 over large catalogs).
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
          // keep full catalog for IDs, but use localized preview for display.
          const localizedMap = new Map(localizedPreview.map((c) => [c.id, c]));
          setCourseCatalog(publishedCourses.map((c) => localizedMap.get(c.id) ?? c));
        }
      })();
      setContests(
        contestList.filter(
          (item) => item.status === "published" || item.status === "running",
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { courseCatalog, contests };
}

