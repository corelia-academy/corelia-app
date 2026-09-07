import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { careerCatalogQueryOptions } from "@/features/career/careerQueries";
import { CareerTrackListCard } from "@/components/career/CareerTrackListCard";
import { ArrowRight, BookOpen, Trophy } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { PublicCourseCard } from "@/components/courses/PublicCourseCard";
import type { Course } from "@/types/courses";

export function GuestHome({
  t,
  courseCatalog,
}: {
  t: TFunction<"common">;
  courseCatalog: Course[];
}) {
  const { t: tCareer, i18n } = useTranslation("career");
  const tracksQuery = useQuery({ ...careerCatalogQueryOptions(i18n.language), meta: { scope: "public", showInGlobalLoading: false } });
  const featuredCourses = (courseCatalog ?? []).slice(0, 6);

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid gap-6 ">
        <div className="min-w-0 space-y-8">
          <section className="rounded-2xl border border-primary/15 bg-linear-to-br from-primary-muted to-surface-base p-5 sm:p-10">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              Corelia Academy
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight leading-tight text-foreground">
              <span className="bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent">
                {t("home.guest.heroTitle")}
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
              {t("home.guest.heroSubtitle")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button render={<NavLink to="/courses" />} nativeButton={false}>
                {t("home.exploreCourses")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button render={<NavLink to="/login" />} nativeButton={false} variant="outline">
                {t("home.guest.signIn")}
              </Button>
            </div>

            <div className="mt-6 h-px bg-linear-to-r from-transparent via-border to-transparent" />

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: t("home.guest.valueProps.learn.label"),
                  note: t("home.guest.valueProps.learn.note"),
                  icon: BookOpen,
                },
                {
                  label: t("home.guest.valueProps.build.label"),
                  note: t("home.guest.valueProps.build.note"),
                  icon: Trophy,
                },
                {
                  label: t("home.guest.valueProps.ship.label"),
                  note: t("home.guest.valueProps.ship.note"),
                  icon: ArrowRight,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
                        <Icon className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{item.label}</div>
                        <div className="mt-1 text-sm leading-relaxed text-foreground-muted">
                          {item.note}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {t("home.guest.featuredCoursesTitle")}
              </h2>
              <Button
                render={<NavLink to="/courses" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="-mr-2"
              >
                {t("home.sections.seeAll")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.length === 0 ? (
                <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center sm:py-16">
                  <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
                    <BookOpen className="size-6 text-foreground-subtle" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("home.sections.exploreTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {t("home.sections.startFromCatalogSubtitle")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" render={<NavLink to="/courses" />} nativeButton={false}>
                    {t("home.exploreCourses")}
                  </Button>
                </div>
              ) : (
                featuredCourses.map((course) => (
                  <PublicCourseCard key={course.id} course={course} />
                ))
              )}
            </div>
          </section>

          {tracksQuery.data?.length ? <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{tCareer("list.title")}</h2>
            {tracksQuery.data.slice(0, 2).map(track => <CareerTrackListCard key={track.id} track={track} />)}
          </section> : null}
        </div>

      </div>
    </div>
  );
}

