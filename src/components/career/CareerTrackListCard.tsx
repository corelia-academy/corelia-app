import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Clock, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CareerTrackDetail } from "@/types/career";
import { formatDuration } from "@/types/courses";

export function CareerTrackListCard({ track }: { track: CareerTrackDetail }) {
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
      className="group grid cursor-pointer overflow-hidden rounded-2xl border border-border-subtle bg-surface-base text-foreground transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:border-border hover:bg-surface-raised md:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]"
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

      <div className="flex min-w-0 flex-col p-5 sm:p-6">
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
