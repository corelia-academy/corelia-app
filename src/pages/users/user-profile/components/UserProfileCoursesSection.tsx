import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
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
  const { t } = useTranslation("common");
  const canShow = profile.role === "instructor";
  const query = useQuery(publicInstructorCoursesQueryOptions(profile.id, canShow));
  const courses = query.data ?? [];
  const loading = canShow && query.isPending;
  const error = query.error ? t("userProfile.errors.loadFailed") : null;

  if (!canShow) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
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
          <h2 className="text-base font-semibold text-foreground">
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
          <h2 className="text-base font-semibold text-foreground">
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
          <h2 className="text-base font-semibold text-foreground">
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
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.courses")}
          </h2>
        </div>
        <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium tabular-nums text-foreground-muted">
          {courses.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((c) => (
          <NavLink
            key={c.id}
            to={`/courses/${c.id}`}
            className="block rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card transition-[background-color,border-color] duration-150 hover:border-border hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <div className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                {c.title}
              </div>
              <div className="mt-2 text-xs text-foreground-muted">
                {t("userProfile.courses.updatedAt", {
                  date: new Date(c.updated_at).toLocaleDateString(),
                })}
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  );
}
