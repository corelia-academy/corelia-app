import { useMemo, useState } from "react";
import { CaretDown, MonitorPlay } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

import { FullPageEmptyState } from "@/components/layouts/FullPageEmptyState";
import { PublicCourseCard } from "@/components/courses/PublicCourseCard";
import { createMockParticipantPreview } from "@/components/participants/participantPreview";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuSearch,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldContextReset } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { useCoursesCatalog } from "./hooks/useCoursesCatalog";
import { useUserCoursesProgress } from "./hooks/useUserCoursesProgress";

const COURSE_LEVEL_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
type CatalogCourseLevel = (typeof COURSE_LEVEL_OPTIONS)[number];

interface CatalogFilterOption {
  value: string;
  label: string;
}

function CatalogMultiSelectFilter({
  label,
  searchLabel,
  emptyLabel,
  options,
  selectedValues,
  onSelectedValuesChange,
}: {
  label: string;
  searchLabel: string;
  emptyLabel: string;
  options: CatalogFilterOption[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
}) {
  const { t } = useTranslation("courses");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const matchingOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm text-foreground-muted xl:hidden">{label}</p>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          type="button"
          aria-label={`${label}${selectedValues.length > 0 ? `, ${t("catalog.filters.selectedCount", { count: selectedValues.length })}` : ""}`}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left font-body text-body-large text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="min-w-0 truncate">{label}</span>
          <span className="flex shrink-0 items-center gap-2">
            {selectedValues.length > 0 ? (
              <span aria-hidden className="rounded-full bg-primary-muted px-1.5 py-0.5 text-xs text-foreground">
                {selectedValues.length}
              </span>
            ) : null}
            <CaretDown
              className={`size-4 text-foreground-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              weight="duotone"
              aria-hidden
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          layout="multiple-list"
          sideOffset={8}
          className="w-[min(296px,calc(100vw-2rem))]"
        >
          <DropdownMenuSearch>
            <FieldContextReset>
              <Input
                type="search"
                variant="icon-leading"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("catalog.filters.searchPlaceholder")}
                aria-label={searchLabel}
              />
            </FieldContextReset>
          </DropdownMenuSearch>
          <DropdownMenuList>
            {matchingOptions.length > 0 ? matchingOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selectedValues.includes(option.value)}
                size="default"
                onCheckedChange={(checked, eventDetails) => {
                  eventDetails.cancel();
                  onSelectedValuesChange(
                    checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((value) => value !== option.value),
                  );
                }}
              >
                <DropdownMenuItemContent>{option.label}</DropdownMenuItemContent>
              </DropdownMenuCheckboxItem>
            )) : (
              <p className="px-3 py-2 text-xs text-foreground-muted">{emptyLabel}</p>
            )}
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function CoursesPage() {
  const { t } = useTranslation("courses");
  const { t: tCommon } = useTranslation("common");
  const {
    loading,
    error,
    errorTitle,
    catalogCourses,
    filteredOnlineCourses,
    lessonCounts,
    query,
    setQuery,
    hasActiveFilters,
    levelFilter,
    setLevelFilter,
    selectedSkills,
    setSelectedSkills,
    selectedInstructorIds,
    setSelectedInstructorIds,
    skillOptions,
    instructorOptions,
    retry,
  } = useCoursesCatalog();
  const { progressByCourse } = useUserCoursesProgress();
  const participantPreviewByCourse = useMemo(
    () => new Map(filteredOnlineCourses.map((course) => [
      course.id,
      createMockParticipantPreview(course.id),
    ])),
    [filteredOnlineCourses],
  );
  const levelFilterOptions: CatalogFilterOption[] = COURSE_LEVEL_OPTIONS
    .filter((value) => catalogCourses.some((course) => course.level === value))
    .map((value) => ({
      value,
      label: t(`level.${value}`),
    }));
  const skillFilterOptions = skillOptions.map((skill) => ({ value: skill, label: skill }));
  const instructorFilterOptions = instructorOptions.map(({ id, name }) => ({ value: id, label: name }));
  const isSearching = query.trim().length > 0;
  const courseCardGrid = filteredOnlineCourses.length > 0 ? (
    <div className="mobile-bleed-grid grid grid-cols-[minmax(0,335px)] gap-6 sm:grid-cols-[repeat(2,minmax(0,335px))] lg:grid-cols-[repeat(3,minmax(0,335px))] justify-center">
      {filteredOnlineCourses.map((course) => (
        <PublicCourseCard
          key={course.id}
          course={course}
          progress={progressByCourse.get(course.id)}
          participantPreview={participantPreviewByCourse.get(course.id)!}
          variant="catalog"
          lessonCount={lessonCounts.get(course.id)}
        />
      ))}
    </div>
  ) : null;
  const emptySearchState = (
    <div className="mt-4 flex min-h-[31.25rem] items-center justify-center">
      <EmptyStateIllustration
        type="search"
        size="medium"
        title={t("catalog.emptyTitle")}
        description={t("catalog.emptyDescription")}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="course-catalog-page container-app pb-8 pt-6 sm:py-8">
        <main className="mx-auto w-full max-w-[1072px]">
          <header className="mb-6">
            <Skeleton className="h-8 w-64 max-w-[80%] rounded-md" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full rounded" />
          </header>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-[3fr_1fr_1fr_1fr] xl:items-center xl:gap-2">
            <Skeleton className="h-10 w-full md:col-span-3 xl:col-span-1" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="min-w-0">
                <Skeleton className="mb-2 h-4 w-20 rounded xl:hidden" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
          <div className="mobile-bleed-grid mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                  </div>
                  <Skeleton className="h-6 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-catalog-page container-app pb-8 pt-6 sm:py-8">
        <div className="mx-auto max-w-[1072px] rounded-lg border border-destructive/20 bg-destructive-muted p-5">
          <p className="text-sm font-medium text-destructive">{errorTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-destructive/90">{error}</p>
          <Button
            type="button"
            className="mt-4"
            variant="cta"
            hierarchy="secondary"
            onClick={() => void retry()}
          >
            {tCommon("actions.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (catalogCourses.length === 0) {
    return (
      <FullPageEmptyState
        title={t("catalog.noCoursesTitle")}
        description={t("catalog.noCoursesDescription")}
      />
    );
  }

  return (
    <div className="course-catalog-page container-app pb-8 pt-6 sm:py-8">
      <main className="course-catalog mx-auto w-full max-w-[1072px]">
        <header className="mb-6">
          <h1 className="text-heading-large font-display text-foreground">
            {t("catalog.pageTitle")}
            <span className="ml-2 text-body-large font-body font-normal text-foreground-subtle">
              ({catalogCourses.length})
            </span>
          </h1>
          <p className="mt-2 text-body-large text-catalog-subtitle">{t("catalog.subtitle")}</p>
        </header>

        <section
          aria-label={t("catalog.filters.sectionLabel")}
          className="course-catalog-filters space-y-4 xl:grid xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] xl:items-center xl:gap-2 xl:space-y-0"
        >
          <Input
            type="search"
            variant="icon-leading"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("catalog.searchPlaceholder")}
            aria-label={t("catalog.searchPlaceholder")}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-3 xl:gap-2">
            <CatalogMultiSelectFilter
              label={t("catalog.filters.level")}
              searchLabel={t("catalog.filters.searchLabel", { label: t("catalog.filters.level") })}
              emptyLabel={t("catalog.filters.noOptions")}
              options={levelFilterOptions}
              selectedValues={levelFilter}
              onSelectedValuesChange={(values) =>
                setLevelFilter(values.filter((value): value is CatalogCourseLevel =>
                  COURSE_LEVEL_OPTIONS.includes(value as CatalogCourseLevel),
                ))
              }
            />
            <CatalogMultiSelectFilter
              label={t("catalog.filters.skills")}
              searchLabel={t("catalog.filters.searchLabel", { label: t("catalog.filters.skills") })}
              emptyLabel={t("catalog.filters.noOptions")}
              options={skillFilterOptions}
              selectedValues={selectedSkills}
              onSelectedValuesChange={setSelectedSkills}
            />
            <CatalogMultiSelectFilter
              label={t("catalog.filters.instructor")}
              searchLabel={t("catalog.filters.searchLabel", { label: t("catalog.filters.instructor") })}
              emptyLabel={t("catalog.filters.noOptions")}
              options={instructorFilterOptions}
              selectedValues={selectedInstructorIds}
              onSelectedValuesChange={setSelectedInstructorIds}
            />
          </div>
        </section>

        {isSearching ? (
          filteredOnlineCourses.length > 0 ? (
            <>
              <p role="status" className="mt-5xl text-body-small text-foreground-muted">
                {t("catalog.results", { count: filteredOnlineCourses.length })}
              </p>
              <div className="mt-5xl">{courseCardGrid}</div>
            </>
          ) : emptySearchState
        ) : (
          <>
            {(filteredOnlineCourses.length > 0 || !hasActiveFilters) && (
              <section className="mt-8" aria-labelledby="catalog-all-heading">
                <div className="flex min-h-6 items-center gap-2.5">
                  <MonitorPlay className="size-5 shrink-0 text-foreground" weight="duotone" aria-hidden />
                  <h2 id="catalog-all-heading" className="course-catalog-section-title text-body-large font-medium text-foreground">
                    {t("catalog.sections.all")}
                  </h2>
                  <Badge
                    color="gray"
                    variant="filled"
                    size="small"
                    className="min-w-6 px-1"
                    aria-label={t("catalog.sections.allCount", { count: filteredOnlineCourses.length })}
                  >
                    {filteredOnlineCourses.length}
                  </Badge>
                </div>
                <Separator className="mt-3" />
                {courseCardGrid ? <div className="mt-4">{courseCardGrid}</div> : emptySearchState}
              </section>
            )}

            {!hasActiveFilters && (
              <section className="mt-12" aria-labelledby="catalog-upcoming-heading">
                <div className="flex min-h-6 items-center gap-2.5">
                  <MonitorPlay className="size-5 shrink-0 text-foreground" weight="duotone" aria-hidden />
                  <h2 id="catalog-upcoming-heading" className="course-catalog-section-title text-body-large font-medium text-foreground">
                    {t("catalog.sections.upcoming")}
                  </h2>
                </div>
                <Separator className="mt-3" />
                {/* TODO(course-catalog-upcoming): render the upcoming section after its business flow and data are available. */}
              </section>
            )}

            {hasActiveFilters && filteredOnlineCourses.length === 0 && emptySearchState}
          </>
        )}
      </main>
    </div>
  );
}
