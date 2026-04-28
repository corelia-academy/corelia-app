import { useCallback, useEffect, useState } from "react";
import { getCoursesForManagement } from "@/lib/courses";

export function useCourseCountsByInstructor() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const courses = await getCoursesForManagement("", true);
      const next: Record<string, number> = {};
      for (const c of courses) {
        next[c.instructor_id] = (next[c.instructor_id] ?? 0) + 1;
      }
      setCounts(next);
    } catch {
      setCounts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { counts, loading, refresh, setCounts };
}

