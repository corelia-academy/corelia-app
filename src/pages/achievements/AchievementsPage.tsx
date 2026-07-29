import { Award, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOCAuth } from "@opencampus/ocid-connect-js";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import OpenCampusConnectDialog from "@/components/layouts/OpenCampusConnectDialog";

import { OcBadgesByScopeTabs } from "./components/OcBadgesByScopeTabs";
import { CertificateCard } from "./components/CertificateCard";
import { OcCredentialModal } from "./components/OcCredentialModal";
import { useAchievementsPage } from "./hooks/useAchievementsPage";

type VaultKey = "certificates" | "onchain";

export default function AchievementsPage() {
  const { t } = useTranslation("common");
  const { ocAuth, isInitialized } = useOCAuth();
  const [openVault, setOpenVault] = useState<VaultKey | null>(null);
  const [ocConnectLoading, setOcConnectLoading] = useState(false);
  const [ocConnectError, setOcConnectError] = useState<string | null>(null);
  const {
    certificates,
    badges,
    loading,
    loadError,
    reloadAchievements,
    certificateSyncCandidates,
    syncingCourseId,
    modalItem,
    modalOpen,
    setModalOpen,
    claiming,
    openModal,
    handleClaim,
    handleRetryBadge,
    handleSyncCertificate,
    ocidConnectOpen,
    setOcidConnectOpen,
  } = useAchievementsPage();

  async function handleOcConnect() {
    setOcConnectError(null);
    if (!isInitialized || !ocAuth) return;
    try {
      setOcConnectLoading(true);
      await ocAuth.signInWithRedirect({ state: "corelia-ocid-connect" });
    } catch (error) {
      setOcConnectError(
        error instanceof Error ? error.message : t("openCampusConnect.modal.startFailed"),
      );
      setOcConnectLoading(false);
    }
  }

  const earnedBadges = badges.filter((badge) => !badge.locked);
  const toggleVault = (vault: VaultKey) => {
    setOpenVault((current) => (current === vault ? null : vault));
  };

  return (
    <div className="container-app min-w-0 py-6 sm:py-8">
      {loadError && (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">{loadError}</p>
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" disabled={loading} onClick={() => void reloadAchievements()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
            {t("achievements.loadError.retry")}
          </Button>
        </div>
      )}

      <main className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
          <button type="button" aria-expanded={openVault === "certificates"} aria-controls="certificate-vault" onClick={() => toggleVault("certificates")} className="flex w-full min-w-0 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-6">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary sm:size-11">
                <Award className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-medium text-foreground">{t("achievements.vaults.certificates.title")}</span>
                <span className="mt-1 block text-sm leading-6 text-foreground-muted">{t("achievements.vaults.certificates.subtitle")}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-surface-raised px-3 py-1 text-xs text-foreground-muted tabular-nums">{t("achievements.vaults.certificates.countLabel", { count: certificates.length })}</span>
              <ChevronDown className={cn("size-5 text-foreground-muted transition-transform duration-200 md:hidden", openVault === "certificates" && "rotate-180")} aria-hidden />
            </span>
          </button>
          <div className={cn("grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none md:grid-rows-[1fr]", openVault === "certificates" && "grid-rows-[1fr]")}>
            <div className="min-h-0 overflow-hidden">
              <div id="certificate-vault" className="border-t border-border-subtle p-4 sm:p-6">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Loader2 className="size-6 animate-spin text-foreground-muted" aria-hidden />
                  <p className="text-sm font-medium text-foreground">{t("achievements.vaults.certificates.loading")}</p>
                </div>
              ) : certificates.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised"><Award className="size-6 text-foreground-muted" aria-hidden /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{certificateSyncCandidates.length > 0 ? t("achievements.vaults.certificates.syncTitle") : t("achievements.vaults.certificates.empty")}</p>
                    {certificateSyncCandidates.length > 0 ? <p className="mt-1 max-w-md text-sm leading-6 text-foreground-muted">{t("achievements.vaults.certificates.syncDescription")}</p> : null}
                  </div>
                  {certificateSyncCandidates.length > 0 ? (
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {certificateSyncCandidates.map((item) => {
                        const syncing = syncingCourseId === item.courseId;
                        return (
                          <Button key={item.courseId} type="button" size="sm" variant="secondary" disabled={!!syncingCourseId} onClick={() => void handleSyncCertificate(item.courseId)}>
                            {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                            {t("achievements.vaults.certificates.syncCourse", { course: item.courseTitle })}
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {certificates.map((cert) => <CertificateCard key={cert.id} cert={cert} onOpenModal={openModal} />)}
                </div>
              )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
          <button type="button" aria-expanded={openVault === "onchain"} aria-controls="onchain-vault" onClick={() => toggleVault("onchain")} className="flex w-full min-w-0 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-6">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:size-11">
                <img src="/open-campus-edu-logo.png" alt="" className="size-5 rounded-full" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-medium text-foreground">{t("achievements.vaults.onchain.title")}</span>
                <span className="mt-1 block text-sm leading-6 text-foreground-muted">{t("achievements.vaults.onchain.subtitle")}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-surface-raised px-3 py-1 text-xs text-foreground-muted tabular-nums">{t("achievements.vaults.badges.summaryOcOnly", { count: earnedBadges.length, defaultValue: "{{count}} on-chain" })}</span>
              <ChevronDown className={cn("size-5 text-foreground-muted transition-transform duration-200 md:hidden", openVault === "onchain" && "rotate-180")} aria-hidden />
            </span>
          </button>
          <div className={cn("grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none md:grid-rows-[1fr]", openVault === "onchain" && "grid-rows-[1fr]")}>
            <div className="min-h-0 overflow-hidden">
              <div id="onchain-vault" className="border-t border-border-subtle p-4 sm:p-6">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Loader2 className="size-6 animate-spin text-foreground-muted" aria-hidden />
                  <p className="text-sm font-medium text-foreground">{t("achievements.vaults.badges.loading")}</p>
                </div>
              ) : (
                <OcBadgesByScopeTabs badges={earnedBadges} loading={false} onOpenModal={openModal} onRetry={handleRetryBadge} />
              )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <OcCredentialModal item={modalItem} open={modalOpen} onOpenChange={setModalOpen} onClaim={handleClaim} onConnectOcid={() => { setModalOpen(false); setOcidConnectOpen(true); }} claiming={claiming} />
      <OpenCampusConnectDialog open={ocidConnectOpen} onOpenChange={setOcidConnectOpen} onConnect={() => void handleOcConnect()} disabled={!isInitialized || !ocAuth} loading={ocConnectLoading} error={ocConnectError} />
    </div>
  );
}
