import { Link } from "react-router";
import { BadgeCheck, Briefcase, Clock, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/types/courses";

import { useCareerTracksCatalog } from "./hooks/useCareerTracksCatalog";

export default function CareerListPage() {
  const { t } = useTranslation("career");
  const { tracks, loading, error, hasTracks } = useCareerTracksCatalog();

  if (loading) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-5 shrink-0 rounded-sm" />
            <Skeleton className="h-8 w-56 max-w-[70%] rounded-md" />
          </div>
          <Skeleton className="mt-1 h-4 w-72 max-w-full rounded" />
        </div>
        <Skeleton className="h-40 w-full rounded-md border border-border-subtle" />
        <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-md" />
          ))}
        </div>
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

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              {t("list.title")}
            </h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("list.subtitle")}
          </p>
        </div>
      </div>

      {!hasTracks ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-md border border-border-subtle bg-surface-base py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <Layers className="size-6 text-foreground-subtle" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("list.emptyTitle")}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {t("list.emptyDescription")}
            </p>
          </div>
          <Button
            render={<Link to="/courses" />}
            nativeButton={false}
            size="sm"
            variant="outline"
          >
            {t("list.browseCourses")}
          </Button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <Link
              key={track.id}
              to={
                track.owner_scope === "instructor" && track.instructorHandle
                  ? `/career/${encodeURIComponent(track.instructorHandle)}/${track.slug}`
                  : `/career/corelia/${track.slug}`
              }
              className="group cursor-pointer overflow-hidden rounded-md border border-border-subtle bg-surface-base text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-surface-raised"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-semibold leading-relaxed text-foreground">
                      {track.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-foreground-muted">
                      {track.description}
                    </div>
                  </div>

                  {track.has_certificate ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-muted px-2 py-1 text-[11px] font-medium text-primary">
                      <BadgeCheck className="size-3 shrink-0" aria-hidden />
                      {t("labels.certificate")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1 text-xs text-foreground-muted">
                    <Layers className="size-3 shrink-0" aria-hidden />
                    {t("labels.coursesCount", { count: track.courseCount })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1 text-xs text-foreground-muted">
                    <Clock className="size-3 shrink-0" aria-hidden />
                    {formatDuration(track.totalDurationSeconds)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

