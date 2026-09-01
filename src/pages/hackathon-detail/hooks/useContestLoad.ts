import { useCallback, useState, type SetStateAction } from "react";
import type { Contest } from "@/types/hackathons";

export function useContestLoad({
  contestSlug,
  prefetchedContest,
}: {
  contestSlug: string | undefined;
  prefetchedContest?: Contest | null;
}) {
  const [localContest, setLocalContest] = useState<Contest | null>(() =>
    prefetchedContest && prefetchedContest.slug && prefetchedContest.slug === contestSlug
      ? prefetchedContest
      : null,
  );
  const contest: Contest | null =
    localContest?.slug === contestSlug
      ? localContest
      : prefetchedContest?.slug === contestSlug
        ? (prefetchedContest ?? null)
        : null;
  const setContest = useCallback((action: SetStateAction<Contest | null>) => {
    setLocalContest((current) =>
      typeof action === "function" ? action(current) : action,
    );
  }, []);

  return {
    contest,
    setContest,
  };
}
