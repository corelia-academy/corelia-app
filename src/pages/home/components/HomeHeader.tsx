import { ArrowRight } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { FocusCard } from "../utils/homeTypes";

export function HomeHeader({
  t,
  loading,
  firstName,
  featuredFocus,
}: {
  t: TFunction<"common">;
  loading: boolean;
  firstName: string;
  featuredFocus?: FocusCard | null;
}) {
  const featuredWrapperClassName = "sm:rounded-lg sm:bg-surface-raised/50";

  return (
    <section className="mobile-bleed-surface bg-surface-base shadow-card px-5 pt-5 pb-4 sm:px-0 sm:py-0">
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            {t("home.syncing")} {/*t("home.dashboard")*/}
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-full max-w-md rounded" />
          </div>
        ) : (
          <>
            <h1 className="text-heading-large font-display text-foreground">
              {t("home.sections.greeting", { name: firstName })}
            </h1>
            <p className="text-body-large text-catalog-subtitle">
              {t("home.sections.greetingSubtitle")}
            </p>
          </>
        )}
      </div>

      {featuredFocus !== undefined ? (
        <div className="mt-4 flex flex-col gap-3">
          {loading ? (
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-5 w-full max-w-sm rounded" />
              <Skeleton className="h-4 w-full max-w-md rounded" />
            </div>
          ) : featuredFocus ? (
            <div className={featuredWrapperClassName}>
              <div className="px-0 py-3 sm:p-4">
                <Chip size="xsmall" shape="circle">
                  {featuredFocus.format === "online"
                    ? t("home.sections.featuredOnline")
                    : t("home.sections.featuredOffline")}
                </Chip>
                <div className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                  {featuredFocus.title}
                </div>
                <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
                  {featuredFocus.nextStep}
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-foreground-muted">
                    <span>{t("home.sections.progress")}</span>
                    <span>{featuredFocus.progress}%</span>
                  </div>
                  <ProgressBar
                    aria-label={t("home.sections.progress")}
                    className="mt-2 h-2 w-full"
                    label={false}
                    progress={featuredFocus.progress}
                    theme="Accent"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {t("home.sections.startFromCatalogTitle")}
              </div>
              <div className="mt-1 text-sm leading-relaxed text-foreground-muted">
                {t("home.sections.startFromCatalogSubtitle")}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {!loading ? (
              <>
                <Button
                  render={
                    <NavLink to={featuredFocus?.action ?? "/courses"} />
                  }
                  nativeButton={false}
                  size="small"
                >
                  {featuredFocus
                    ? featuredFocus.completed
                      ? t("home.viewCourse")
                      : t("home.continueLearning")
                    : t("home.exploreCourses")}
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Button>
                <Button
                  render={<NavLink to="/courses" />}
                  nativeButton={false}
                  variant="cta" hierarchy="secondary"
                  size="small"
                >
                  {t("home.allCourses")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
