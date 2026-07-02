import { useEffect, useState } from "react";
import { getPublicProfileById } from "@/lib/profile";
import type { PublicProfile } from "@/types/database";

export function useInstructorProfile(instructorId: string | undefined) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!instructorId) {
      queueMicrotask(() => {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });

    getPublicProfileById(instructorId)
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
