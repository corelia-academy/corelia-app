import { useCallback, useEffect, useState } from "react";
import { getAllProfiles } from "@/lib/profile";
import type { Profile } from "@/types/database";

export function useAdminProfiles({
  fallbackErrorMessage,
}: {
  fallbackErrorMessage: string;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllProfiles();
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [fallbackErrorMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profiles, setProfiles, loading, error, refresh, setError };
}

