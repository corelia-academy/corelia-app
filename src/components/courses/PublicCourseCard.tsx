import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDuration, getCourseLevelLabel, type Course } from "@/types/courses";

export function PublicCourseCard({ course, progress }: {
  course: Course;
  progress?: { enrolled: boolean; percent: number };
}) {
  const { t } = useTranslation("courses");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  return (
    <Link to={`/courses/${course.slug || course.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base transition-colors hover:border-primary/40 focus-visible:outline-primary">
      <div className="relative aspect-video overflow-hidden bg-surface-raised">
        <div className="absolute inset-0 flex items-center justify-center"><BookOpen className="size-10 text-foreground-muted" aria-hidden /></div>
        {course.thumbnail_url && failedImage !== course.thumbnail_url ? <img src={course.thumbnail_url} alt="" loading="lazy" onError={() => setFailedImage(course.thumbnail_url ?? null)} className="relative size-full object-cover" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <span className="self-start rounded-full bg-primary-muted px-3 py-1 text-xs font-medium text-foreground">{getCourseLevelLabel(course.level)}</span>
        <h3 className="line-clamp-2 min-h-12 text-heading-medium font-display">{course.title}</h3>
        {course.short_description ? <p className="line-clamp-3 text-sm leading-6 text-foreground-muted">{course.short_description}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-sm text-foreground-muted"><Clock className="size-4" aria-hidden />{formatDuration(Number(course.total_duration_seconds) || 0)}</div>
        {progress?.enrolled ? <div className="space-y-2 border-t border-border-subtle pt-3">
          <div className="h-1 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={course.title}><div className="h-full bg-primary" style={{width: `${percent}%`}} /></div>
          <span className="flex items-center justify-between gap-2 text-sm font-medium text-primary">{t(percent > 0 ? "catalog.card.continueLearning" : "catalog.card.startLearning")}<ArrowRight className="size-4 shrink-0" aria-hidden /></span>
        </div> : null}
      </div>
    </Link>
  );
}
