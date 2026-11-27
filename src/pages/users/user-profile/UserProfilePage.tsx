import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Link as LinkIcon,
  Lock,
  ShieldAlert,
  User,
} from "lucide-react";
import {
  ArrowUpRight,
  ListChecks,
  ShareFat,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/UserAvatar";
import { AvatarAction } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FollowButton } from "@/components/social/FollowButton";
import { FollowerPreview } from "@/components/social/FollowerPreview";
import { FollowingListDialog } from "@/components/social/FollowingListDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/stores/authStore";
import type { PublicProfile } from "@/types/database";
import { XpStatPanel } from "@/features/xp/XpStatPanel";

import { AvatarEditorModal } from "@/pages/account/AvatarSettingsRoute";
import { EditProfileModal } from "./components/EditProfileModal";
import { UserProfileAchievementsSection } from "./components/UserProfileAchievementsSection";
import { XpActivity } from "@/features/xp/XpActivity";
// TODO(figma-profile): Figma hồ sơ chưa có Khóa học và Hackathon, ẩn tạm; bật lại khi có thiết kế
// import { UserProfileContestsSection } from "./components/UserProfileContestsSection";
// import { UserProfileCoursesSection } from "./components/UserProfileCoursesSection";
import { UserProfileProjectsSection } from "./components/UserProfileProjectsSection";
// TODO(figma-profile): Figma cột phải chưa có thẻ Skill, ẩn tạm; bật lại khi có thiết kế
// import { UserProfileSkillsCard } from "./components/UserProfileSkillsCard";
import { useUserProfileLayoutData } from "./hooks/useUserProfileLayoutData";
import {
  isValidHttpUrl,
  profileTitle,
  readableProfileText,
} from "./utils/profileDisplay";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  useDynamicPageTitle,
  usePageTitleOverride,
} from "@/components/navigation/PageTitle";

