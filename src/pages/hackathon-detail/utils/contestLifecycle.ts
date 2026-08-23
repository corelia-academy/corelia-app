import type { Contest } from "@/types/hackathons";

/** Derived lifecycle for public hackathon surfaces — time-based (draft excluded). */
export type HackathonLifecycle =
  | "draft"
  | "upcoming"
  | "registration_open"
  | "in_progress"
  | "judging"
  | "ended";

export type ContestLifecycleDatetimes = {
  registrationOpenAt: string;
  registrationCloseAt: string;
  submissionCloseAt: string;
  judgingEndAt: string | null;
};

/**
 * Canonical lifecycle boundary for new code: only the top-level hackathon
 * fields define whether the event has started or ended. Detailed registration,
 * submission and judging phases remain compatibility UI state for now.
 */
export type CanonicalHackathonLifecycle = "draft" | "upcoming" | "in_progress" | "ended";

export function deriveCanonicalHackathonLifecycle(
  contest: Contest,
  nowMs: number = Date.now(),
): CanonicalHackathonLifecycle {
  if (contest.status === "draft") return "draft";

  const startMs = parseLifecycleInstantMs(contest.starts_at);
  const endMs = parseLifecycleInstantMs(contest.ends_at);
  if (startMs != null && nowMs < startMs) return "upcoming";
  if (endMs != null && nowMs >= endMs) return "ended";
  return "in_progress";
}

function firstIso(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function parseLifecycleInstantMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads lifecycle timestamps from contest JSON (`document` merged onto row) with fallbacks
 * to legacy flat columns (`registration_deadline`, `submission_deadline`, etc.).
 */
export function getContestLifecycleDatetimes(contest: Contest): ContestLifecycleDatetimes {
  const r = contest as unknown as Record<string, unknown>;

  const registrationOpenAt =
    firstIso(r.registrationOpenAt as string, r.registration_open_at as string) ??
    contest.created_at;

  const registrationCloseAt =
    firstIso(
      r.registrationCloseAt as string,
      r.registration_close_at as string,
      contest.registration_deadline,
      contest.starts_at,
      contest.ends_at,
    ) ??
    contest.ends_at ??
    contest.starts_at ??
    contest.created_at;

  const submissionCloseAt =
    firstIso(
      r.submissionCloseAt as string,
      r.submission_close_at as string,
      contest.submission_deadline,
      contest.ends_at,
    ) ??
    contest.ends_at ??
    contest.starts_at ??
    contest.created_at;

  const judgingEndAt = firstIso(
    r.judgingEndAt as string,
    r.judging_end_at as string,
  );

  return {
    registrationOpenAt,
    registrationCloseAt,
    submissionCloseAt,
    judgingEndAt,
  };
}

export function deriveHackathonLifecycle(
  contest: Contest,
  nowMs: number = Date.now(),
): HackathonLifecycle {
  if (contest.status === "draft") return "draft";

  const d = getContestLifecycleDatetimes(contest);
  const regOpenMs = parseLifecycleInstantMs(d.registrationOpenAt);
  const regCloseMs = parseLifecycleInstantMs(d.registrationCloseAt);
  const subCloseMs = parseLifecycleInstantMs(d.submissionCloseAt);
  const judgeEndMs = parseLifecycleInstantMs(d.judgingEndAt);

  if (regOpenMs != null && nowMs < regOpenMs) return "upcoming";
  if (regCloseMs != null && nowMs < regCloseMs) return "registration_open";
  if (subCloseMs != null && nowMs < subCloseMs) return "in_progress";
  if (judgeEndMs != null && nowMs < judgeEndMs) return "judging";
  return "ended";
}

export function hackathonLifecycleBadgeClassName(lifecycle: HackathonLifecycle): string {
  switch (lifecycle) {
    case "draft":
      return "border border-border-subtle bg-surface-raised text-foreground-muted";
    case "upcoming":
      return "bg-surface-overlay text-foreground-muted";
    case "registration_open":
      return "bg-success/10 text-success";
    case "in_progress":
      return "bg-warning/10 text-warning";
    case "judging":
      return "bg-primary-muted text-primary";
    case "ended":
    default:
      return "bg-surface-overlay text-foreground-subtle";
  }
}

/**
 * Whether the participant workspace rail (register / submit cards) has any actionable content.
 * Active phases (registration_open / in_progress / judging) always show the rail; ended/upcoming
 * only show it when the viewer already has a registration record (status display).
 */
export function shouldShowParticipantRail(opts: {
  lifecycle: HackathonLifecycle | null;
  hasExistingRegistration: boolean;
}): boolean {
  const { lifecycle, hasExistingRegistration } = opts;
  if (lifecycle == null || lifecycle === "draft") return false;
  if (lifecycle === "ended" || lifecycle === "upcoming") {
    return hasExistingRegistration;
  }
  return true;
}

export function hackathonLifecycleShowsPulseDot(lifecycle: HackathonLifecycle): boolean {
  return (
    lifecycle === "registration_open" ||
    lifecycle === "in_progress" ||
    lifecycle === "judging"
  );
}

export type HackathonCountdownTarget = {
  iso: string;
  labelKey:
    | "detail.lifecycle.countdown.opensIn"
    | "detail.lifecycle.countdown.registrationClosesIn"
    | "detail.lifecycle.countdown.submissionClosesIn"
    | "detail.lifecycle.countdown.resultsIn";
};

/** Countdown label + instant for the active lifecycle phase (hidden when ended / draft). */
export function getHackathonCountdownTarget(
  lifecycle: HackathonLifecycle,
  d: ContestLifecycleDatetimes,
): HackathonCountdownTarget | null {
  switch (lifecycle) {
    case "upcoming":
      return d.registrationOpenAt
        ? {
            iso: d.registrationOpenAt,
            labelKey: "detail.lifecycle.countdown.opensIn",
          }
        : null;
    case "registration_open":
      return d.registrationCloseAt
        ? {
            iso: d.registrationCloseAt,
            labelKey: "detail.lifecycle.countdown.registrationClosesIn",
          }
        : null;
    case "in_progress":
      return d.submissionCloseAt
        ? {
            iso: d.submissionCloseAt,
            labelKey: "detail.lifecycle.countdown.submissionClosesIn",
          }
        : null;
    case "judging":
      return d.judgingEndAt
        ? {
            iso: d.judgingEndAt,
            labelKey: "detail.lifecycle.countdown.resultsIn",
          }
        : null;
    default:
      return null;
  }
}
