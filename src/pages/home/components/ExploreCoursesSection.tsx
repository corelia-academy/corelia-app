import { ArrowRight, BookOpen } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import type { Course } from "@/types/courses";
import { getCourseLevelLabel } from "@/types/courses";

export function ExploreCoursesSection({
  t,
  courseCatalog,
}: {
  t: TFunction<"common">;
  courseCatalog: Course[];
}) {
  return (
    <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{t("home.sections.exploreTitle")}</h2>
        <Button
          render={<NavLink to="/courses" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-mr-2"
        >
          {t("home.sections.goToLibrary")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(courseCatalog ?? []).length === 0 ? (
          <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center sm:py-16">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t("home.sections.exploreTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("home.sections.startFromCatalogSubtitle")}
              </p>
            </div>
            <Button size="sm" render={<NavLink to="/courses" />} nativeButton={false}>
              {t("home.exploreCourses")}
            </Button>
          </div>
        ) : (
          (courseCatalog ?? []).slice(0, 4).map((course) => (
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
  );
}

