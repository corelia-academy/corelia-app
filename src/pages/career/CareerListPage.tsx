import { Link } from "react-router";
import { Briefcase, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CareerTrackListCard } from "@/components/career/CareerTrackListCard";

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
            <h1 className="truncate text-heading-large font-display text-foreground">
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
