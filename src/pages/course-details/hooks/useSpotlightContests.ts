import { useEffect, useState } from "react";
import { listContests } from "@/lib/contests";
import type { Contest } from "@/types/contests";

export function useSpotlightContests(): Contest[] {
  const [spotlightContests, setSpotlightContests] = useState<Contest[]>([]);

  useEffect(() => {
    let cancelled = false;

    listContests()
      .catch(() => [] as Contest[])
      .then((contestRows) => {
        if (cancelled) return;
        setSpotlightContests(
          contestRows.filter(
            (item) => item.status === "published" || item.status === "running",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return spotlightContests;
}
