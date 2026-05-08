import type { Contest } from "@/types/contests";

/** Derived lifecycle phase for public contest surfaces — single source for badge, stats, and CTA copy. */
export type ContestPublicPhase =
  | "ended"
  | "in_progress"
  | "registration_open"
  | "registration_closed_before_start";

export function deriveContestPublicPhase(contest: Contest): ContestPublicPhase {
  const now = Date.now();
  const endsTs = contest.ends_at ? new Date(contest.ends_at).getTime() : NaN;
  const startsTs = contest.starts_at
    ? new Date(contest.starts_at).getTime()
    : NaN;
  const regEndTs = contest.registration_deadline
    ? new Date(contest.registration_deadline).getTime()
    : NaN;

  const endedByTime =
    Number.isFinite(endsTs) && now >= endsTs;
  if (contest.status === "ended" || endedByTime) {
    return "ended";
  }

  const startedByTime = Number.isFinite(startsTs) && now >= startsTs;
  const notEndedByTime = !Number.isFinite(endsTs) || now < endsTs;

  if (
    contest.status === "running" ||
    (startedByTime && notEndedByTime)
  ) {
    return "in_progress";
  }

  if (contest.status === "published") {
    const regStillOpen =
      !Number.isFinite(regEndTs) || now <= regEndTs;
    if (regStillOpen) {
      return "registration_open";
    }
    if (Number.isFinite(startsTs) && now < startsTs) {
      return "registration_closed_before_start";
    }
    if (Number.isFinite(endsTs) && now < endsTs) {
      return "in_progress";
    }
    return "ended";
  }

  return "registration_closed_before_start";
}

export function contestPhaseBadgeClassName(
  phase: ContestPublicPhase,
): string {
  switch (phase) {
    case "registration_open":
      return "bg-success text-success-foreground shadow-sm";
    case "registration_closed_before_start":
      return "bg-primary-container text-on-primary-container shadow-sm";
    case "in_progress":
      return "bg-warning text-warning-foreground shadow-sm";
    case "ended":
    default:
      return "border border-border-subtle bg-muted text-foreground";
  }
}
