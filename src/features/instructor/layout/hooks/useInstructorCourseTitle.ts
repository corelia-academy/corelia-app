import { useEffect, useState } from "react";
import { getCourse } from "@/lib/courses";

export function useInstructorCourseTitle({
  id,
  enabled,
}: {
  id?: string;
  enabled: boolean;
}) {
  const [courseTitle, setCourseTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !id) return;
    let cancelled = false;
    getCourse(id)
      .then((c) => {
        if (!cancelled) setCourseTitle(c?.title ?? null);
      })
      .catch(() => {
        if (!cancelled) setCourseTitle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  return { courseTitle, setCourseTitle };
}

