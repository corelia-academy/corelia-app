import { Link, useParams } from "react-router";
import { BadgeCheck, BookOpen, Clock, Dot } from "lucide-react";
import { useTranslation } from "react-i18next";

import NotFound from "@/pages/NotFound";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/types/courses";

import { useCareerTrackDetail } from "./hooks/useCareerTrackDetail";

export default function CareerDetailPage() {
  const { t } = useTranslation("career");
  const { handle, slug } = useParams<{ handle?: string; slug?: string }>();
  const isCorelia = handle?.trim().toLowerCase() === "corelia";
  const { track, loading, error } = useCareerTrackDetail(
    isCorelia
      ? { owner_scope: "corelia", slug }
      : { owner_scope: "instructor", handle, slug },
  );

  if (loading) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80 max-w-full rounded-md" />
          <Skeleton className="h-4 w-2xl max-w-full rounded" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
        <Skeleton className="mt-6 h-72 w-full rounded-md border border-border-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-5">
          <p className="text-sm font-medium text-destructive">
            {t("errors.loadErrorTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-destructive/90">
            {error}
          </p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        </div>
      </div>
    );
  }

  if (!track) return <NotFound />;

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {track.title}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">{track.description}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1 text-xs text-foreground-muted">
            <BookOpen className="size-3 shrink-0" aria-hidden />
            {t("labels.coursesCount", { count: track.courseCount })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1 text-xs text-foreground-muted">
            <Clock className="size-3 shrink-0" aria-hidden />
            {formatDuration(track.totalDurationSeconds)}
          </span>
          {track.has_certificate ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-muted px-2 py-1 text-xs font-medium text-primary">
              <BadgeCheck className="size-3 shrink-0" aria-hidden />
              {t("labels.certificateIncluded")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1 text-xs text-foreground-muted">
              <BadgeCheck className="size-3 shrink-0" aria-hidden />
              {t("labels.certificateNotIncluded")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-md border border-border-subtle bg-surface-base p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t("detail.whatYoullLearn")}
            </h2>
            <Separator className="my-3" />
            {track.what_youll_learn.length ? (
              <ul className="space-y-2 text-sm text-foreground">
                {track.what_youll_learn.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <Dot className="mt-0.5 size-4 text-foreground-muted" aria-hidden />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">
                {t("detail.emptyWhatYoullLearn")}
              </p>
            )}
          </section>

          <section className="rounded-md border border-border-subtle bg-surface-base p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t("detail.includedCourses")}
            </h2>
            <Separator className="my-3" />
            <div className="space-y-2">
              {track.includedCourses.map((item) => (
                <Link
                  key={item.course.id}
                  to={`/courses/${item.course.slug || item.course.id}`}
                  className="group flex items-center gap-3 rounded-md border border-border-subtle bg-surface-base px-3 py-2 transition-colors duration-150 hover:bg-surface-raised"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-md bg-surface-raised">
                    <img
                      src={item.course.thumbnail_url}
                      alt={item.course.title}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-foreground">
                      {item.course.title}
                    </div>
                    <div className="mt-1 text-xs text-foreground-muted">
                      {formatDuration(Number(item.course.total_duration_seconds) || 0)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-md border border-border-subtle bg-surface-base p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t("detail.prerequisites")}
            </h2>
            <Separator className="my-3" />
            {track.prerequisites.length ? (
              <ul className="space-y-2 text-sm text-foreground">
                {track.prerequisites.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <Dot className="mt-0.5 size-4 text-foreground-muted" aria-hidden />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">
                {t("detail.emptyPrerequisites")}
              </p>
            )}
          </section>

          <section className="rounded-md border border-border-subtle bg-surface-base p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t("detail.nextSteps")}
            </h2>
            <Separator className="my-3" />
            <div className="flex flex-col gap-2">
              <Button
                render={<Link to="/courses" />}
                nativeButton={false}
                variant="outline"
                size="sm"
              >
                {t("actions.browseCourses")}
              </Button>
              <Button
                render={<Link to="/career" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
              >
                {t("actions.backToList")}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

