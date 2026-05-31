import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCareerTrackBySlug } from "@/lib/careerTracks";
import type { CareerTrackDetail } from "@/types/career";

export function useCareerTrackDetail(slug: string | undefined) {
  const { t, i18n } = useTranslation("career");
  const [track, setTrack] = useState<CareerTrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const normalizedSlug = slug?.trim() ?? "";

    if (!normalizedSlug) {
      queueMicrotask(() => {
        if (cancelled) return;
        setTrack(null);
        setLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    getCareerTrackBySlug(normalizedSlug, i18n.language)
      .then((row) => {
        if (cancelled) return;
        setTrack(row);
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
  }, [slug, t, i18n.language]);

  return { track, loading, error };
}
