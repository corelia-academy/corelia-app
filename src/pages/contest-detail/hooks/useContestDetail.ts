import type { Contest } from "@/types/contests";
import type { ContestPublicSection } from "@/pages/contest-detail/types";
import { useContestDetailOrchestrator } from "@/pages/contest-detail/hooks/useContestDetailOrchestrator";

export type UseContestDetailOptions = {
  forceManageView?: boolean;
  prefetchedContest?: Contest | null;
  publicSection?: ContestPublicSection;
  /** Keeps parent layouts (e.g. public sticky header) in sync after image uploads. */
  onContestSynced?: (next: Contest) => void;
};

/**
 * Compatibility facade around the legacy orchestrator.
 * Intentionally thin so we can incrementally split the underlying logic.
 */
export function useContestDetail(options: UseContestDetailOptions = {}) {
  return useContestDetailOrchestrator(options);
}

