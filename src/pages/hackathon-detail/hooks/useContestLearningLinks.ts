import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { hackathonLearningLinksQueryOptions } from "@/features/hackathons/hackathonQueries";
import type { ResolvedLearningCourse } from "@/lib/hackathonLearning";
import type { Contest } from "@/types/hackathons";

const EMPTY_COURSES = new Map<string, ResolvedLearningCourse>();

export type { ResolvedLearningCourse };

export function useContestLearningLinks(contest: Contest) {
  const { officialId, courseIds } = useMemo(() => {
    const official =
      contest.official_course_id?.trim() || contest.officialCourseId?.trim() || "";
    const related = (contest.related_course_ids ?? contest.relatedCourseIds ?? [])
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
    return {
      officialId: official || null,
      courseIds: Array.from(new Set([...(official ? [official] : []), ...related])),
    };
  }, [contest]);

  const query = useQuery(hackathonLearningLinksQueryOptions(courseIds));
  return {
    officialId,
    coursesById: query.data ?? EMPTY_COURSES,
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
