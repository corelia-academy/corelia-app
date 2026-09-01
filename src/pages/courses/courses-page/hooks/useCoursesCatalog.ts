import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { coursesCatalogQueryOptions } from "@/features/courses/courseQueries";
import type { CourseLevel, SupportedCourseLocale } from "@/types/courses";
import { filterAndSortCourses, type OwnerFilter, type SortMode } from "../utils/catalog";

export function useCoursesCatalog() {
  const { t, i18n } = useTranslation("courses");
  const locale: SupportedCourseLocale = i18n.language?.startsWith("en") ? "en" : "vi";
  const catalogQuery = useQuery(coursesCatalogQueryOptions(locale));
  const courses = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | CourseLevel>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const filteredOnlineCourses = useMemo(
    () => filterAndSortCourses(courses, { query, levelFilter, ownerFilter, sortMode }),
    [courses, levelFilter, ownerFilter, query, sortMode],
  );
  const activeFilterCount = [
    levelFilter !== "all",
    ownerFilter !== "all",
    query.trim() !== "",
  ].filter(Boolean).length;

  return {
    loading: catalogQuery.isPending,
    error: catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : catalogQuery.error ? t("catalog.loadErrorFallback") : null,
    filteredOnlineCourses,
    hasActiveFilters: activeFilterCount > 0,
    activeFilterCount,
    resetFilters: () => {
      setQuery("");
      setLevelFilter("all");
      setOwnerFilter("all");
      setSortMode("featured");
    },
  };
}
