import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";

import { BadgeCard } from "@/pages/achievements/components/BadgeCard";
import { CertificateCard } from "@/pages/achievements/components/CertificateCard";
import { OcCredentialModal } from "@/pages/achievements/components/OcCredentialModal";
import { StatsBar } from "@/pages/achievements/components/StatsBar";
import { useAchievementsPage } from "@/pages/achievements/hooks/useAchievementsPage";

export function UserProfileAchievementsSection({ isSelf }: { isSelf: boolean }) {
  const { t } = useTranslation("common");

  const {
    certificates,
    badges,
    loading,
    modalItem,
    modalOpen,
    setModalOpen,
    claiming,
    openModal,
    handleClaim,
  } = useAchievementsPage();

  if (!isSelf) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.achievements.selfOnly")}
      </div>
    );
  }

  const earnedBadges = badges.filter((b) => !b.locked);
  const recentCertificates = certificates.slice(0, 6);
  const recentBadges = earnedBadges.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : (
          <StatsBar certificates={certificates} badges={badges} />
        )}
      </div>

      <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="text-sm font-medium text-foreground">
          {t("achievements.vaults.certificates.title")}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
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
            <div className="rounded-md border border-border-subtle bg-background p-4 text-sm text-muted-foreground">
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

      <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="text-sm font-medium text-foreground">
          {t("achievements.vaults.badges.title")}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
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
          ) : recentBadges.length === 0 ? (
            <div className="rounded-md border border-border-subtle bg-background p-4 text-sm text-muted-foreground">
              {t("achievements.vaults.badges.loading")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
              {recentBadges.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  onOpenModal={openModal}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <OcCredentialModal
        item={modalItem}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onClaim={handleClaim}
        claiming={claiming}
      />
    </div>
  );
}
