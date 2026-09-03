import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { useCallback } from "react";

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
  refresh: () => Promise<SubmissionRow>;
  submit: (input: {
    content: string;
    fileUrls?: string[];
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
  const submitMutation = useMutation({
    mutationFn: async (input: { content: string; fileUrls?: string[] }) => {
      if (!courseId) throw new Error("Missing courseId");
      return submitFinalAssignment(
        courseId,
        input.content.trim(),
        input.fileUrls?.length ? input.fileUrls : undefined,
        viewer,
      );
    },
    onSuccess: (row) => {
      if (submissionKey) queryClient.setQueryData(submissionKey, row);
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
    refresh,
    submit: submitMutation.mutateAsync,
    setSubmission,
  };
}
