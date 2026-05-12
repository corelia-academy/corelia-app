import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { listCareerTracks } from "@/lib/careerTracks";
import type { CareerTrackDetail } from "@/types/career";

export function useCareerTracksCatalog() {
  const { t, i18n } = useTranslation("career");
  const [tracks, setTracks] = useState<CareerTrackDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listCareerTracks(i18n.language)
      .then((rows) => {
        if (cancelled) return;
        setTracks(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("errors.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t, i18n.language]);

  const hasTracks = useMemo(() => tracks.length > 0, [tracks.length]);

  return { tracks, hasTracks, loading, error };
}

