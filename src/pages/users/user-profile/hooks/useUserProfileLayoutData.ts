import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPublicProfileByHandle } from "@/lib/profile";
import type { PublicProfile } from "@/types/database";

export function useUserProfileLayoutData(handle: string | undefined) {
  const { t } = useTranslation("common");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setProfile(null);

      try {
        const h = handle?.trim() ?? "";
        const p = await getPublicProfileByHandle(h);
        if (cancelled) return;
        if (!p) {
          setError(t("userProfile.errors.notFound"));
          return;
        }
        setProfile(p);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [handle, t]);

  return { profile, loading, error };
}
