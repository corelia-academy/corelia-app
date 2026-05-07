import { useEffect, useState } from "react";
import { listContests } from "@/lib/contests";
import type { Contest } from "@/types/contests";
import { useAuth } from "@/stores/authStore";

export function useSpotlightContests(): Contest[] {
  const { authInitialized, user } = useAuth();
  const [spotlightContests, setSpotlightContests] = useState<Contest[]>([]);

  useEffect(() => {
    if (!authInitialized) return;

    let cancelled = false;

    listContests(user ?? null)
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
  }, [authInitialized, user?.id]);

  return spotlightContests;
}
