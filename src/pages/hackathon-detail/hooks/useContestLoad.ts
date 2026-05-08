import { useEffect, useState } from "react";
import type { Contest } from "@/types/hackathons";

export function useContestLoad({
  contestId,
  prefetchedContest,
}: {
  contestId: string | undefined;
  prefetchedContest?: Contest | null;
}) {
  const [contest, setContest] = useState<Contest | null>(() =>
    prefetchedContest && prefetchedContest.id === contestId
      ? prefetchedContest
      : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefetchedContest || prefetchedContest.id !== contestId) return;
    // Parent outlet context updates (e.g. banner/thumbnail) must flow into local contest state.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external prefetched snapshot from router outlet
    setContest(prefetchedContest);
  }, [contestId, prefetchedContest]);

  return {
    contest,
    setContest,
    loading,
    setLoading,
    error,
    setError,
  };
}
