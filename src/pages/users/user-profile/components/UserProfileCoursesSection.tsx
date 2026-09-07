import { useQuery } from "@tanstack/react-query";
import { PublicCourseCard } from "@/components/courses/PublicCourseCard";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { publicInstructorCoursesQueryOptions } from "@/features/profiles/publicProfileQueries";
import type { PublicProfile } from "@/types/database";

export function UserProfileCoursesSection({
  profile,
}: {
  profile: PublicProfile;
}) {
  const { t, i18n } = useTranslation("common");
  const canShow = profile.role === "instructor";
  const query = useQuery(publicInstructorCoursesQueryOptions(profile.id, canShow, i18n.language));
  const courses = query.data ?? [];
  const loading = canShow && query.isPending;
  const error = query.error ? t("userProfile.errors.loadFailed") : null;

  if (!canShow) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-heading-small font-display text-foreground">
            {t("userProfile.tabs.courses")}
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted shadow-card">
          {t("userProfile.courses.privateByDefault")}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-heading-small font-display text-foreground">
            {t("userProfile.tabs.courses")}
          </h2>
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-heading-small font-display text-foreground">
            {t("userProfile.tabs.courses")}
          </h2>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted shadow-card sm:p-6">
          {error}
        </div>
      </section>
    );
  }

  if (courses.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-heading-small font-display text-foreground">
            {t("userProfile.tabs.courses")}
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted shadow-card">
          {t("userProfile.courses.empty")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-heading-small font-display text-foreground">
            {t("userProfile.tabs.courses")}
          </h2>
        </div>
        <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium tabular-nums text-foreground-muted">
          {courses.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((c) => (
          <PublicCourseCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
}
