import type { ArtifactField } from "@/features/learning/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect } from "react";
import { invalidateLearningProgress } from "@/features/learning/invalidateLearningProgress";

import {
  courseKeys,
  courseSubmissionQueryOptions,
} from "@/features/courses/courseQueries";
import { getSubmission, submitFinalAssignment } from "@/lib/finalAssignment";

type SubmissionRow = Awaited<ReturnType<typeof getSubmission>>;

interface UseLearnSubmissionInput {
  courseId: string | undefined;
  profileId: string | undefined;
  viewer?: User | null;
}

interface UseLearnSubmissionResult {
  submission: SubmissionRow;
  state: "loading" | "error" | "ready";
  refresh: () => Promise<SubmissionRow>;
  submit: (input: {
    content: string;
    fileUrls?: string[];
    artifacts?: Partial<Record<ArtifactField, string>>;
    requestId?: string;
  }) => Promise<NonNullable<SubmissionRow>>;
  setSubmission: (value: SubmissionRow) => void;
}

export function useLearnSubmission({
  courseId,
  profileId,
  viewer,
}: UseLearnSubmissionInput): UseLearnSubmissionResult {
  const queryClient = useQueryClient();
  const submissionQuery = useQuery(
    courseSubmissionQueryOptions(profileId, courseId),
  );
  const submissionKey =
    profileId && courseId ? courseKeys.submission(profileId, courseId) : null;
  const status = submissionQuery.data?.status;
  useEffect(() => {
    if (status === "approved" && profileId && courseId) {
      void invalidateLearningProgress(queryClient, profileId, courseId);
    }
  }, [status, profileId, courseId, queryClient]);
  const submitMutation = useMutation({
    mutationFn: async (input: { content: string; fileUrls?: string[]; artifacts?: Partial<Record<ArtifactField, string>>; requestId?: string }) => {
      if (!courseId) throw new Error("Missing courseId");
      return submitFinalAssignment(
        courseId,
        input.content.trim(),
        input.fileUrls?.length ? input.fileUrls : undefined,
        viewer,
        input.artifacts,
        input.requestId,
      );
    },
    onSuccess: (row) => {
      // Mutation observers receive new options when the route/session changes.
      // The response belongs to its original learner/course, not the latest UI.
      queryClient.setQueryData(courseKeys.submission(row.user_id, row.course_id), row);
    },
  });

  const refresh = useCallback(async () => {
    if (!courseId || !profileId) return null;
    const result = await submissionQuery.refetch();
    return result.data ?? null;
  }, [courseId, profileId, submissionQuery]);
  const setSubmission = useCallback(
    (value: SubmissionRow) => {
      if (submissionKey) queryClient.setQueryData(submissionKey, value);
    },
    [queryClient, submissionKey],
  );

  return {
    submission: submissionQuery.data ?? null,
    state: !profileId || !courseId ? "ready" : submissionQuery.isPending || (submissionQuery.isFetching && submissionQuery.data === undefined) ? "loading" : submissionQuery.isError ? "error" : "ready",
    refresh,
    submit: submitMutation.mutateAsync,
    setSubmission,
  };
}
