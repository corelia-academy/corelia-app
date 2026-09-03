import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { hackathonLearningLinksQueryOptions } from "@/features/hackathons/hackathonQueries";
import type {
  ResolvedLearningCourse,
  ResolvedLearningTrack,
} from "@/lib/hackathonLearning";
import type { Contest } from "@/types/hackathons";

const EMPTY_COURSES = new Map<string, ResolvedLearningCourse>();
const EMPTY_TRACKS = new Map<string, ResolvedLearningTrack>();

export type { ResolvedLearningCourse, ResolvedLearningTrack };

export function careerTrackHref(track: ResolvedLearningTrack): string {
  return `/career/${encodeURIComponent(track.slug)}`;
}

export function useContestLearningLinks(contest: Contest) {
  const { officialId, courseIds, trackIds } = useMemo(() => {
    const official =
      contest.official_course_id?.trim() || contest.officialCourseId?.trim() || "";
    const related = (contest.related_course_ids ?? contest.relatedCourseIds ?? [])
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
    const tracks = (
      contest.related_career_track_ids ?? contest.relatedCareerTrackIds ?? []
    )
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
    return {
      officialId: official || null,
      courseIds: Array.from(new Set([...(official ? [official] : []), ...related])),
      trackIds: Array.from(new Set(tracks)),
    };
  }, [contest]);

  const query = useQuery(hackathonLearningLinksQueryOptions(courseIds, trackIds));
  return {
    officialId,
    coursesById: query.data?.coursesById ?? EMPTY_COURSES,
    tracksById: query.data?.tracksById ?? EMPTY_TRACKS,
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
