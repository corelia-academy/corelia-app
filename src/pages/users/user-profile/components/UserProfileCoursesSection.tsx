import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedCoursesByInstructor } from "@/lib/courses";
import type { PublicProfile } from "@/types/database";
import type { Course } from "@/types/courses";

export function UserProfileCoursesSection({
  profile,
}: {
  profile: PublicProfile;
}) {
  const { t } = useTranslation("common");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (profile.role !== "instructor") {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.courses.privateByDefault")}
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await getPublishedCoursesByInstructor(profile.id);
        if (cancelled) return;
        setCourses(rows);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : t("userProfile.errors.loadFailed"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, t]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {error}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.courses.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {courses.map((c) => (
        <NavLink
          key={c.id}
          to={`/courses/${c.id}`}
          className="block rounded-md border border-border-subtle bg-card p-4 shadow-card transition hover:bg-muted/40"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {c.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("userProfile.courses.updatedAt", {
                date: new Date(c.updated_at).toLocaleDateString(),
              })}
            </div>
          </div>
        </NavLink>
      ))}
    </div>
  );
}
