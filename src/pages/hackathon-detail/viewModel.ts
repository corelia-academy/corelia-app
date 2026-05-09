import type { Contest } from "@/types/hackathons";
import type { ContestDetailOrchestrator } from "@/pages/hackathon-detail/hooks/useContestDetailOrchestrator";

/** Orchestrator state after guards guarantee `contest` is loaded. */
export type ContestDetailViewModel = ContestDetailOrchestrator & {
  contest: Contest;
};

export function narrowContestDetailView(
  ctx: ContestDetailOrchestrator,
): ContestDetailViewModel | null {
  if (!ctx.contest) return null;
  return { ...ctx, contest: ctx.contest };
}
