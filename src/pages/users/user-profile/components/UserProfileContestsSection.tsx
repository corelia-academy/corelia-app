import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { PublicProfile } from "@/types/database";
import { publicProfileContestsQueryOptions } from "@/features/profiles/publicProfileQueries";

export function UserProfileContestsSection({
  profile,
  isSelf,
}: {
  profile: PublicProfile;
  isSelf: boolean;
}) {
  const { t, i18n } = useTranslation("common");
  const query = useQuery(
    publicProfileContestsQueryOptions(profile.id, isSelf, i18n.language),
  );
  const contests = query.data?.organized ?? [];
  const participations = query.data?.participations ?? [];
  const loading = query.isPending;
  const error = query.error ? t("userProfile.errors.loadFailed") : null;

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
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
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted shadow-card sm:p-6">
          {error}
        </div>
      </section>
    );
  }

  if (contests.length === 0 && (!isSelf || participations.length === 0)) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted shadow-card">
          {t("userProfile.contests.empty")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium tabular-nums text-foreground-muted">
          {contests.length + (isSelf ? participations.length : 0)}
        </span>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold text-foreground">
          {t("userProfile.contests.organizedTitle")}
        </div>
        {contests.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted sm:p-6">
            {t("userProfile.contests.empty")}
          </div>
        ) : (
          <div className="grid gap-3">
            {contests.map((contest) => {
              const title =
                contest.title?.trim() || t("userProfile.contests.fallbackTitle");
              const id = contest.id;
              const updatedAt = contest.updated_at;

              return (
                <NavLink
                  key={id}
                  to={`/hackathons/${contest.slug || id}/overview`}
                  className="block rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card transition-[background-color,border-color] duration-150 hover:border-border hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {title}
                    </div>
                    {updatedAt ? (
                      <div className="mt-1 text-xs text-foreground-muted">
                        {t("userProfile.contests.updatedAt", {
                          date: new Date(updatedAt).toLocaleDateString(),
                        })}
                      </div>
                    ) : null}
                  </div>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>

      {isSelf ? (
        <div>
          <div className="mb-3 text-sm font-semibold text-foreground">
            {t("userProfile.contests.participatedTitle")}
          </div>
          {participations.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted sm:p-6">
              {t("userProfile.contests.participatedEmpty")}
            </div>
          ) : (
            <div className="grid gap-3">
              {participations.map((contest) => {
                const title =
                  contest.title?.trim() ||
                  t("userProfile.contests.fallbackTitle");
                const id = contest.id;
                const updatedAt = contest.updated_at;

                return (
                  <NavLink
                    key={`p-${id}`}
                    to={`/hackathons/${contest.slug || id}/overview`}
                    className="block rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card transition-[background-color,border-color] duration-150 hover:border-border hover:bg-surface-raised"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {title}
                      </div>
                      {updatedAt ? (
                        <div className="mt-1 text-xs text-foreground-muted">
                          {t("userProfile.contests.updatedAt", {
                            date: new Date(updatedAt).toLocaleDateString(),
                          })}
                        </div>
                      ) : null}
                    </div>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
