import { useState } from "react";
import { NavLink, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ExternalLink,
  IdCard,
  Link as LinkIcon,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/social/FollowButton";
import { FollowerPreview } from "@/components/social/FollowerPreview";
import { FollowingListDialog } from "@/components/social/FollowingListDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/stores/authStore";
import { getRoleLabel, type PublicProfile } from "@/types/database";

import { UserProfileAchievementsSection } from "./components/UserProfileAchievementsSection";
import { UserProfileActivitySection } from "./components/UserProfileActivitySection";
import { UserProfileContestsSection } from "./components/UserProfileContestsSection";
import { UserProfileCoursesSection } from "./components/UserProfileCoursesSection";
import { UserProfileProjectsSection } from "./components/UserProfileProjectsSection";
import { useUserProfileLayoutData } from "./hooks/useUserProfileLayoutData";
import {
  isValidHttpUrl,
  profileHandle,
  profileTitle,
  readableProfileText,
} from "./utils/profileDisplay";
import { usePageMeta } from "@/hooks/usePageMeta";

function formatMemberSince(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

function ProfileStat({
  label,
  value,
  icon: Icon,
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <Icon className="size-3.5" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="rounded-xl border border-border-subtle bg-surface-base/80 px-3 py-3 text-left shadow-card backdrop-blur transition-colors hover:border-border hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-base/80 px-3 py-3 shadow-card backdrop-blur">
      {content}
    </div>
  );
}

function ProfileSidebar({
  profile,
  followerCount,
  followingProfileCount,
  bio,
  website,
  headerHandle,
}: {
  profile: PublicProfile;
  followerCount: number;
  followingProfileCount: number;
  bio: string | null;
  website: string | null;
  headerHandle: string | null;
}) {
  const { t, i18n } = useTranslation("common");
  const headline =
    readableProfileText(profile.instructor_headline) ||
    (profile.role === "instructor"
      ? t("userProfile.overview.instructorHeadlineFallback")
      : "");
  const ocid = readableProfileText(profile.ocid);

  const rows = [
    {
      label: t("userProfile.labels.role"),
      value: getRoleLabel(profile.role),
    },
    {
      label: t("userProfile.labels.memberSince"),
      value: formatMemberSince(
        profile.created_at,
        i18n.resolvedLanguage ?? i18n.language,
      ),
    },
    {
      label: t("userProfile.labels.followers"),
      value: followerCount,
    },
    {
      label: t("userProfile.labels.following"),
      value: followingProfileCount,
    },
  ];

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <section className="rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">
            {t("userProfile.overview.title")}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground-muted [overflow-wrap:anywhere]">
          {headline || bio || t("userProfile.overview.empty")}
        </p>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">
          {t("userProfile.overview.quickInfo")}
        </h2>
        <div className="mt-3 divide-y divide-border-subtle">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-2.5 text-sm"
            >
              <span className="text-foreground-muted">{row.label}</span>
              <span className="min-w-0 truncate text-right font-medium text-foreground">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {(headerHandle || ocid || (website && isValidHttpUrl(website))) ? (
        <section className="rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">
            {t("userProfile.labels.profile")}
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            {headerHandle ? (
              <div className="flex min-w-0 items-center gap-2 text-foreground-muted">
                <User className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{headerHandle}</span>
              </div>
            ) : null}
            {ocid ? (
              <div className="flex min-w-0 items-center gap-2 text-foreground-muted">
                <IdCard className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {t("userProfile.labels.ocid", { ocid })}
                </span>
              </div>
            ) : null}
            {website && isValidHttpUrl(website) ? (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                <LinkIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t("userProfile.labels.website")}</span>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

export default function UserProfileLayout() {
  const { t, i18n } = useTranslation("common");
  const { handle } = useParams<{ handle: string }>();
  const { user, profile: currentUserProfile } = useAuth();
  const {
    profile: fetchedProfile,
    followingProfileCount,
    loading,
    error,
  } = useUserProfileLayoutData(handle);

  const isSelf = Boolean(user && fetchedProfile && user.id === fetchedProfile.id);
  const [previewAsGuest, setPreviewAsGuest] = useState(false);
  const [followerDialogOpen, setFollowerDialogOpen] = useState(false);
  const [followingDialogOpen, setFollowingDialogOpen] = useState(false);
  const [followerCountOverride, setFollowerCountOverride] = useState<{
    profileId: string;
    count: number;
  } | null>(null);
  const effectiveIsSelf = isSelf && !previewAsGuest;
  const profile = (effectiveIsSelf && currentUserProfile ? currentUserProfile : fetchedProfile) as PublicProfile | null;
  const followerCount =
    followerCountOverride && followerCountOverride.profileId === profile?.id
      ? followerCountOverride.count
      : Number(profile?.follower_count ?? 0);

  const headerHandle = profile ? profileHandle(profile) : null;
  const profileOcid = profile ? readableProfileText(profile.ocid) : null;
  const website =
    profile?.website?.trim() || profile?.instructor_website?.trim() || null;
  const bio =
    readableProfileText(profile?.bio) ||
    readableProfileText(profile?.instructor_bio);

  usePageMeta({
    title: profile ? profileTitle(profile) : undefined,
    description: bio ?? undefined,
    image: profile?.avatar_url ?? undefined,
    url: window.location.href,
  });

  return (
    <div className="container-app py-6 sm:py-8 lg:py-10">
      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
        <div className="relative p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary-container)_72%,transparent),transparent_44%),radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_38%)]" />

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
              {loading ? (
                <Skeleton className="size-20 rounded-2xl sm:size-28" />
              ) : (
                <Avatar
                  size="lg"
                  className="size-20 rounded-2xl ring-4 ring-surface-base/80 sm:size-28"
                >
                  <AvatarImage
                    src={profile?.avatar_url ?? undefined}
                    alt=""
                    className="rounded-2xl"
                  />
                  <AvatarFallback className="rounded-2xl">
                    <User className="size-7" aria-hidden />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 flex-1">
                {loading ? (
                  <>
                    <Skeleton className="h-8 w-64 max-w-full rounded" />
                    <Skeleton className="mt-2 h-4 w-32 rounded" />
                    <Skeleton className="mt-4 h-16 w-full max-w-2xl rounded" />
                  </>
                ) : profile ? (
                  <>
                    <h1 className="text-2xl font-semibold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-4xl">
                      {profileTitle(profile)}
                    </h1>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-muted">
                      {headerHandle ? (
                        <span className="truncate">{headerHandle}</span>
                      ) : null}
                      <span className="rounded-full border border-border-subtle bg-surface-base/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-card">
                        {getRoleLabel(profile.role)}
                      </span>
                      {profileOcid ? (
                        <span className="truncate">
                          {t("userProfile.labels.ocid", { ocid: profileOcid })}
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
                      <p className="max-w-3xl text-sm leading-6 text-foreground-muted [overflow-wrap:anywhere] sm:text-base sm:leading-7">
                        {bio}
                      </p>
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

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {loading ? <Skeleton className="h-9 w-28 rounded" /> : null}
                
                {!loading && profile && isSelf ? (
                  <Button
                    variant="outline"
                    size={previewAsGuest ? "sm" : "lg"}
                    onClick={() => setPreviewAsGuest(!previewAsGuest)}
                    aria-label={previewAsGuest ? t("userProfile.actions.exitPreview") : undefined}
                    className={previewAsGuest
                      ? "fixed right-2 top-20 z-50 max-w-[calc(100vw-1rem)] gap-1 border-primary bg-surface-base px-2 text-xs text-primary shadow-lg hover:bg-primary/10 hover:text-primary sm:right-3"
                      : "text-foreground-muted"
                    }
                  >
                    {previewAsGuest ? (
                      <>
                        <EyeOff className="size-3.5" aria-hidden />
                        <span className="sr-only sm:not-sr-only">
                          {t("userProfile.actions.exitPreviewShort")}
                        </span>
                      </>
                    ) : (
                      <><Eye className="mr-2 size-4" aria-hidden /> {t("userProfile.actions.previewAsGuest", "Xem tư cách khách")}</>
                    )}
                  </Button>
                ) : null}

                {!loading && profile && effectiveIsSelf ? (
                  <NavLink to="/account/profile">
                    <Button variant="outline" size="lg" type="button">
                      {t("userProfile.actions.editProfile")}
                    </Button>
                  </NavLink>
                ) : null}
                {!loading && profile && !isSelf && profile.profile_public ? (
                  <FollowButton
                    subject={{ type: "user", id: profile.id }}
                    followerCount={followerCount}
                    size="lg"
                    onFollowerCountChange={(count) =>
                      setFollowerCountOverride({ profileId: profile.id, count })
                    }
                  />
                ) : null}
              </div>
              {!loading && profile?.profile_public ? (
                <div className="sm:self-end">
                  <FollowerPreview
                    subject={{ type: "user", id: profile.id }}
                    totalCount={followerCount}
                    showSummary={false}
                    open={followerDialogOpen}
                    onOpenChange={setFollowerDialogOpen}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                {loading ? (
                  <>
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </>
                ) : profile ? (
                  <>
                    <ProfileStat
                      label={t("userProfile.labels.followers")}
                      value={followerCount}
                      icon={Users}
                      onClick={
                        profile.profile_public
                          ? () => setFollowerDialogOpen(true)
                          : undefined
                      }
                      ariaLabel={t("userProfile.actions.viewFollowers")}
                    />
                    <ProfileStat
                      label={t("userProfile.labels.following")}
                      value={followingProfileCount}
                      icon={Users}
                      onClick={
                        profile.profile_public
                          ? () => setFollowingDialogOpen(true)
                          : undefined
                      }
                      ariaLabel={t("userProfile.actions.viewFollowing")}
                    />
                    <ProfileStat
                      label={t("userProfile.labels.memberSince")}
                      value={formatMemberSince(
                        profile.created_at,
                        i18n.resolvedLanguage ?? i18n.language,
                      )}
                      icon={CalendarDays}
                    />
                    <ProfileStat
                      label={t("userProfile.labels.role")}
                      value={getRoleLabel(profile.role)}
                      icon={IdCard}
                    />
                  </>
                ) : null}
              </div>
              {profile?.profile_public ? (
                <FollowingListDialog
                  userId={profile.id}
                  open={followingDialogOpen}
                  onOpenChange={setFollowingDialogOpen}
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
          <div className={`grid gap-6 lg:items-start ${profile.profile_public || effectiveIsSelf ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'lg:grid-cols-1'}`}>
            <main className="min-w-0 space-y-6">
              {profile.profile_public || effectiveIsSelf ? (
                <>
                  <UserProfileProjectsSection profile={profile} />
                  <UserProfileActivitySection profile={profile} />
                </>
              ) : (
                <div className="rounded-2xl border border-border-subtle bg-surface-base p-8 text-center shadow-card">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised">
                    <Lock className="size-5 text-foreground-subtle" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {t("userProfile.private.title")}
                  </h3>
                  <p className="mt-2 text-sm text-foreground-muted max-w-sm mx-auto">
                    {t("userProfile.private.description")}
                  </p>
                </div>
              )}
              
              <UserProfileAchievementsSection isSelf={effectiveIsSelf} profileId={profile.id} />
              
              {profile.profile_public || effectiveIsSelf ? (
                <>
                  <UserProfileCoursesSection profile={profile} />
                  <UserProfileContestsSection profile={profile} isSelf={effectiveIsSelf} />
                </>
              ) : null}
            </main>
            {profile.profile_public || effectiveIsSelf ? (
              <ProfileSidebar
                profile={profile}
                followerCount={followerCount}
                followingProfileCount={followingProfileCount}
                bio={bio}
                website={website}
                headerHandle={headerHandle}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
