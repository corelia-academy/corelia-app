import { useEffect, useState } from "react";
import type { Contest } from "@/types/hackathons";

export function useContestLoad({
  contestSlug,
  prefetchedContest,
}: {
  contestSlug: string | undefined;
  prefetchedContest?: Contest | null;
}) {
  const [contest, setContest] = useState<Contest | null>(() =>
    prefetchedContest && prefetchedContest.slug && prefetchedContest.slug === contestSlug
      ? prefetchedContest
      : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefetchedContest || !prefetchedContest.slug || prefetchedContest.slug !== contestSlug) return;
    // Parent outlet context updates (e.g. banner/thumbnail) must flow into local contest state.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external prefetched snapshot from router outlet
    setContest(prefetchedContest);
  }, [contestSlug, prefetchedContest]);

  return {
    contest,
    setContest,
    loading,
    setLoading,
    error,
    setError,
  };
}
