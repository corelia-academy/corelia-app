import { useMemo } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";
import {
  careerTrackHref,
  useContestLearningLinks,
} from "@/pages/hackathon-detail/hooks/useContestLearningLinks";

export function ContestPublicLearningSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  const { officialId, coursesById, tracksById, loading } =
    useContestLearningLinks(contest);

  const relatedCourseIds = useMemo(() => {
    const raw =
      contest.related_course_ids ?? contest.relatedCourseIds ?? ([] as string[]);
    const ids = raw
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
    const off = officialId?.trim() ?? "";
    if (!off) return ids;
    return ids.filter((id) => id !== off);
  }, [contest, officialId]);

  const trackIdsOrdered = useMemo(() => {
    const raw =
      contest.related_career_track_ids ??
      contest.relatedCareerTrackIds ??
      ([] as string[]);
    return Array.from(
      new Set(
        raw
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean),
      ),
    );
  }, [contest]);

  const showOfficial = Boolean(officialId);
  const showRelated = relatedCourseIds.length > 0;
  const showTracks = trackIdsOrdered.length > 0;

  if (!showOfficial && !showRelated && !showTracks) return null;

  const officialCourse = officialId ? coursesById.get(officialId) : undefined;

  return (
    <HackathonSectionCard
      id="learn"
      title={t("detail.learn.sectionTitle")}
      description={t("detail.learn.sectionDescription")}
    >
      <div className="space-y-6">
        {showOfficial ? (
          <div className="rounded-md border border-border-subtle bg-surface-raised p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {t("detail.learn.officialBadge")}
            </div>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("detail.learn.officialHint")}
            </p>
            {loading ? (
              <div className="mt-4 space-y-2" aria-busy="true">
                <Skeleton className="h-11 w-40" />
              </div>
            ) : officialCourse ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-4 min-h-11"
                nativeButton={false}
                render={
                  <Link to={`/courses/${encodeURIComponent(officialCourse.slug)}`} />
                }
              >
                {t("detail.learn.openCourse")}
              </Button>
            ) : (
              <Button type="button" variant="secondary" className="mt-4 min-h-11" disabled>
                {t("detail.learn.courseUnavailable")}
              </Button>
            )}
          </div>
        ) : null}

        {showRelated ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("detail.learn.relatedCoursesTitle")}
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("detail.learn.relatedCoursesHint", {
                count: relatedCourseIds.length,
              })}
            </p>
            {loading ? (
              <div className="mt-3 space-y-2" aria-busy="true">
                {Array.from({ length: Math.min(3, relatedCourseIds.length) }).map((_, idx) => (
                  <Skeleton key={idx} className="h-5 w-full max-w-sm" />
                ))}
              </div>
            ) : (
              <ul className="mt-3 list-none space-y-2 p-0">
                {relatedCourseIds.map((id) => {
                  const c = coursesById.get(id);
                  return (
                    <li key={id}>
                      {c ? (
                        <Link
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          to={`/courses/${encodeURIComponent(c.slug)}`}
                        >
                          {c.title}
                        </Link>
                      ) : (
                        <span className="text-sm text-foreground-muted">
                          {t("detail.learn.courseUnavailable")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {showTracks ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("detail.learn.relatedTracksTitle")}
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("detail.learn.relatedTracksHint", {
                count: trackIdsOrdered.length,
              })}
            </p>
            {loading ? (
              <div className="mt-3 space-y-2" aria-busy="true">
                {Array.from({ length: Math.min(3, trackIdsOrdered.length) }).map((_, idx) => (
                  <Skeleton key={idx} className="h-5 w-full max-w-sm" />
                ))}
              </div>
            ) : (
              <ul className="mt-3 list-none space-y-2 p-0">
                {trackIdsOrdered.map((id) => {
                  const tr = tracksById.get(id);
                  const href = tr ? careerTrackHref(tr) : null;
                  return (
                    <li key={id}>
                      {tr && href ? (
                        <Link
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          to={href}
                        >
                          {tr.title}
                        </Link>
                      ) : (
                        <span className="text-sm text-foreground-muted">
                          {t("detail.learn.trackUnavailable")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </HackathonSectionCard>
  );
}
