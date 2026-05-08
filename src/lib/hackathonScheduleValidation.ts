export type ContestScheduleValidationFailureReason =
  | "starts_in_past"
  | "ends_not_after_start";

/** Validates datetime-local style strings before create/update (local semantics). */
export function validateContestScheduleInputs(opts: {
  startsAt: string;
  endsAt: string;
}):
  | { ok: true }
  | { ok: false; reason: ContestScheduleValidationFailureReason } {
  const startRaw = opts.startsAt.trim();
  const endRaw = opts.endsAt.trim();

  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;

  if (start && !Number.isNaN(start.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      return { ok: false, reason: "starts_in_past" };
    }
  }

  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end <= start
  ) {
    return { ok: false, reason: "ends_not_after_start" };
  }

  return { ok: true };
}
