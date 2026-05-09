import { ArrowRight, BookOpen, Trophy } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { intlLocale } from "@/lib/intl";
import { getCourseLevelLabel } from "@/types/courses";
import type { Contest } from "@/types/hackathons";
import { contestListImageUrl } from "@/lib/hackathonVisuals";
import type { Course } from "@/types/courses";

export function GuestHome({
  t,
  courseCatalog,
  contests,
}: {
  t: TFunction<"common">;
  courseCatalog: Course[];
  contests: Contest[];
}) {
  const featuredCourses = (courseCatalog ?? []).slice(0, 6);

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border border-border-subtle bg-surface-base p-6">
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
                    className="rounded-lg border border-border-subtle bg-surface-base p-4 transition-all duration-200 ease-out hover:bg-surface-raised"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
                        <Icon className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{item.label}</div>
                        <div className="mt-1 text-xs leading-relaxed text-foreground-muted">
                          {item.note}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
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
                  <NavLink
                    key={course.id}
                    to={`/courses/${course.slug || course.id}`}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-border-subtle bg-surface-base transition-all duration-200 ease-out hover:bg-surface-raised hover:border-border hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-video bg-surface-raised">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt=""
                          className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : null}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="line-clamp-1 rounded-sm border border-border bg-surface-raised px-2 py-0.5 text-xs font-medium text-foreground-muted">
                        {getCourseLevelLabel(course.level)}
                      </div>
                      <div className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground">
                        {course.title}
                      </div>
                    </div>
                  </NavLink>
                ))
              )}
            </div>
          </section>

          {contests.length > 0 ? (
            <section className="rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {t("home.guest.openContestsTitle")}
                </h2>
                <Button
                  render={<NavLink to="/hackathons" />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="-mr-2"
                >
                  {t("home.sections.seeAll")}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {contests.slice(0, 3).map((contest) => {
                  const rowImg = contestListImageUrl(contest);
                  const contestSlug = contest.slug?.trim() || null;
                  return (
                  <NavLink
                    key={contest.id}
                    to={contestSlug ? `/hackathons/${contestSlug}/overview` : "/hackathons"}
                    className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base px-3 py-3 transition-all duration-200 ease-out hover:bg-surface-raised hover:border-border hover:-translate-y-0.5"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
                      {rowImg ? (
                        <img
                          src={rowImg}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-primary-muted text-primary">
                          <Trophy className="size-6" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium text-foreground">
                        {contest.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                        {contest.tagline}
                      </div>
                      {contest.registration_deadline ? (
                        <div className="mt-2 text-xs text-foreground-muted">
                          {t("home.pinned.contest.registrationDeadline", {
                            date: new Date(contest.registration_deadline).toLocaleDateString(intlLocale()),
                          })}
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-foreground-muted" aria-hidden />
                  </NavLink>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
            <div className="text-sm font-medium text-foreground">
              {t("home.guest.startLearningTitle")}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              {t("home.guest.startLearningSubtitle")}
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                className="w-full"
                variant="secondary"
                render={<NavLink to="/login" />}
                nativeButton={false}
              >
                {t("home.guest.signIn")}
              </Button>
              <Button
                className="w-full"
                render={<NavLink to="/courses" />}
                nativeButton={false}
                variant="outline"
              >
                {t("home.exploreCourses")}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              <BookOpen className="size-4 shrink-0" aria-hidden />
              {t("home.guest.quickLinksTitle")}
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: t("home.allCourses"), to: "/courses" },
                { label: t("home.guest.quickLinks.contests"), to: "/hackathons" },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-sm text-foreground transition-all duration-200 ease-out hover:bg-surface-raised hover:border-border hover:-translate-y-0.5"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-4 text-foreground-muted" aria-hidden />
                </NavLink>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

