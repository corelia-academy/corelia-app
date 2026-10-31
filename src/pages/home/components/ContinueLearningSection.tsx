import { AiCourseCover } from "@/components/courses/AiCourseCover";
import { FileText, MonitorPlay, TimerIcon } from "@phosphor-icons/react";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/imageUrl";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import { Chip } from "@/components/ui/chip";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { ProgressBar } from "@/components/ui/progress";
import { Timestamp } from "@/components/ui/timestamp";
import type { FocusCard } from "../utils/homeTypes";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { HomeCourseCardSkeletonRow } from "./HomeCourseCardSkeleton";

export function ContinueLearningSection({
  t,
  focusCards,
  enrolledCourseCount,
  loading = false,
}: {
  t: TFunction<"common">;
  focusCards: FocusCard[];
  enrolledCourseCount: number;
  loading?: boolean;
}) {
  const revealRef = useRevealOnScroll<HTMLElement>();
  const formatRemainingDuration = (seconds: number) => {
    const totalMinutes = Math.ceil(seconds / 60);

    return t("home.meta.remainingDuration", {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    });
  };

  return (
    <section ref={revealRef} className="motion-reveal mobile-bleed-surface px-5 sm:px-0">
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
          <Chip size="xsmall" shape="circle">
            {enrolledCourseCount}
          </Chip>
        ) : null}
      </div>

      {loading ? (
        <HomeCourseCardSkeletonRow />
      ) : focusCards.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-start gap-6">
          {focusCards.map((item) => (
            <NavLink
              key={item.id}
              to={item.action}
              className="motion-hover-card min-w-[240px] max-w-none sm:max-w-[335px] flex-[1_1_100%] sm:flex-[1_1_240px] @min-[504px]:@max-[807px]:flex-[1_1_240px]! overflow-hidden rounded-xl"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-raised">
                {item.courseType === "ai_generated" ? <AiCourseCover seed={item.id} className="absolute inset-0 size-full" /> : null}
                {item.thumbnailUrl ? (
                  <img
                    src={optimizedImageUrl(item.thumbnailUrl, { width: 335 })}
                    srcSet={optimizedImageSrcSet(item.thumbnailUrl, 335)}
                    decoding="async"
                    alt=""
                    loading="lazy"
                    className="relative size-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-4 p-4">
                <div className="flex h-[50px] flex-col gap-2 overflow-hidden">
                  <h3 className="line-clamp-1 text-lg font-display font-medium leading-tight text-foreground">
                    {item.title}
                  </h3>
                  <Timestamp
                    type="full"
                    className="min-w-0 flex-wrap gap-3 whitespace-normal"
                    date={
                      typeof item.lessonCount === "number" ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <FileText className="size-4" aria-hidden weight="duotone" />
                          {t("home.meta.lessonCount", { count: item.lessonCount })}
                        </span>
                      ) : null
                    }
                    time={
                      typeof item.remainingDurationSeconds === "number" ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <TimerIcon className="size-4 shrink-0" aria-hidden weight="duotone" />
                          {formatRemainingDuration(item.remainingDurationSeconds)}
                        </span>
                      ) : null
                    }
                  />
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

