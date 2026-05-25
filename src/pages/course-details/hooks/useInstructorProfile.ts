import { useEffect, useState } from "react";
import { getProfile } from "@/lib/profile";
import type { Profile } from "@/types/database";

export function useInstructorProfile(instructorId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instructorId) return;
    let cancelled = false;
    setLoading(true);
    getProfile(instructorId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instructorId]);

  return { profile, loading };
}
