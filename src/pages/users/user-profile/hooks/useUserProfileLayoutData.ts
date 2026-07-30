import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPublicProfileByHandle } from "@/lib/profile";
import { getUserFollowingProfileCount } from "@/lib/follows";
import type { PublicProfile } from "@/types/database";

export function useUserProfileLayoutData(handle: string | undefined) {
  const { t } = useTranslation("common");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followingProfileCount, setFollowingProfileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setProfile(null);
      setFollowingProfileCount(0);

      try {
        const h = handle?.trim() ?? "";
        const p = await getPublicProfileByHandle(h);
        if (cancelled) return;
        if (!p) {
          setError(t("userProfile.errors.notFound"));
          return;
        }
        const profileFollowingCount = p.profile_public
          ? await getUserFollowingProfileCount(p.id).catch((reason) => {
              console.warn("[user profile] could not load following profile count", reason);
              return 0;
            })
          : 0;
        if (cancelled) return;
        setFollowingProfileCount(profileFollowingCount);
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

  return { profile, followingProfileCount, loading, error };
}
