import { useMemo } from "react";
import { BookOpen, Clock, FileText } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import {
  createMockParticipantPreview,
  formatCompactParticipantCount,
} from "@/components/participants/participantPreview";
import type { Course } from "@/types/courses";
import { getCourseLevelLabel } from "@/types/courses";

type RecommendedCourseCardView = {
  course: Course;
  participantPreview: ReturnType<typeof createMockParticipantPreview>;
};

export function ExploreCoursesSection({
  t,
  courseCatalog,
  courseLessonCounts,
}: {
  t: TFunction<"common">;
  courseCatalog: Course[];
  courseLessonCounts: Record<string, number | null>;
}) {
  const recommendationCards: RecommendedCourseCardView[] = useMemo(() => {
    const seenCourseIds = new Set<string>();

    return (courseCatalog ?? [])
      .filter((course) => {
        if (seenCourseIds.has(course.id)) return false;
        seenCourseIds.add(course.id);
        return true;
      })
      .slice(0, 2)
      .map((course) => ({
        course,
        participantPreview: createMockParticipantPreview(course.id),
      }));
  }, [courseCatalog]);

  return (
    <section className="mobile-bleed-surface px-5 sm:px-0">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-body-large font-body font-medium text-foreground">
          {t("home.sections.recommendedTitle")}
        </h2>
        <Button
          render={<NavLink to="/courses" />}
          nativeButton={false}
          variant="cta" hierarchy="tertiary"
          size="small"
          className="-mr-2 px-1 py-1.5 capitalize"
        >
          {t("home.sections.seeAll")}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-6">
        {(courseCatalog ?? []).length === 0 ? (
          <div className="flex w-full flex-col items-center gap-3 py-12 text-center sm:py-16">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <BookOpen className="size-6 text-foreground-subtle" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t("home.sections.exploreTitle")}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {t("home.sections.startFromCatalogSubtitle")}
              </p>
            </div>
            <Button size="small" render={<NavLink to="/courses" />} nativeButton={false}>
              {t("home.exploreCourses")}
            </Button>
          </div>
        ) : (
          recommendationCards.map(({ course, participantPreview }) => {
            const lessonCount = courseLessonCounts[course.id];

            return (
              <NavLink
                key={course.id}
                to={`/courses/${course.slug || course.id}`}
                className="group min-w-[240px] max-w-none sm:max-w-[335px] flex-[1_1_100%] sm:flex-[1_1_240px] @min-[504px]:@max-[807px]:flex-[1_1_240px]! overflow-hidden rounded-xl transition-transform duration-200 ease-out hover:-translate-y-0.5"
              >
                <div className="aspect-video overflow-hidden rounded-lg border border-border bg-surface-raised">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-4 p-4">
                  <div className="flex h-[50px] flex-col gap-2 overflow-hidden">
                    <h3 className="line-clamp-1 text-lg font-display font-medium leading-tight text-foreground">
                      {course.title}
                    </h3>
                    <div className="flex min-w-0 items-center gap-3 text-xs text-foreground-muted">
                      <span className="shrink-0 rounded-full border border-blue-400 px-1.5 py-1 text-[10px] leading-3 text-blue-400">
                        {getCourseLevelLabel(course.level)}
                      </span>
                      {typeof lessonCount === "number" ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                          <FileText className="size-4" aria-hidden />
                          {t("home.meta.lessonCount", { count: lessonCount })}
                        </span>
                      ) : null}
                      {typeof lessonCount === "number" ? (
                        <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                      ) : null}
                      <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                        <Clock className="size-4 shrink-0" aria-hidden />
                        {course.total_duration_seconds > 0
                          ? t("home.meta.hours", {
                              count: Math.max(
                                1,
                                Math.round(course.total_duration_seconds / 3600),
                              ),
                            })
                          : t("home.meta.selfPaced")}
                      </span>
                    </div>
                  </div>
                  <ParticipantSummary
                    count={participantPreview.count}
                    participants={participantPreview.participants}
                    summary={t("home.meta.learners", {
                      displayCount: formatCompactParticipantCount(participantPreview.count),
                    })}
                  />
                </div>
              </NavLink>
            );
          })
        )}
      </div>
    </section>
  );
}

