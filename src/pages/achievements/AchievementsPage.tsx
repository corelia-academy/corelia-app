import {
  Award,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOCAuth } from "@opencampus/ocid-connect-js";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import OpenCampusConnectDialog from "@/components/layouts/OpenCampusConnectDialog";

import { OcBadgesByScopeTabs } from "./components/OcBadgesByScopeTabs";
import { CertificateCard } from "./components/CertificateCard";
import { OcClaimBadge } from "./components/OcClaimBadge";
import { OcCredentialModal } from "./components/OcCredentialModal";
import { StatsBar } from "./components/StatsBar";
import { useAchievementsPage } from "./hooks/useAchievementsPage";

export default function AchievementsPage() {
  const { t } = useTranslation("common");
  const { ocAuth, isInitialized } = useOCAuth();
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
    } catch (e) {
      setOcConnectError(e instanceof Error ? e.message : t("openCampusConnect.modal.startFailed"));
      setOcConnectLoading(false);
    }
  }

  const earnedBadges = badges.filter((b) => !b.locked);
  const lockedBadges = badges.filter((b) => b.locked);
  const claimedCount = [
    ...certificates.filter((c) => c.ocClaimStatus === "claimed"),
    ...earnedBadges.filter((b) => b.ocClaimStatus === "claimed"),
  ].length;
  const pendingCount = [
    ...certificates.filter((c) => c.ocClaimStatus === "pending"),
    ...earnedBadges.filter((b) => b.ocClaimStatus === "pending"),
  ].length;
  const unclaimedCount = [
    ...certificates.filter((c) => c.ocClaimStatus === "unclaimed"),
    ...earnedBadges.filter((b) => b.ocClaimStatus === "unclaimed"),
  ].length;
  const recentCertificates = certificates.slice(0, 3);
  const recentBadges = earnedBadges.slice(0, 4);
  const nextMilestones = lockedBadges.slice(0, 3);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {loadError && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 sm:flex-row sm:items-center sm:justify-between"
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
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
            {t("achievements.loadError.retry")}
          </Button>
        </div>
      )}

      <section className="mb-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
        <div className="relative p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_oklch,var(--primary-container)_58%,transparent),transparent_72%)]" />
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                {t("achievements.hero.eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
                {t("achievements.hero.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground-muted sm:text-base">
                {t("achievements.hero.subtitlePrefix")}{" "}
                <a
                  href="https://opencampus.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Open Campus
                </a>{" "}
                {t("achievements.hero.subtitleSuffix")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-border-subtle bg-surface-base/85 px-3 py-2 text-sm text-foreground">
                  {t("achievements.hero.certCount", { count: certificates.length })}
                </div>
                <div className="rounded-full border border-border-subtle bg-surface-base/85 px-3 py-2 text-sm text-foreground">
                  {t("achievements.hero.badgeUnlockedCount", {
                    count: earnedBadges.length,
                  })}
                </div>
                <div className="rounded-full border border-border-subtle bg-surface-base/85 px-3 py-2 text-sm text-foreground">
                  {t("achievements.hero.readyToClaimCount", {
                    count: unclaimedCount,
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card/85 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">
                  {t("achievements.hero.claimedOnOc.title")}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {claimedCount}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground-muted">
                  {t("achievements.hero.claimedOnOc.description")}
                </p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card/85 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">
                  {t("achievements.hero.pending.title")}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {pendingCount}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground-muted">
                  {t("achievements.hero.pending.description")}
                </p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card/85 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-foreground-muted">
                  {t("achievements.hero.nextMilestone")}
                </p>
                <p className="mt-2 text-lg font-medium text-foreground">
                  {nextMilestones[0]?.title ??
                    t("achievements.milestones.next.titleFallback")}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground-muted">
                  {nextMilestones[0]?.description ??
                    t("achievements.milestones.next.descriptionFallback")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <StatsBar certificates={certificates} badges={badges} />
      </div>

      <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-foreground-muted">
            {t("achievements.meaning.title")}
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-foreground-muted">
            <p>{t("achievements.meaning.p1")}</p>
            <p>{t("achievements.meaning.p2")}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-foreground-muted">
            {t("achievements.useCases.title")}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span
                key={idx}
                className="rounded-full border border-border-subtle bg-surface-base px-3 py-2 text-sm text-foreground"
              >
                {t(`achievements.useCases.items.${idx}` as never)}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-foreground-muted">
            {t("achievements.useCases.note")}
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground-muted">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("achievements.recent.title")}
          </div>
          {loading ? (
            <div className="mt-5 flex min-h-44 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border-subtle bg-surface-raised text-center">
              <Loader2
                className="size-10 animate-spin text-foreground-subtle"
                aria-hidden
              />
              <p className="text-sm text-foreground-muted">
                {t("achievements.recent.loading")}
              </p>
            </div>
          ) : recentBadges.length === 0 && recentCertificates.length === 0 ? (
            <div className="mt-5 flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
                <Trophy className="size-6 text-foreground-subtle" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("achievements.recent.empty")}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentCertificates.map((cert) => (
                <Button
                  key={cert.id}
                  type="button"
                  variant="ghost"
                  onClick={() => openModal({ kind: "cert", data: cert })}
                  className="h-auto w-full justify-start rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-left hover:bg-surface-raised"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Award className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {cert.course}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground-muted">
                      {cert.title} · {cert.issuedAt}
                    </div>
                  </div>
                  {(cert.hasOnchainCredentialTemplate || cert.ocClaimStatus !== "unclaimed") && (
                    <OcClaimBadge status={cert.ocClaimStatus} />
                  )}
                </Button>
              ))}
              {recentBadges.map((badge) => (
                <Button
                  key={badge.id}
                  type="button"
                  variant="ghost"
                  onClick={() => openModal({ kind: "badge", data: badge })}
                  className="h-auto w-full justify-start rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-left hover:bg-surface-raised"
                >
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-md",
                      badge.bgColor,
                      badge.color,
                    )}
                  >
                    {badge.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {badge.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground-muted">
                      {badge.description}
                    </div>
                  </div>
                  <OcClaimBadge status={badge.ocClaimStatus} />
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground-muted">
            <Lock className="size-4" aria-hidden />
            Sắp mở khóa
          </div>
          <div className="mt-5 space-y-3">
            {nextMilestones.length > 0 ? (
              nextMilestones.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-md border border-border-subtle bg-surface-raised p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-base text-foreground-muted">
                      {badge.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {badge.title}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-foreground-muted">
                        {badge.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm leading-6 text-foreground-muted">
                {t("achievements.vaults.nextUnlock.allUnlockedNote")}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t("achievements.vaults.certificates.title")}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("achievements.vaults.certificates.subtitle")}
            </p>
          </div>
          <div className="rounded-full bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
            {t("achievements.vaults.certificates.countLabel", {
              count: certificates.length,
            })}
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <Loader2
                className="size-6 animate-spin text-foreground-muted"
                aria-hidden
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("achievements.vaults.certificates.loading")}
              </p>
            </div>
          </div>
        ) : certificates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <Award className="size-6 text-foreground-muted" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {certificateSyncCandidates.length > 0
                  ? t("achievements.vaults.certificates.syncTitle")
                  : t("achievements.vaults.certificates.empty")}
              </p>
              {certificateSyncCandidates.length > 0 ? (
                <p className="mt-1 max-w-md text-sm leading-6 text-foreground-muted">
                  {t("achievements.vaults.certificates.syncDescription")}
                </p>
              ) : null}
            </div>
            {certificateSyncCandidates.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {certificateSyncCandidates.map((item) => {
                  const syncing = syncingCourseId === item.courseId;
                  return (
                    <Button
                      key={item.courseId}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!!syncingCourseId}
                      onClick={() => void handleSyncCertificate(item.courseId)}
                    >
                      {syncing ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden />
                      )}
                      {t("achievements.vaults.certificates.syncCourse", {
                        course: item.courseTitle,
                      })}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <CertificateCard
                key={cert.id}
                cert={cert}
                onOpenModal={openModal}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t("achievements.vaults.badges.title")}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("achievements.vaults.badges.subtitle")}
            </p>
          </div>
          <div className="rounded-full bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
            {t("achievements.vaults.badges.summaryOcOnly", {
              count: earnedBadges.length,
              defaultValue: "{{count}} on-chain",
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <Loader2
                className="size-6 animate-spin text-foreground-muted"
                aria-hidden
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("achievements.vaults.badges.loading")}
              </p>
            </div>
          </div>
        ) : (
          <OcBadgesByScopeTabs badges={earnedBadges} loading={false} onOpenModal={openModal} />
        )}
      </section>

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
    </div>
  );
}
