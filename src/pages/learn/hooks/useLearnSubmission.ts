import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
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
  const [submission, setSubmission] = useState<SubmissionRow>(null);

  const refresh = useCallback(async () => {
    if (!courseId || !profileId) return null;
    const row = await getSubmission(profileId, courseId);
    setSubmission(row);
    return row;
  }, [courseId, profileId]);

  useEffect(() => {
    if (!courseId || !profileId) return;
    let cancelled = false;
    getSubmission(profileId, courseId).then((row) => {
      if (!cancelled) setSubmission(row);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, profileId]);

  const submit = useCallback(
    async (input: { content: string; fileUrls?: string[] }) => {
      if (!courseId) throw new Error("Missing courseId");
      const row = await submitFinalAssignment(
        courseId,
        input.content.trim(),
        input.fileUrls?.length ? input.fileUrls : undefined,
        viewer,
      );
      setSubmission(row);
      return row;
    },
    [courseId, viewer],
  );

  return {
    submission,
    refresh,
    submit,
    setSubmission,
  };
}

