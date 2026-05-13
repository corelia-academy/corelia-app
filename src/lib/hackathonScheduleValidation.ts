export type ContestScheduleValidationFailureReason =
  | "ends_not_after_start"
  | "submission_after_end";

/** Validates datetime-local style strings before create/update (local semantics). */
export function validateContestScheduleInputs(opts: {
  startsAt: string;
  endsAt: string;
  submissionDeadline?: string;
}):
  | { ok: true }
  | { ok: false; reason: ContestScheduleValidationFailureReason } {
  const startRaw = opts.startsAt.trim();
  const endRaw = opts.endsAt.trim();
  const submissionRaw = opts.submissionDeadline?.trim() ?? "";

  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;
  const submission = submissionRaw ? new Date(submissionRaw) : null;

  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end <= start
  ) {
    return { ok: false, reason: "ends_not_after_start" };
  }

  if (
    end &&
    submission &&
    !Number.isNaN(end.getTime()) &&
    !Number.isNaN(submission.getTime()) &&
    submission > end
  ) {
    return { ok: false, reason: "submission_after_end" };
  }

  return { ok: true };
}
