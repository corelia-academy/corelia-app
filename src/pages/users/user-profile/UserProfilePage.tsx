import { NavLink, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, ShieldAlert, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/social/FollowButton";
import { FollowerPreview } from "@/components/social/FollowerPreview";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/stores/authStore";
import { getRoleLabel } from "@/types/database";

import { UserProfileAchievementsSection } from "./components/UserProfileAchievementsSection";
import { UserProfileActivitySection } from "./components/UserProfileActivitySection";
import { UserProfileContestsSection } from "./components/UserProfileContestsSection";
import { UserProfileCoursesSection } from "./components/UserProfileCoursesSection";
import { UserProfileOverviewSection } from "./components/UserProfileOverviewSection";
import { UserProfileProjectsSection } from "./components/UserProfileProjectsSection";
import { useUserProfileLayoutData } from "./hooks/useUserProfileLayoutData";
import {
  isValidHttpUrl,
  profileHandle,
  profileTitle,
} from "./utils/profileDisplay";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function UserProfileLayout() {
  const { t } = useTranslation("common");
  const { handle } = useParams<{ handle: string }>();
  const { user } = useAuth();
  const { profile, loading, error } = useUserProfileLayoutData(handle);

  const isSelf = Boolean(user && profile && user.id === profile.id);
  const headerHandle = profile ? profileHandle(profile) : null;
  const website =
    profile?.website?.trim() || profile?.instructor_website?.trim() || null;
  const bio = profile?.bio?.trim() || profile?.instructor_bio?.trim() || null;

  usePageMeta({
    title: profile ? profileTitle(profile) : undefined,
    description: bio ?? undefined,
    image: profile?.avatar_url ?? undefined,
    url: window.location.href,
  });

  return (
    <div className="container-app py-6 sm:py-8">
      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
        <div className="relative p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_40%),linear-gradient(180deg,color-mix(in_oklch,var(--primary-container)_48%,transparent),transparent_70%)]" />

          <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {loading ? (
                <Skeleton className="size-16 rounded-full sm:size-20" />
              ) : (
                <Avatar size="lg" className="size-16 sm:size-20">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>
                    <User className="size-5" aria-hidden />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0">
                {loading ? (
                  <>
                    <Skeleton className="h-6 w-56 rounded" />
                    <Skeleton className="mt-2 h-4 w-32 rounded" />
                  </>
                ) : profile ? (
                  <>
                    <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                      {profileTitle(profile)}
                    </h1>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-muted">
                      {headerHandle ? (
                        <span className="truncate">{headerHandle}</span>
                      ) : null}
                      <span className="rounded-full border border-border-subtle bg-surface-base/70 px-2 py-0.5 text-xs font-medium text-foreground">
                        {getRoleLabel(profile.role)}
                      </span>
                      {profile.ocid ? (
                        <span className="truncate">
                          {t("userProfile.labels.ocid", { ocid: profile.ocid })}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-foreground-muted">
                    {t("userProfile.errors.notFound")}
                  </p>
                )}

                {!loading && profile ? (
                  <div className="mt-3 space-y-2">
                    {bio ? (
                      <p className="text-sm leading-6 text-foreground-muted">{bio}</p>
                    ) : null}

                    {website && isValidHttpUrl(website) ? (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
                      >
                        {t("userProfile.labels.website")}
                        <ExternalLink className="size-4" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {loading ? <Skeleton className="h-9 w-28 rounded" /> : null}
                {!loading && profile && isSelf ? (
                  <NavLink to="/account/profile">
                    <Button variant="outline" size="lg" type="button">
                      {t("userProfile.actions.editProfile")}
                    </Button>
                  </NavLink>
                ) : null}
                {!loading && profile && !isSelf && profile.profile_public ? (
                  <FollowButton
                    subject={{ type: "user", id: profile.id }}
                    followerCount={profile.follower_count ?? 0}
                    size="lg"
                  />
                ) : null}
              </div>
              {!loading && profile?.profile_public ? (
                <FollowerPreview
                  subject={{ type: "user", id: profile.id }}
                  totalCount={profile.follower_count ?? 0}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <ShieldAlert className="size-6 text-foreground-subtle" aria-hidden />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                {t("userProfile.errors.tryAnother")}
              </p>
            </div>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <UserProfileOverviewSection profile={profile} />
            <UserProfileActivitySection profile={profile} />
            <UserProfileAchievementsSection isSelf={isSelf} />
            <UserProfileCoursesSection profile={profile} />
            <UserProfileContestsSection profile={profile} isSelf={isSelf} />
            <UserProfileProjectsSection profile={profile} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
