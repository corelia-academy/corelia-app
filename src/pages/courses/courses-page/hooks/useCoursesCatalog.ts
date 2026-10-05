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

export function useCoursesCatalog() {
  const { t, i18n } = useTranslation("courses");
  const locale: SupportedCourseLocale = i18n.language?.startsWith("en") ? "en" : "vi";
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
    loading: catalogQuery.isPending || (courseIds.length > 0 && lessonCountsQuery.isPending),
    retry: async () => {
      const refetches: Array<Promise<unknown>> = [catalogQuery.refetch()];
      if (courseIds.length > 0) refetches.push(lessonCountsQuery.refetch());
      return Promise.all(refetches);
    },
    error: catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : catalogQuery.error
        ? t("catalog.loadErrorFallback")
        : lessonCountsQuery.error instanceof Error
          ? lessonCountsQuery.error.message
          : lessonCountsQuery.error
            ? t("catalog.lessonCountLoadErrorFallback")
            : null,
    errorTitle: lessonCountsQuery.isError && !catalogQuery.isError
      ? t("catalog.lessonCountLoadErrorTitle")
      : t("catalog.loadErrorTitle"),
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
