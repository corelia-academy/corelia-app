import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCareerTrackBySlug } from "@/lib/careerTracks";
import type { CareerTrackDetail } from "@/types/career";

export function useCareerTrackDetail(
  params:
    | { owner_scope: "corelia"; slug: string | undefined; handle?: never }
    | {
        owner_scope: "instructor";
        handle: string | undefined;
        slug: string | undefined;
      },
) {
  const { t } = useTranslation("career");
  const [track, setTrack] = useState<CareerTrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const normalizedSlug = params.slug?.trim() ?? "";
    const normalizedHandle =
      params.owner_scope === "instructor" ? params.handle?.trim() ?? "" : "";

    if (
      !normalizedSlug ||
      (params.owner_scope === "instructor" && !normalizedHandle)
    ) {
      setTrack(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getCareerTrackBySlug(
      params.owner_scope === "corelia"
        ? { owner_scope: "corelia", slug: normalizedSlug }
        : { owner_scope: "instructor", handle: normalizedHandle, slug: normalizedSlug },
    )
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
  }, [params.owner_scope, params.slug, params.owner_scope === "instructor" ? params.handle : "", t]);

  return { track, loading, error };
}

