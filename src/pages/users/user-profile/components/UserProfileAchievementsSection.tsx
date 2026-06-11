import { useTranslation } from "react-i18next";
import { Award } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { OcBadgesByScopeTabs } from "@/pages/achievements/components/OcBadgesByScopeTabs";
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
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Award className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.achievements")}
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted shadow-card">
          {t("userProfile.achievements.selfOnly")}
        </div>
      </section>
    );
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
        claiming={claiming}
      />
    </section>
  );
}
