import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { listContests } from "@/lib/hackathons";
import type { Contest } from "@/types/hackathons";
import { perfMeasureEnd, perfMeasureStart } from "@/lib/perfTelemetry";
import { useAuth } from "@/stores/authStore";

export function useSpotlightContests(): Contest[] {
  const { user } = useAuth();
  const [spotlightContests, setSpotlightContests] = useState<Contest[]>([]);

  useEffect(() => {
    let cancelled = false;
    perfMeasureStart("course.spotlight_contests_wave");
    listContests(user ?? null)
      .catch(() => [] as Contest[])
      .then((contestRows) => {
        if (cancelled) return;
        setSpotlightContests(
          contestRows.filter(
            (item) => item.status === "published" || item.status === "running",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) {
          perfMeasureEnd("course.spotlight_contests_wave", {
            viewer: user?.id ?? "guest",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when user id or ui locale changes
  }, [user?.id, i18n.language]);

  return spotlightContests;
}