const PROFILE_TABS = ["activity", "projects", "achievements"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

function isProfileTab(value: string | null): value is ProfileTab {
  return PROFILE_TABS.some((tab) => tab === value);
}

function formatMemberSince(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

function ProfileCount({
  label,
  ariaLabel,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  onClick?: () => void;
}) {
  if (!onClick) return <span className="px-md text-cta-small font-cta text-foreground">{label}</span>;
  return (
    <Button type="button" variant="cta" hierarchy="tertiary" size="xsmall" onClick={onClick} aria-label={ariaLabel}>
      {label}
    </Button>
  );
}

function ProfileSidebar({
  profile,
  website,
}: {
  profile: PublicProfile;
  website: string | null;
}) {
  const { t, i18n } = useTranslation("common");
  const hasWebsite = Boolean(website && isValidHttpUrl(website));

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
      <XpStatPanel userId={profile.id} />

      <section
        aria-labelledby="profile-info-title"
        className="flex flex-col gap-2.5 rounded-2xl border border-stroke-divider px-4 pb-4 pt-3"
      >
        <SectionHeader
          className="gap-2"
          titleId="profile-info-title"
          icon={<ListChecks aria-hidden weight="duotone" className="size-5 shrink-0 text-foreground-muted" />}
          title={t("userProfile.info.title")}
        />

        <div className="flex flex-col gap-6">
          {/* TODO(figma-links): chưa có dữ liệu Github/LinkedIn cho người dùng thường; tạm hiển thị website */}
          {hasWebsite ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-title-medium text-foreground-subtle">
                {t("userProfile.info.links")}
              </p>
              <a
                href={website ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-body-medium text-foreground hover:underline"
              >
                <LinkIcon aria-hidden className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {t("userProfile.labels.website")}
                </span>
                <ArrowUpRight aria-hidden className="size-3 shrink-0 text-foreground-muted" />
              </a>
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <p className="text-title-medium text-foreground-subtle">
              {t("userProfile.labels.memberSince")}
            </p>
            <p className="text-body-medium text-foreground">
              {formatMemberSince(
                profile.created_at,
                i18n.resolvedLanguage ?? i18n.language,
              )}
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}

export default function UserProfileLayout() {
  const { t } = useTranslation("common");
  const { handle } = useParams<{ handle: string }>();
  const { user, profile: currentUserProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: ProfileTab = isProfileTab(requestedTab) ? requestedTab : "activity";
  const setActiveTab = (next: ProfileTab) =>
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next === "activity") params.delete("tab");
      else params.set("tab", next);
      return params;
    });
  const {
    profile: fetchedProfile,
    followingProfileCount,
    loading,
    error,
  } = useUserProfileLayoutData(handle);

  const isSelf = Boolean(user && fetchedProfile && user.id === fetchedProfile.id);
  const [previewAsGuest, setPreviewAsGuest] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarSession, setAvatarSession] = useState(0);
  const openAvatarEditor = () => {
    setAvatarSession((n) => n + 1);
    setAvatarOpen(true);
  };
  const [followerDialogOpen, setFollowerDialogOpen] = useState(false);
  const [followingDialogOpen, setFollowingDialogOpen] = useState(false);
  const [followerCountOverride, setFollowerCountOverride] = useState<{
    profileId: string;
    count: number;
  } | null>(null);
  const effectiveIsSelf = isSelf && !previewAsGuest;
  const profile = (effectiveIsSelf && currentUserProfile ? currentUserProfile : fetchedProfile) as PublicProfile | null;
  const canViewContent = Boolean(profile && (profile.profile_public || effectiveIsSelf));
  const followerCount =
    followerCountOverride && followerCountOverride.profileId === profile?.id
      ? followerCountOverride.count
      : Number(profile?.follower_count ?? 0);

  const website =
    profile?.website?.trim() || profile?.instructor_website?.trim() || null;
  const bio =
    readableProfileText(profile?.bio) ||
    readableProfileText(profile?.instructor_bio);

  usePageTitleOverride(!loading && !profile ? "notFound" : null);
  useDynamicPageTitle(profile ? profileTitle(profile) : null);

  usePageMeta({
    title: profile ? profileTitle(profile) : undefined,
    description: bio ?? undefined,
    url: window.location.href,
  });

  const onShare = () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success(t("userProfile.actions.shareCopied")),
      () => toast.error(t("userProfile.actions.shareCopyFailed")),
    );
  };

  return (
    <div className="container-app pb-6 pt-0 sm:py-8 lg:py-10">
      <section>
        <div className="relative h-40 overflow-hidden rounded-2xl bg-profile-cover-surface sm:h-56 lg:h-[280px]">
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-profile-cover-surface/0 to-profile-cover-fade"
          />
          {/* TODO(figma-cover): chưa có cột ảnh bìa trong DB; hiện chỉ là khung giữ chỗ */}
          {!loading && effectiveIsSelf ? (
            <div className="relative flex h-full flex-col items-center justify-center text-center">
              <p className="text-cta-medium font-cta text-foreground">
                {t("userProfile.cover.add")}
              </p>
              <p className="text-cta-medium font-cta text-profile-cover-hint">(1080 x 280)</p>
            </div>
          ) : null}
        </div>

        <div className="px-4 sm:px-8">
          <div className="relative -mt-20 size-[120px]">
            {loading ? (
              <Skeleton className="size-[120px] rounded-full" />
            ) : (
              <UserAvatar
                userId={profile?.id}
                avatarUrl={profile?.avatar_url}
                avatarSeed={profile?.avatar_seed}
                avatarConfig={profile?.avatar_config}
                alt={profile ? profileTitle(profile) : ""}
                fallback={<User className="size-7" aria-hidden />}
                size="5XLarge"
                className="rounded-full"
                imageClassName="rounded-full"
                fallbackClassName="rounded-full"
              >
                {effectiveIsSelf ? (
                  <AvatarAction
                    kind="edit"
                    aria-label={t("userProfile.actions.editAvatar")}
                    onClick={openAvatarEditor}
                  />
                ) : null}
              </UserAvatar>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0 md:flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-8 w-64 max-w-full rounded" />
                  <Skeleton className="mt-3 h-12 w-full max-w-lg rounded" />
                </>
              ) : profile ? (
                <>
                  <h1 data-profile-title className="text-heading-large font-display text-foreground [overflow-wrap:anywhere]">
                    {profileTitle(profile)}
                  </h1>
                  {bio ? (
                    <p className="mt-2 max-w-[499px] text-body-large font-body text-foreground-subtle [overflow-wrap:anywhere]">
                      {bio}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-foreground-muted">
                  {t("userProfile.errors.notFound")}
                </p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-3 md:items-end">
              <div className="flex flex-wrap items-center gap-4 md:justify-end">
                {loading ? <Skeleton className="h-8 w-36 rounded" /> : null}

                {/* Ngoài phạm vi: Figma không có nút "Xem tư cách khách"; giữ tạm để không mất chức năng */}
                {!loading && profile && isSelf ? (
                  <Button
                    variant="cta"
                    hierarchy="tertiary"
                    size="small"
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
                  <Button
                    variant="cta"
                    hierarchy="primary"
                    size="small"
                    onClick={() => {
                      setEditSession((n) => n + 1);
                      setEditOpen(true);
                    }}
                  >
                    {t("userProfile.actions.editProfile")}
                  </Button>
                ) : null}
                {!loading && profile && !isSelf && profile.profile_public ? (
                  <FollowButton
                    subject={{ type: "user", id: profile.id }}
                    followerCount={followerCount}
                    size="small"
                    onFollowerCountChange={(count) =>
                      setFollowerCountOverride({ profileId: profile.id, count })
                    }
                  />
                ) : null}
                {!loading && profile ? (
                  <Button
                    type="button"
                    variant="cta"
                    hierarchy="tertiary"
                    size="small"
                    iconOnly
                    aria-label={t("userProfile.actions.share")}
                    onClick={onShare}
                  >
                    <ShareFat aria-hidden />
                  </Button>
                ) : null}
              </div>

              {!loading && profile ? (
                <div className="flex h-6 items-center gap-2.5">
                  <ProfileCount
                    label={t("userProfile.counts.followers", { value: followerCount })}
                    ariaLabel={t("userProfile.actions.viewFollowers")}
                    onClick={
                      profile.profile_public ? () => setFollowerDialogOpen(true) : undefined
                    }
                  />
                  <Separator orientation="vertical" className="border-stroke-divider" aria-hidden="true" />
                  <ProfileCount
                    label={t("userProfile.counts.following", { value: followingProfileCount })}
                    ariaLabel={t("userProfile.actions.viewFollowing")}
                    onClick={
                      profile.profile_public ? () => setFollowingDialogOpen(true) : undefined
                    }
                  />
                </div>
              ) : null}
              {!loading && profile?.profile_public ? (
                <>
                  <FollowerPreview
                    subject={{ type: "user", id: profile.id }}
                    totalCount={followerCount}
                    showSummary={false}
                    open={followerDialogOpen}
                    onOpenChange={setFollowerDialogOpen}
                  />
                  <FollowingListDialog
                    userId={profile.id}
                    open={followingDialogOpen}
                    onOpenChange={setFollowingDialogOpen}
                  />
                </>
              ) : null}
              {!loading && profile && effectiveIsSelf ? (
                <>
                  <EditProfileModal
                    key={editSession}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    onEditAvatar={openAvatarEditor}
                    onUsernameChanged={(username) => navigate(`/@${username}`, { replace: true })}
                  />
                  <AvatarEditorModal key={`avatar-${avatarSession}`} open={avatarOpen} onOpenChange={setAvatarOpen} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8">
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
          canViewContent ? (
            <Tabs.Root
              className="pt-5"
              value={activeTab}
              onValueChange={(value) => {
                if (isProfileTab(value)) setActiveTab(value);
              }}
            >
              <Tabs.List activateOnFocus level="3a" className="gap-2" aria-label={t("userProfile.tabs.label")}>
                <Tabs.Tab value="activity">{t("userProfile.tabs.activity")}</Tabs.Tab>
                <Tabs.Tab value="projects">{t("userProfile.tabs.projects")}</Tabs.Tab>
                <Tabs.Tab value="achievements">{t("userProfile.tabs.achievementsTab")}</Tabs.Tab>
              </Tabs.List>
              <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-12">
                <div className="min-w-0">
                  <Tabs.Panel value="activity">
                    <XpActivity userId={profile.id} own={effectiveIsSelf} />
                  </Tabs.Panel>
                  <Tabs.Panel value="projects">
                    <UserProfileProjectsSection profile={profile} isSelf={effectiveIsSelf} />
                  </Tabs.Panel>
                  <Tabs.Panel value="achievements">
                    <UserProfileAchievementsSection isSelf={effectiveIsSelf} profileId={profile.id} />
                    {/* TODO(figma-milestones): khối mốc feed ẩn vì Figma đã chia về Projects/Activity/Achievements;
                        bật lại bằng: <UserProfileActivitySection profile={profile} /> (nhớ import lại) */}
                  </Tabs.Panel>
                  {/* TODO(figma-profile): Figma chưa có Khóa học và Hackathon, ẩn tạm; bật lại khi có thiết kế
                  <UserProfileCoursesSection profile={profile} />
                  <UserProfileContestsSection profile={profile} isSelf={effectiveIsSelf} />
                  */}
                </div>
                <ProfileSidebar profile={profile} website={website} />
              </div>
            </Tabs.Root>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-subtle bg-surface-base p-8 text-center shadow-card">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised">
                  <Lock className="size-5 text-foreground-subtle" aria-hidden />
                </div>
                <h3 className="mt-4 text-heading-small font-display text-foreground">
                  {t("userProfile.private.title")}
                </h3>
                <p className="mt-2 text-sm text-foreground-muted max-w-sm mx-auto">
                  {t("userProfile.private.description")}
                </p>
              </div>
              <UserProfileAchievementsSection isSelf={effectiveIsSelf} profileId={profile.id} />
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
