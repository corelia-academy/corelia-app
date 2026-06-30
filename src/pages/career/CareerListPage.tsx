import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Briefcase, Clock, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CareerTrackDetail } from "@/types/career";
import { formatDuration } from "@/types/courses";

import { useCareerTracksCatalog } from "./hooks/useCareerTracksCatalog";

function CareerTrackListCard({ track }: { track: CareerTrackDetail }) {
  const { t } = useTranslation("career");
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailSrc =
    track.thumbnail_url && track.thumbnail_url.trim() && !thumbnailFailed
      ? track.thumbnail_url
      : null;
  const summary = track.short_description?.trim() || track.description?.trim();

  return (
    <Link
      to={`/career/${track.slug}`}
      className="group grid cursor-pointer overflow-hidden rounded-2xl border border-border-subtle bg-surface-base text-foreground shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:bg-surface-raised md:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]"
    >
      <div className="relative aspect-video min-h-48 overflow-hidden border-b border-border-subtle bg-surface-raised md:aspect-auto md:min-h-64 md:border-b-0 md:border-r">
        <img
          src="/Corelia_Banner_Square.png"
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={track.title}
            loading="lazy"
            decoding="async"
            onError={() => setThumbnailFailed(true)}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-background/10">
            <div className="flex items-center gap-2 rounded-full bg-surface-base/75 px-3 py-1 text-xs font-medium text-foreground-muted backdrop-blur">
              <Layers className="size-4" aria-hidden />
              {t("detail.thumbnailFallback")}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col p-4 sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {track.has_certificate ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-muted px-2.5 py-1 text-[11px] font-medium text-primary">
              <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
              {t("labels.certificate")}
            </span>
          ) : null}
        </div>

        <h2 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {track.title}
        </h2>

        {summary ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground-muted">
            {summary}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-raised px-2.5 py-1.5 text-xs text-foreground-muted">
            <Layers className="size-3.5 shrink-0" aria-hidden />
            {t("labels.coursesCount", { count: track.courseCount })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-raised px-2.5 py-1.5 text-xs text-foreground-muted">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {formatDuration(track.totalDurationSeconds)}
          </span>
        </div>

        <div className="mt-auto pt-5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            {t("actions.viewTrack")}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

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
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[360px] w-full rounded-2xl border border-border-subtle md:h-64"
            />
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
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card py-16 text-center">
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
        <div className="mt-5 space-y-4">
          {tracks.map((track) => (
            <CareerTrackListCard key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
