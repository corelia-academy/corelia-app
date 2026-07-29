import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { Award, ExternalLink, Lock, RefreshCw, SlidersHorizontal } from "lucide-react";

import OpenCampusConnectDialog from "@/components/layouts/OpenCampusConnectDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { OcBadgesByScopeTabs } from "@/pages/achievements/components/OcBadgesByScopeTabs";
import { OcCredentialModal } from "@/pages/achievements/components/OcCredentialModal";
import { StatsBar } from "@/pages/achievements/components/StatsBar";
import { useAchievementsPage } from "@/pages/achievements/hooks/useAchievementsPage";
import { setMyProfileCredentialVisibility } from "@/lib/credentialIssuances";
import { usePublicAchievements } from "../hooks/usePublicAchievements";
import { ProfileCredentialManagerDialog } from "./ProfileCredentialManagerDialog";

export function UserProfileAchievementsSection({ isSelf, profileId }: { isSelf: boolean; profileId?: string }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { ocAuth, isInitialized } = useOCAuth();
  const [ocConnectLoading, setOcConnectLoading] = useState(false);
  const [ocConnectError, setOcConnectError] = useState<string | null>(null);
  const [credentialManagerOpen, setCredentialManagerOpen] = useState(false);

  const privateAchievements = useAchievementsPage(isSelf);
  const publicAchievements = usePublicAchievements(isSelf ? undefined : profileId);

  const {
    certificates,
    badges,
    loading,
    loadError,
    reloadAchievements,
    modalItem,
    modalOpen,
    setModalOpen,
    claiming,
    openModal,
    handleClaim,
    handleRetryBadge,
    ocidConnectOpen,
    setOcidConnectOpen,
  } = isSelf 
    ? privateAchievements 
    : { 
        ...publicAchievements, 
        claiming: false, 
        handleClaim: async () => {}, 
        handleRetryBadge: undefined,
        ocidConnectOpen: false, 
        setOcidConnectOpen: () => {} 
      };

  async function handleOcConnect() {
    setOcConnectError(null);
    if (!isInitialized || !ocAuth) return;
    try {
      setOcConnectLoading(true);
      await ocAuth.signInWithRedirect({ state: "corelia-ocid-connect" });
    } catch (e) {
      setOcConnectError(e instanceof Error ? e.message : t("openCampusConnect.modal.startFailed"));
      setOcConnectLoading(false);
    }
  }

  async function handleApplyProfileCredentialVisibility(issuanceIds: string[]) {
    await setMyProfileCredentialVisibility(issuanceIds);
    await reloadAchievements();
  }

  const earnedBadges = badges.filter((b) => !b.locked && b.showOnProfile);
  const shouldShowPublicPrivacyState = !isSelf && !loading && !loadError && badges.length === 0;
  const shouldHidePublicAchievementContent = !isSelf && Boolean(loadError);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.achievements")}
          </h2>
        </div>
        {isSelf ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate("/achievements")}
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("userProfile.achievements.openVault")}
          </Button>
        ) : null}
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            disabled={loading}
            onClick={() => void reloadAchievements()}
          >
            <RefreshCw className="size-4" aria-hidden />
            {t("achievements.loadError.retry")}
          </Button>
        </div>
      )}

      {shouldShowPublicPrivacyState ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-6 text-center shadow-card sm:p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <Lock className="size-5 text-foreground-subtle" aria-hidden />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {t("userProfile.achievements.privateTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">
            {t("userProfile.achievements.privateDescription")}
          </p>
        </div>
      ) : shouldHidePublicAchievementContent ? null : (
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : (
            <StatsBar certificates={certificates} badges={badges} />
          )}
        </div>
      )}

      {!shouldShowPublicPrivacyState && !shouldHidePublicAchievementContent ? (
      <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">
              {t("achievements.profileVisibility.publicVaultTitle")}
            </div>
            <p className="mt-1 text-sm text-foreground-muted">
              {isSelf
                ? t("achievements.profileVisibility.selfVaultDescription")
                : t("achievements.profileVisibility.publicVaultDescription")}
            </p>
          </div>
          {isSelf ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setCredentialManagerOpen(true)}
              disabled={loading}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("achievements.profileVisibility.manage")}
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
            </div>
          ) : (
            <OcBadgesByScopeTabs
              badges={earnedBadges}
              loading={loading}
              onOpenModal={openModal}
              onRetry={handleRetryBadge}
            />
          )}
        </div>
      </div>
      ) : null}

      <OcCredentialModal
        item={modalItem}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onClaim={handleClaim}
        onConnectOcid={() => {
          setModalOpen(false);
          setOcidConnectOpen(true);
        }}
        claiming={claiming}
      />

      <OpenCampusConnectDialog
        open={ocidConnectOpen}
        onOpenChange={setOcidConnectOpen}
        onConnect={() => void handleOcConnect()}
        disabled={!isInitialized || !ocAuth}
        loading={ocConnectLoading}
        error={ocConnectError}
      />

      {isSelf ? (
        <ProfileCredentialManagerDialog
          open={credentialManagerOpen}
          onOpenChange={setCredentialManagerOpen}
          badges={badges}
          onApply={handleApplyProfileCredentialVisibility}
        />
      ) : null}
    </section>
  );
}
