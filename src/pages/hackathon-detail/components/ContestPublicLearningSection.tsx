import { useMemo } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Contest } from "@/types/hackathons";
import {
  careerTrackHref,
  useContestLearningLinks,
} from "@/pages/hackathon-detail/hooks/useContestLearningLinks";
import { cn } from "@/lib/utils";

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
    <Card id="learn" className={cn("scroll-mt-36")}>
      <CardContent className="space-y-6 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("detail.learn.sectionTitle")}
          </h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {t("detail.learn.sectionDescription")}
          </p>
        </div>

        {showOfficial ? (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("detail.learn.officialBadge")}
            </div>
            <p className="mt-2 text-sm text-foreground-muted">
              {t("detail.learn.officialHint")}
            </p>
            {loading ? (
              <p className="mt-4 text-xs text-foreground-muted">
                {t("detail.learn.loading")}
              </p>
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
              <p className="mt-3 text-xs text-foreground-muted">
                {t("detail.learn.loading")}
              </p>
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
              <p className="mt-3 text-xs text-foreground-muted">
                {t("detail.learn.loading")}
              </p>
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
      </CardContent>
    </Card>
  );
}
