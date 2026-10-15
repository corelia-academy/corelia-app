import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  coursesCatalogLessonCountsQueryOptions,
  coursesCatalogQueryOptions,
} from "@/features/courses/courseQueries";
import { getCatalogInstructorOptions, getCatalogSkillOptions } from "../utils/catalog";
import type { CourseLevel, SupportedCourseLocale } from "@/types/courses";
import { filterAndSortCourses, type OwnerFilter, type SortMode } from "../utils/catalog";
import { normalizeLocale } from "@/lib/locales";

export function useCoursesCatalog() {
  const { t, i18n } = useTranslation("courses");
  const locale: SupportedCourseLocale = normalizeLocale(i18n.language);
  const catalogQuery = useQuery(coursesCatalogQueryOptions(locale));
  const courses = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const courseIds = useMemo(() => courses.map((course) => course.id), [courses]);
  const lessonCountsQuery = useQuery(coursesCatalogLessonCountsQueryOptions(courseIds));
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Exclude<CourseLevel, "all">[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const filteredOnlineCourses = useMemo(
    () => filterAndSortCourses(courses, {
      query,
      levelFilter,
      selectedSkills,
      selectedInstructorIds,
      ownerFilter,
      sortMode,
    }),
    [courses, levelFilter, ownerFilter, query, selectedInstructorIds, selectedSkills, sortMode],
  );
  const skillOptions = useMemo(() => getCatalogSkillOptions(courses), [courses]);
  const instructorOptions = useMemo(() => getCatalogInstructorOptions(courses), [courses]);
  const activeFilterCount = [
    levelFilter.length > 0,
    selectedSkills.length > 0,
    selectedInstructorIds.length > 0,
    ownerFilter !== "all",
    query.trim() !== "",
  ].filter(Boolean).length;

  return {
    // Lesson counts are secondary metadata: render cards as soon as the catalog arrives and
    // let counts fill in (or stay hidden on failure) instead of blocking the whole page.
    loading: catalogQuery.isPending,
    retry: async () => {
      await catalogQuery.refetch();
    },
    error: catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : catalogQuery.error
        ? t("catalog.loadErrorFallback")
        : null,
    errorTitle: t("catalog.loadErrorTitle"),
    catalogCourses: courses,
    filteredOnlineCourses,
    lessonCounts: lessonCountsQuery.data ?? new Map<string, number>(),
    query,
    setQuery,
    levelFilter,
    setLevelFilter,
    selectedSkills,
    setSelectedSkills,
    selectedInstructorIds,
    setSelectedInstructorIds,
    skillOptions,
    instructorOptions,
    hasActiveFilters: activeFilterCount > 0,
    activeFilterCount,
    resetFilters: () => {
      setQuery("");
      setLevelFilter([]);
      setSelectedSkills([]);
      setSelectedInstructorIds([]);
      setOwnerFilter("all");
      setSortMode("featured");
    },
  };
}
