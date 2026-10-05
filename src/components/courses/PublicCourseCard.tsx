import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { BookOpen, FileText, TimerIcon } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  formatCompactParticipantCount,
  type ParticipantPreviewData,
} from "@/components/participants/participantPreview";
import { cn } from "@/lib/utils";
import { formatDuration, getCourseLevelLabel, type Course } from "@/types/courses";

export function PublicCourseCard({ course, progress, participantPreview, variant = "default", lessonCount }: {
  course: Course;
  progress?: { enrolled: boolean; percent: number; completed: boolean };
  participantPreview: ParticipantPreviewData;
  variant?: "default" | "catalog";
  lessonCount?: number;
}) {
  const { t } = useTranslation("courses");
  const { t: tCommon } = useTranslation("common");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  return (
    <Link
      to={`/courses/${course.slug || course.id}`}
      className={cn(
        "motion-hover-course-card flex min-w-0 flex-col overflow-hidden focus-visible:outline-primary",
        variant === "catalog"
          ? "rounded-xl"
          : "rounded-2xl border border-border-subtle bg-surface-base",
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden bg-surface-raised",
          variant === "catalog" && "rounded-lg border border-border",
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center"><BookOpen className="size-10 text-foreground-muted" aria-hidden weight="duotone" /></div>
        {course.thumbnail_url && failedImage !== course.thumbnail_url ? <img src={course.thumbnail_url} alt="" loading="lazy" onError={() => setFailedImage(course.thumbnail_url ?? null)} className="relative size-full object-cover" /> : null}
      </div>
      <div className={variant === "catalog" ? "flex flex-1 flex-col p-4" : "flex flex-1 flex-col gap-3 p-5 sm:p-6"}>
        {variant === "catalog" ? (
          <>
            <div className="space-y-2">
              <h3 className="line-clamp-1 text-heading-medium font-display">{course.title}</h3>
              <div className="flex min-h-5 items-center gap-2 text-xs text-foreground-muted">
                <Badge size="xsmall" color="primary">
                  {getCourseLevelLabel(course.level)}
                </Badge>
                {lessonCount !== undefined ? (
                  <>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <FileText className="size-4" aria-hidden weight="duotone" />
                      {tCommon("home.meta.lessonCount", { count: lessonCount })}
                    </span>
                    <Separator orientation="vertical" className="h-5" />
                  </>
                ) : null}
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <TimerIcon className="size-4" aria-hidden weight="duotone" />
                  {formatDuration(Number(course.total_duration_seconds) || 0)}
                </span>
              </div>
            </div>
            <ParticipantSummary
              className="mt-4"
              count={participantPreview.count}
              participants={participantPreview.participants}
              summary={tCommon("home.meta.learners", {
                displayCount: formatCompactParticipantCount(participantPreview.count),
              })}
            />
          </>
        ) : (
          <>
            <span className="self-start rounded-full bg-primary-muted px-3 py-1 text-xs font-medium text-foreground">{getCourseLevelLabel(course.level)}</span>
            <h3 className="line-clamp-2 min-h-12 text-heading-medium font-display">{course.title}</h3>
            {course.short_description ? <p className="line-clamp-3 text-sm leading-6 text-foreground-muted">{course.short_description}</p> : null}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-sm text-foreground-muted"><TimerIcon className="size-4" aria-hidden weight="duotone" />{formatDuration(Number(course.total_duration_seconds) || 0)}</div>
            <ParticipantSummary
              count={participantPreview.count}
              participants={participantPreview.participants}
              summary={tCommon("home.meta.learners", {
                displayCount: formatCompactParticipantCount(participantPreview.count),
              })}
            />
          </>
        )}
        {variant !== "catalog" && progress?.enrolled ? <div className="space-y-2 border-t border-border-subtle pt-3">
          <div className="h-1 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={course.title}><div className="h-full bg-primary" style={{width: `${percent}%`}} /></div>
          <span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">{t(progress.completed ? "catalog.card.completed" : percent > 0 ? "catalog.card.continueLearning" : "catalog.card.startLearning")}<ArrowRight className="size-4 shrink-0" aria-hidden /></span>
        </div> : null}
      </div>
    </Link>
  );
}
