import { useMemo } from "react";
import type { Contest } from "@/types/hackathons";
import {
  deriveHackathonLifecycle,
  getContestLifecycleDatetimes,
  type ContestLifecycleDatetimes,
  type HackathonLifecycle,
} from "@/pages/hackathon-detail/utils/contestLifecycle";

export type UseHackathonStatusResult = {
  lifecycle: HackathonLifecycle | null;
  datetimes: ContestLifecycleDatetimes | null;
};

/** Resolved lifecycle + datetime bundle for a contest (pure derivation; tick externally via deps). */
export function useHackathonStatus(contest: Contest | null): UseHackathonStatusResult {
  return useMemo(
    () =>
      contest
        ? {
            lifecycle: deriveHackathonLifecycle(contest),
            datetimes: getContestLifecycleDatetimes(contest),
          }
        : { lifecycle: null, datetimes: null },
    [contest],
  );
}
