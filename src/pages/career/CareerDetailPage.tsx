import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Clock,
  Layers,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import NotFound from "@/pages/NotFound";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseSponsorsPanel } from "@/pages/course-details/components/CourseSponsorsPanel";
import { CoursePartnerBrandPanel } from "@/pages/course-details/components/CoursePartnerBrandPanel";
import { formatDuration } from "@/types/courses";
import { useAuth } from "@/stores/authStore";

import { useCareerTrackDetail } from "./hooks/useCareerTrackDetail";
import { useCareerTrackProgress } from "./hooks/useCareerTrackProgress";
import { usePageMeta } from "@/hooks/usePageMeta";
import { normalizeYoutubeVideoId } from "@/lib/youtubeVideoId";

export default function CareerDetailPage() {
  const { t } = useTranslation("career");
  const { slug } = useParams<{ slug?: string }>();
  const { track, loading, error } = useCareerTrackDetail(slug);
  const { profile } = useAuth();

  const courseIds = useMemo(
    () => track?.includedCourses.map((c) => c.course.id) ?? [],
    [track],
  );
  const { progressByCourse } = useCareerTrackProgress(courseIds, profile?.id);

  const continueTarget = useMemo(() => {
    if (!track) return null;
    let best: { courseId: string; percent: number } | null = null;
    for (const c of track.includedCourses) {
      const p = progressByCourse.get(c.course.id);
      if (!p) continue;
      if (p.progressPercent >= 100) continue;
      if (!best || p.progressPercent > best.percent) {
        best = { courseId: c.course.id, percent: p.progressPercent };
      }
    }
    if (best) return best.courseId;
    const firstEnrolled = track.includedCourses.find((c) =>
      progressByCourse.has(c.course.id),
    );
    return firstEnrolled?.course.id ?? null;
  }, [track, progressByCourse]);

  usePageMeta({
    title: track?.title ?? undefined,
    description: track?.short_description ?? track?.description ?? undefined,
    image: track?.thumbnail_url ?? undefined,
    url: window.location.href,
  });

  if (loading) {
    return (
      <div className="container-app py-6 sm:py-8">
        <Skeleton className="h-48 w-full rounded-2xl border border-border-subtle" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
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

  if (!track) return <NotFound />;

  return (
    <div className="container-app py-6 sm:py-8">
      <CareerHero track={track} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <main className="min-w-0 space-y-6">
          {track.what_youll_learn.length > 0 ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-[18px] font-semibold text-foreground">
                  {t("detail.whatYoullLearn")}
                </h2>
                <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
                  {track.what_youll_learn.map((item, idx) => (
                    <li
                      key={`${idx}-${item}`}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/50" />
                      <span className="leading-7">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {track.description?.trim() ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-[18px] font-semibold text-foreground">
                  {t("detail.description")}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground-muted">
                  {track.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-6">
              <h2 className="text-[18px] font-semibold text-foreground">
                {t("detail.includedCourses")}
              </h2>
              <ul className="mt-4 space-y-3">
                {track.includedCourses.map((item) => {
                  const progress = progressByCourse.get(item.course.id) ?? null;
                  return (
                    <li key={item.course.id}>
                      <CourseRow course={item.course} progress={progress} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {track.prerequisites.length > 0 ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-[18px] font-semibold text-foreground">
                  {t("detail.prerequisites")}
                </h2>
                <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
                  {track.prerequisites.map((item, idx) => (
                    <li
                      key={`${idx}-${item}`}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/50" />
                      <span className="leading-7">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <CareerActionPanel
            continueCourseId={continueTarget}
            totalCourses={track.courseCount}
          />
          <CoursePartnerBrandPanel
            course={{
              partner_brand: track.partner_brand ?? null,
              partners: track.partners ?? [],
            }}
          />
          <CourseSponsorsPanel sponsors={track.sponsors ?? []} />
        </aside>
      </div>
    </div>
  );
}

function CareerHero({
  track,
}: {
  track: NonNullable<ReturnType<typeof useCareerTrackDetail>["track"]>;
}) {
  const { t } = useTranslation("career");
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailSrc =
    track.thumbnail_url && track.thumbnail_url.trim() && !thumbnailFailed
      ? track.thumbnail_url
      : null;
  const youtubeVideoId =
    track.hero_media_type === "youtube"
      ? normalizeYoutubeVideoId(track.hero_youtube_video_id ?? track.hero_youtube_url ?? "")
      : null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {track.has_certificate ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-muted px-2.5 py-1 text-[11px] font-medium text-primary">
                <BadgeCheck className="size-3 shrink-0" aria-hidden />
                {t("labels.certificateIncluded")}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {track.title}
          </h1>

          {track.short_description ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              {track.short_description}
            </p>
          ) : null}

          <dl className="mt-6 grid grid-cols-1 gap-2 rounded-md bg-surface-raised p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground-muted">
                {t("detail.stats.courses")}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {t("labels.coursesCount", { count: track.courseCount })}
              </dd>
            </div>
            {track.totalDurationSeconds > 0 ? (
              <div>
                <dt className="text-foreground-muted">
                  {t("detail.stats.duration")}
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatDuration(track.totalDurationSeconds)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        {youtubeVideoId ? (
          <div className="aspect-video w-full self-start overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0`}
              title={`${track.title} video`}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="relative aspect-video w-full self-start overflow-hidden rounded-md border border-border-subtle bg-surface-raised">
            <img
              src="/Corelia_Banner_Square.png"
              alt=""
              aria-hidden
              decoding="async"
              className="absolute inset-0 size-full object-cover opacity-90"
            />
            {thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                alt={track.title}
                loading="lazy"
                decoding="async"
                onError={() => setThumbnailFailed(true)}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-center gap-2 rounded-full bg-surface-base/70 px-3 py-1 text-xs font-medium text-foreground-muted backdrop-blur">
                  <Layers className="size-4" aria-hidden />
                  {t("detail.thumbnailFallback")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CareerActionPanel({
  continueCourseId,
  totalCourses,
}: {
  continueCourseId: string | null;
  totalCourses: number;
}) {
  const { t } = useTranslation("career");
  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
      <div className="border-b border-border-subtle bg-surface-raised px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">
          {t("detail.actionPanel.ready")}
        </h3>
      </div>
      <div className="p-4">
        <p className="mb-4 text-sm leading-relaxed text-foreground-muted">
          {continueCourseId
            ? t("detail.actionPanel.continueLabel")
            : t("detail.actionPanel.exploreCopy")}
        </p>
        {continueCourseId ? (
          <Button
            render={<Link to={`/learn/${continueCourseId}`} />}
            nativeButton={false}
            className="w-full"
            size="default"
          >
            {t("detail.continueButton")}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            render={<Link to="/courses" />}
            nativeButton={false}
            className="w-full"
            size="default"
            variant="outline"
          >
            <BookOpen className="size-4" />
            {t("actions.browseCourses")}
          </Button>
        )}
        <p className="mt-3 text-xs text-foreground-subtle">
          {t("labels.coursesCount", { count: totalCourses })}
        </p>
      </div>
    </div>
  );
}

function CourseRow({
  course,
  progress,
}: {
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnail_url: string;
    total_duration_seconds: number;
    short_description?: string;
  };
  progress: {
    enrolled: boolean;
    completedLessons: number;
    totalLessons: number;
    progressPercent: number;
  } | null;
}) {
  const { t } = useTranslation("career");
  const detailHref = `/courses/${course.slug || course.id}`;
  const continueHref = `/learn/${course.id}`;
  const isStarted = progress && progress.progressPercent > 0;
  const isCompleted = progress && progress.progressPercent >= 100;
  const primaryHref = progress && !isCompleted ? continueHref : detailHref;
  const primaryLabel = isCompleted
    ? t("detail.viewCourseButton")
    : progress
      ? isStarted
        ? t("detail.continueButton")
        : t("detail.startButton")
      : t("detail.viewCourseButton");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-base p-3 sm:flex-row sm:items-stretch">
      <Link
        to={detailHref}
        className="block aspect-video w-full shrink-0 overflow-hidden rounded-md bg-surface-raised sm:w-40"
      >
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-foreground-subtle">
            <BookOpen className="size-6" aria-hidden />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0">
          <Link
            to={detailHref}
            className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
          >
            {course.title}
          </Link>
          {course.short_description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
              {course.short_description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-foreground-subtle">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {formatDuration(Number(course.total_duration_seconds) || 0)}
            </span>
          </div>
        </div>

        {progress ? (
          <div className="mt-3 rounded-md bg-surface-raised p-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-foreground-muted">
              <span>{t("detail.courseProgress")}</span>
              <span>{progress.progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-base">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <Button
            render={<Link to={primaryHref} />}
            nativeButton={false}
            size="sm"
            variant={progress && !isCompleted ? "default" : "outline"}
          >
            {primaryLabel}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
