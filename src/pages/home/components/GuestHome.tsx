import { ArrowRight, BookOpen } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { intlLocale } from "@/lib/intl";
import { getCourseLevelLabel } from "@/types/courses";
import type { Contest } from "@/types/contests";
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
    <div className="container-app w-full min-w-0 py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-md border border-border-subtle bg-card p-5 shadow-card sm:p-6">
            <div className="text-xs text-muted-foreground">Corelia Academy</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {t("home.guest.heroTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("home.guest.heroSubtitle")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button render={<NavLink to="/courses" />} nativeButton={false}>
                {t("home.exploreCourses")}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                render={<NavLink to="/login" />}
                nativeButton={false}
                variant="outline"
              >
                {t("home.guest.signIn")}
              </Button>
            </div>
          </section>

          <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-foreground">Khoá học nổi bật</h2>
              <Button
                render={<NavLink to="/courses" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="-mr-2"
              >
                {t("home.sections.seeAll")}
                <ArrowRight className="size-4" />
              </Button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.length === 0 ? (
                <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center sm:py-16">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <BookOpen className="size-6 text-muted-foreground" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("home.sections.exploreTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("home.sections.startFromCatalogSubtitle")}
                    </p>
                  </div>
                  <Button size="sm" render={<NavLink to="/courses" />} nativeButton={false}>
                    {t("home.exploreCourses")}
                  </Button>
                </div>
              ) : (
                featuredCourses.map((course) => (
                  <NavLink
                    key={course.id}
                    to={`/courses/${course.slug || course.id}`}
                    className="group cursor-pointer overflow-hidden rounded-md border border-border-subtle bg-background transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-video bg-muted/40">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt=""
                          className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-medium leading-relaxed text-foreground">
                        {course.title}
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {getCourseLevelLabel(course.level)}
                      </div>
                    </div>
                  </NavLink>
                ))
              )}
            </div>
          </section>

          {contests.length > 0 ? (
            <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-foreground">{t("home.guest.openContestsTitle")}</h2>
                <Button
                  render={<NavLink to="/contests" />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="-mr-2"
                >
                  {t("home.sections.seeAll")}
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {contests.slice(0, 3).map((contest) => (
                  <NavLink
                    key={contest.id}
                    to={`/contests/${contest.id}`}
                    className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-border-subtle bg-background px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-medium text-foreground">
                        {contest.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {contest.tagline}
                      </div>
                      {contest.registration_deadline ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {t("home.pinned.contest.registrationDeadline", {
                            date: new Date(contest.registration_deadline).toLocaleDateString(intlLocale()),
                          })}
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </NavLink>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
            <div className="text-sm font-medium text-foreground">
              {t("home.guest.startLearningTitle")}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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

          <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <BookOpen className="size-4 shrink-0" aria-hidden />
              {t("home.guest.quickLinksTitle")}
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: t("home.allCourses"), to: "/courses" },
                { label: t("home.guest.quickLinks.contests"), to: "/contests" },
                { label: t("home.guest.quickLinks.cohorts"), to: "/cohorts" },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-md border border-border-subtle bg-background px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </NavLink>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

