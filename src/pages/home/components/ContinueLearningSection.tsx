import { FileText, MonitorPlay, TimerIcon } from "@phosphor-icons/react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Badge } from "@/components/ui/badge";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { ProgressBar } from "@/components/ui/progress";
import type { FocusCard } from "../utils/homeTypes";

export function ContinueLearningSection({
  t,
  focusCards,
  enrolledCourseCount,
}: {
  t: TFunction<"common">;
  focusCards: FocusCard[];
  enrolledCourseCount: number;
}) {
  const formatRemainingDuration = (seconds: number) => {
    const totalMinutes = Math.ceil(seconds / 60);

    return t("home.meta.remainingDuration", {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    });
  };

  return (
    <section className="mobile-bleed-surface px-5 sm:px-0">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <MonitorPlay
          aria-hidden="true"
          className="size-5 shrink-0 text-foreground-muted"
          weight="duotone"
        />
        <h2 className="text-body-large font-body font-medium text-foreground">
          {t("home.sections.enrolledCourses")}
        </h2>
        {enrolledCourseCount > 0 ? (
          <Badge color="gray" variant="filled" size="xsmall">
            {enrolledCourseCount}
          </Badge>
        ) : null}
      </div>

      {focusCards.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-start gap-6">
          {focusCards.map((item) => (
            <NavLink
              key={item.id}
              to={item.action}
              className="group min-w-[240px] max-w-none sm:max-w-[335px] flex-[1_1_100%] sm:flex-[1_1_240px] @min-[504px]:@max-[807px]:flex-[1_1_240px]! overflow-hidden rounded-xl transition-transform duration-200 ease-out hover:-translate-y-0.5"
            >
              <div className="aspect-video overflow-hidden rounded-lg border border-border bg-surface-raised">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-4 p-4">
                <div className="flex h-[50px] flex-col gap-2 overflow-hidden">
                  <h3 className="line-clamp-1 text-lg font-display font-medium leading-tight text-foreground">
                    {item.title}
                  </h3>
                  <div className="flex min-w-0 items-center gap-3 text-xs text-foreground-muted">
                    {typeof item.lessonCount === "number" ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                        <FileText className="size-4" aria-hidden weight="duotone" />
                        {t("home.meta.lessonCount", { count: item.lessonCount })}
                      </span>
                    ) : null}
                    {typeof item.remainingDurationSeconds === "number" ? (
                      <>
                        {typeof item.lessonCount === "number" ? (
                          <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                        ) : null}
                        <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                          <TimerIcon className="size-4 shrink-0" aria-hidden weight="duotone" />
                          {formatRemainingDuration(item.remainingDurationSeconds)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <div className="min-w-0 flex-1">
                    <ProgressBar
                      aria-label={t("home.sections.progress")}
                      className="h-2 w-full"
                      label={false}
                      progress={item.progress}
                      theme="Neutral"
                    />
                  </div>
                  <span className="shrink-0">{item.progress}%</span>
                </div>
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        <div className="flex h-[200px] w-full items-center justify-center p-6">
          <EmptyStateIllustration
            type="empty"
            size="tiny"
            description={t("home.sections.startFromCatalogTitle")}
          />
        </div>
      )}
    </section>
  );
}

