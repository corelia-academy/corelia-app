import type { Contest } from "@/types/hackathons";
import { deriveHackathonLifecycle } from "@/pages/hackathon-detail/utils/contestLifecycle";

/** @deprecated Prefer HackathonLifecycle from contestLifecycle.ts */
export type ContestPublicPhase =
  | "ended"
  | "in_progress"
  | "registration_open"
  | "registration_closed_before_start";

/** @deprecated Prefer deriveHackathonLifecycle — maps new lifecycle to legacy phase for gradual migration */
export function deriveContestPublicPhase(contest: Contest): ContestPublicPhase {
  const life = deriveHackathonLifecycle(contest);
  switch (life) {
    case "draft":
    case "upcoming":
      return "registration_closed_before_start";
    case "registration_open":
      return "registration_open";
    case "in_progress":
    case "judging":
      return "in_progress";
    case "ended":
    default:
      return "ended";
  }
}

/** @deprecated Prefer hackathonLifecycleBadgeClassName */
export function contestPhaseBadgeClassName(
  phase: ContestPublicPhase,
): string {
  switch (phase) {
    case "registration_open":
      return "bg-success text-success-foreground";
    case "registration_closed_before_start":
      return "bg-primary-muted text-primary";
    case "in_progress":
      return "bg-warning text-warning-foreground";
    case "ended":
    default:
      return "border border-border-subtle bg-surface-raised text-foreground";
  }
}
