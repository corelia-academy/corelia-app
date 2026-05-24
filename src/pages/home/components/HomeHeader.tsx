import { ArrowRight } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FocusCard, PinnedProgramCard } from "../utils/homeTypes";

export function HomeHeader({
  t,
  loading,
  firstName,
  activePinnedProgram,
  featuredFocus,
}: {
  t: TFunction<"common">;
  loading: boolean;
  firstName: string;
  activePinnedProgram: PinnedProgramCard | null;
  featuredFocus: FocusCard | null;
}) {
  const featuredWrapperClassName = activePinnedProgram
    ? "rounded-lg border border-primary/20 ring-1 ring-brand-accent/10 transition-colors duration-300 hover:border-primary/50 hover:ring-brand-accent/25"
    : "rounded-lg border border-border-subtle";

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          {loading ? t("home.syncing") : t("home.dashboard")}
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-full max-w-md rounded" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("home.sections.greeting", { name: firstName })}
            </h1>
            <p className="text-sm leading-relaxed text-foreground-muted">
              {t("home.sections.greetingSubtitle")}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        {loading ? (
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-5 w-full max-w-sm rounded" />
            <Skeleton className="h-4 w-full max-w-md rounded" />
          </div>
        ) : activePinnedProgram ? (
          <div className={featuredWrapperClassName}>
            <div className="p-4">
              <div className="inline-flex items-center rounded-full border border-border bg-primary-muted px-3 py-1 text-xs font-medium text-primary">
                {activePinnedProgram.badge}
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                {activePinnedProgram.title}
              </div>
              <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
                {activePinnedProgram.description}
              </div>
              <div className="mt-3 text-xs text-foreground-muted">
                {activePinnedProgram.meta}
              </div>
            </div>
          </div>
        ) : featuredFocus ? (
          <div className={featuredWrapperClassName}>
            <div className="p-4">
              <div className="inline-flex items-center rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-medium text-foreground-muted">
                {featuredFocus.format === "online"
                  ? t("home.sections.featuredOnline")
                  : t("home.sections.featuredOffline")}
              </div>
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
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${featuredFocus.progress}%` }}
                  />
                </div>
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

        <div className="flex shrink-0 gap-2 sm:justify-end">
          {!loading ? (
            <>
              <Button
                render={
                  <NavLink to={activePinnedProgram?.to ?? featuredFocus?.action ?? "/courses"} />
                }
                nativeButton={false}
                size="sm"
              >
                {activePinnedProgram?.cta ??
                  (featuredFocus ? t("home.continueLearning") : t("home.exploreCourses"))}
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Button>
              <Button
                render={<NavLink to="/courses" />}
                nativeButton={false}
                variant="outline"
                size="sm"
              >
                {t("home.allCourses")}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

