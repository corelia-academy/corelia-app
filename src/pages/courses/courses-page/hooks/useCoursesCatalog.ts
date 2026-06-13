import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  applyCourseLocaleContent,
  getBatchCourseLocaleContent,
  getPublishedCourses,
} from "@/lib/courses";
import type { Course, CourseLevel, SupportedCourseLocale } from "@/types/courses";

import {
  filterAndSortCourses,
  type OwnerFilter,
  type PricingFilter,
  type SortMode,
} from "../utils/catalog";

export function useCoursesCatalog() {
  const { t, i18n } = useTranslation("courses");
  const currentLocale: SupportedCourseLocale = i18n.language?.startsWith("en") ? "en" : "vi";
  const [rawCourses, setRawCourses] = useState<Course[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | CourseLevel>("all");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");

  useEffect(() => {
    let cancelled = false;

    getPublishedCourses()
      .then((onlineRows) => {
        if (cancelled) return;
        setRawCourses(onlineRows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : t("catalog.loadErrorFallback"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  // Apply locale translations whenever raw courses or locale changes.
  useEffect(() => {
    if (rawCourses.length === 0 || currentLocale === "vi") {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (!cancelled) setCourses(rawCourses);
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    const ids = rawCourses.map((c) => c.id);
    getBatchCourseLocaleContent(ids, currentLocale).then((localeMap) => {
      if (cancelled) return;
      setCourses(
        rawCourses.map((c) =>
          applyCourseLocaleContent(c, localeMap.get(c.id) ?? null),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [rawCourses, currentLocale]);

  const filteredOnlineCourses = useMemo(
    () =>
      filterAndSortCourses(courses, {
        query,
        levelFilter,
        pricingFilter,
        ownerFilter,
        sortMode,
      }),
    [courses, levelFilter, ownerFilter, pricingFilter, query, sortMode],
  );

  const activeFilterCount = [
    levelFilter !== "all",
    pricingFilter !== "all",
    ownerFilter !== "all",
    query.trim() !== "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setQuery("");
    setLevelFilter("all");
    setPricingFilter("all");
    setOwnerFilter("all");
    setSortMode("featured");
  };

  return {
    loading,
    error,
    filteredOnlineCourses,
    hasActiveFilters,
    activeFilterCount,
    resetFilters,
  };
}
