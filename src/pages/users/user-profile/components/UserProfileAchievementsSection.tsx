import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { Award, RefreshCw } from "lucide-react";

import OpenCampusConnectDialog from "@/components/layouts/OpenCampusConnectDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { OcBadgesByScopeTabs } from "@/pages/achievements/components/OcBadgesByScopeTabs";
import { CertificateCard } from "@/pages/achievements/components/CertificateCard";
import { OcCredentialModal } from "@/pages/achievements/components/OcCredentialModal";
import { StatsBar } from "@/pages/achievements/components/StatsBar";
import { useAchievementsPage } from "@/pages/achievements/hooks/useAchievementsPage";
import { usePublicAchievements } from "../hooks/usePublicAchievements";

export function UserProfileAchievementsSection({ isSelf, profileId }: { isSelf: boolean; profileId?: string }) {
  const { t } = useTranslation("common");
  const { ocAuth, isInitialized } = useOCAuth();
  const [ocConnectLoading, setOcConnectLoading] = useState(false);
  const [ocConnectError, setOcConnectError] = useState<string | null>(null);

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
    ocidConnectOpen,
    setOcidConnectOpen,
  } = isSelf 
    ? privateAchievements 
    : { 
        ...publicAchievements, 
        claiming: false, 
        handleClaim: async () => {}, 
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



  const earnedBadges = badges.filter((b) => !b.locked);
  const recentCertificates = certificates.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="size-4 text-foreground-muted" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">
          {t("userProfile.tabs.achievements")}
        </h2>
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

      <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <div className="text-sm font-medium text-foreground">
          {t("achievements.vaults.certificates.title")}
        </div>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("achievements.vaults.certificates.subtitle")}
        </p>

        <div className="mt-4">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28 w-full rounded-md" />
              <Skeleton className="h-28 w-full rounded-md" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
          ) : recentCertificates.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted">
              {t("achievements.vaults.certificates.empty")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentCertificates.map((cert) => (
                <CertificateCard
                  key={cert.id}
                  cert={cert}
                  onOpenModal={openModal}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <div className="text-sm font-medium text-foreground">
          {t("achievements.vaults.badges.title")}
        </div>
        <p className="mt-1 text-sm text-foreground-muted">
          {t("achievements.vaults.badges.subtitle")}
        </p>

        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
            </div>
          ) : (
            <OcBadgesByScopeTabs badges={earnedBadges} loading={loading} onOpenModal={openModal} />
          )}
        </div>
      </div>

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
    </section>
  );
}
