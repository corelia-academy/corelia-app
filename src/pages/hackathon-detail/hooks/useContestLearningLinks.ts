import { useEffect, useMemo, useState } from "react";
import { getCourse } from "@/lib/courses";
import { supabase } from "@/lib/supabase";
import type { Contest } from "@/types/hackathons";

export type ResolvedLearningCourse = {
  id: string;
  slug: string;
  title: string;
};

export type ResolvedLearningTrack = {
  id: string;
  slug: string;
  title: string;
  owner_scope: "corelia" | "instructor";
  instructorHandle: string | null;
};

export function careerTrackHref(track: ResolvedLearningTrack): string | null {
  if (track.owner_scope === "corelia") {
    return `/career/corelia/${encodeURIComponent(track.slug)}`;
  }
  const handle = track.instructorHandle?.trim();
  if (!handle) return null;
  return `/career/${encodeURIComponent(handle)}/${encodeURIComponent(track.slug)}`;
}

export function useContestLearningLinks(contest: Contest) {
  const { officialId, courseIds, trackIds } = useMemo(() => {
    const official =
      contest.official_course_id?.trim() ||
      contest.officialCourseId?.trim() ||
      "";
    const relatedRaw =
      contest.related_course_ids ?? contest.relatedCourseIds ?? ([] as string[]);
    const related = relatedRaw
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
    const trackRaw =
      contest.related_career_track_ids ??
      contest.relatedCareerTrackIds ??
      ([] as string[]);
    const tracks = trackRaw
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
    const courseSet = new Set<string>();
    if (official) courseSet.add(official);
    for (const id of related) courseSet.add(id);
    return {
      officialId: official || null,
      courseIds: Array.from(courseSet),
      trackIds: Array.from(new Set(tracks)),
    };
  }, [contest]);

  const [coursesById, setCoursesById] = useState<
    Map<string, ResolvedLearningCourse>
  >(new Map());
  const [tracksById, setTracksById] = useState<
    Map<string, ResolvedLearningTrack>
  >(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (courseIds.length === 0 && trackIds.length === 0) {
      setCoursesById(new Map());
      setTracksById(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const coursePairs = await Promise.all(
          courseIds.map(async (id) => {
            const row = await getCourse(id).catch(() => null);
            if (!row?.slug?.trim() || !row.title?.trim()) return null;
            return [
              id,
              {
                id: row.id,
                slug: row.slug.trim(),
                title: row.title.trim(),
              } satisfies ResolvedLearningCourse,
            ] as const;
          }),
        );

        const cmap = new Map<string, ResolvedLearningCourse>();
        for (const pair of coursePairs) {
          if (pair) cmap.set(pair[0], pair[1]);
        }

        const tmap = new Map<string, ResolvedLearningTrack>();
        if (trackIds.length > 0) {
          const { data, error } = await supabase
            .from("career_tracks")
            .select("id, slug, title, owner_scope, instructor_id, published")
            .in("id", trackIds);

          if (!error && data?.length) {
            const rows = data as Array<{
              id: string;
              slug: string;
              title: string;
              owner_scope: string;
              instructor_id: string | null;
              published: boolean;
            }>;

            const instructorIds = Array.from(
              new Set(
                rows
                  .filter((r) => r.owner_scope === "instructor" && r.instructor_id)
                  .map((r) => r.instructor_id as string),
              ),
            );

            const handleByInstructor = new Map<string, string>();
            if (instructorIds.length > 0) {
              const { data: profiles } = await supabase
                .from("public_profiles")
                .select("id, username, ocid")
                .in("id", instructorIds);

              for (const p of profiles ?? []) {
                const row = p as {
                  id: string;
                  username: string | null;
                  ocid: string | null;
                };
                const h =
                  (row.username ?? "").trim() || (row.ocid ?? "").trim();
                if (h) handleByInstructor.set(row.id, h);
              }
            }

            for (const row of rows) {
              if (!row.published) continue;
              const scope =
                row.owner_scope === "instructor" ? "instructor" : "corelia";
              const instructorHandle =
                scope === "instructor" && row.instructor_id
                  ? handleByInstructor.get(row.instructor_id) ?? null
                  : null;
              tmap.set(row.id, {
                id: row.id,
                slug: row.slug,
                title: row.title,
                owner_scope: scope,
                instructorHandle,
              });
            }
          }
        }

        if (!cancelled) {
          setCoursesById(cmap);
          setTracksById(tmap);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseIds, trackIds]);

  return {
    officialId,
    coursesById,
    tracksById,
    loading,
  };
}
