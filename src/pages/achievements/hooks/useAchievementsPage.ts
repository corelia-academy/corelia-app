import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { CREDENTIAL_SYNC_EVENT } from "@/components/base/CredentialRealtimeSync";
import {
  achievementKeys,
  achievementVaultQueryOptions,
  type AchievementVaultData,
} from "@/features/achievements/achievementQueries";
import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import {
  fetchMyCredentialIssuances,
  issuanceToBadgeItem,
} from "@/lib/credentialIssuances";
import { invokeCheckCourseCredential } from "@/lib/credentialsEdge";
import {
  checkAndIssueCertificate,
  ensureEnrollmentForProgress,
  syncCourseCompletion,
} from "@/lib/courses";
import { useAuth } from "@/stores/authStore";
import type { BadgeItem, CertificateItem, ClaimStatus, ModalItem } from "../types";
import { ocidWithEduSuffix } from "../utils/buildAchievementsData";

type ModalSelection = Pick<ModalItem, "kind"> & { id: string };

const EMPTY_VAULT: AchievementVaultData = {
  certificates: [],
  badges: [],
  certificateSyncCandidates: [],
};

export function useAchievementsPage(enabled = true) {
  const { user, isAuthenticated, profile, profileLoading } = useAuth();
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const vaultOptions = achievementVaultQueryOptions({
    userId: user?.id,
    locale,
    holderOcid: profile?.ocid,
    holderName: profile?.full_name,
    labels: {
      courseCompletionTitle: t("achievements.certificates.courseCompletionTitle"),
      fallbackCourseName: t("achievements.certificates.fallbackCourseName"),
      fallbackInstructorName: t("achievements.certificates.fallbackInstructorName"),
    },
    enabled: enabled && isAuthenticated && !profileLoading,
  });
  const vaultQuery = useQuery(vaultOptions);
  const vault = vaultQuery.data ?? EMPTY_VAULT;
  const [modalSelection, setModalSelection] = useState<ModalSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ocidConnectOpen, setOcidConnectOpen] = useState(false);

  const patchVault = useCallback(
    (updater: (current: AchievementVaultData) => AchievementVaultData) => {
      queryClient.setQueryData<AchievementVaultData>(vaultOptions.queryKey, (current) =>
        current ? updater(current) : current,
      );
    },
    [queryClient, vaultOptions.queryKey],
  );

  const patchCert = useCallback(
    (id: string, patch: Partial<CertificateItem>) => {
      patchVault((current) => ({
        ...current,
        certificates: current.certificates.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [patchVault],
  );

  const patchBadge = useCallback(
    (id: string, patch: Partial<BadgeItem>) => {
      patchVault((current) => ({
        ...current,
        badges: current.badges.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [patchVault],
  );

  const openModal = useCallback((item: ModalItem) => {
    setModalSelection({ kind: item.kind, id: item.data.id });
    setModalOpen(true);
  }, []);

  const modalItem = useMemo<ModalItem | null>(() => {
    if (!modalSelection) return null;
    if (modalSelection.kind === "cert") {
      const item = vault.certificates.find(({ id }) => id === modalSelection.id);
      return item ? { kind: "cert", data: item } : null;
    }
    const item = vault.badges.find(({ id }) => id === modalSelection.id);
    return item ? { kind: "badge", data: item } : null;
  }, [modalSelection, vault.badges, vault.certificates]);

  const retryMutation = useMutation({
    mutationFn: (issuanceId: string) =>
      callCoreliaApi<{ status: string; ocCredentialId: string | null }>(
        "credentials.retryPending",
        { issuanceId },
      ),
  });
  const claimMutation = useMutation({
    mutationFn: async (input: { courseId: string; templateId?: string | null }) => {
      await invokeCheckCourseCredential(input.courseId);
      const rows = await fetchMyCredentialIssuances(user!.id);
      return (
        rows.find(
          (row) =>
            row.course_id === input.courseId &&
            (!input.templateId || row.template_id === input.templateId),
        ) ?? null
      );
    },
  });
  const syncMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await ensureEnrollmentForProgress(user!.id, courseId, new Date().toISOString());
      await syncCourseCompletion(user!.id, courseId).catch((error) => {
        console.warn("[achievements] course completion sync before certificate failed", {
          userId: user!.id,
          courseId,
          error: error instanceof Error ? error.message : error,
        });
      });
      return checkAndIssueCertificate(user!.id, courseId);
    },
  });

  useEffect(() => {
    const handleSync = () => {
      void queryClient.invalidateQueries({ queryKey: achievementKeys.all });
    };
    window.addEventListener(CREDENTIAL_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(CREDENTIAL_SYNC_EVENT, handleSync);
  }, [queryClient]);

  const handleRetryBadge = async (badge: BadgeItem) => {
    if (!badge.issuanceId) {
      toast.error(t("achievements.sync.retryError"));
      return;
    }

    patchBadge(badge.id, { ocClaimStatus: "pending" });
    try {
      const result = await retryMutation.mutateAsync(badge.issuanceId);
      if (result.status === "failed") {
        patchBadge(badge.id, { ocClaimStatus: "failed" });
        toast.error(t("achievements.sync.retryError"));
        return;
      }

      void queryClient.invalidateQueries({ queryKey: achievementKeys.all });
      if (result.status === "minted" && !result.ocCredentialId?.trim()) {
        toast.info(t("achievements.oc.modal.reconciliation.title"));
      } else if (result.status === "minted") {
        toast.success(t("achievements.sync.retrySuccess"));
      } else {
        toast.info(t("achievements.oc.modal.claimToast.pending"));
      }
    } catch (error) {
      patchBadge(badge.id, { ocClaimStatus: "failed" });
      console.error("[achievements] credential retry failed", error);
      toast.error(t("achievements.sync.retryError"));
    }
  };

  const handleClaimStandaloneCourseCredential = async (id: string) => {
    const badge = vault.badges.find((item) => item.id === id);
    if (!badge?.courseId) return;
    if (!profile?.ocid?.trim()) {
      setOcidConnectOpen(true);
      return;
    }

    patchBadge(id, { ocClaimStatus: "pending" });
    try {
      const row = await claimMutation.mutateAsync({
        courseId: badge.courseId,
        templateId: badge.templateId,
      });
      if (!row) {
        patchBadge(id, { ocClaimStatus: "unclaimed" });
        toast.error(t("achievements.oc.modal.claimToast.error.notEligible"));
        return;
      }

      const newBadge = issuanceToBadgeItem(row, profile.ocid);
      patchVault((current) => ({
        ...current,
        badges: [newBadge, ...current.badges.filter((item) => item.id !== id)],
      }));
      if (newBadge.ocClaimStatus === "claimed") {
        openModal({ kind: "badge", data: newBadge });
      } else if (
        newBadge.ocClaimStatus === "pending" ||
        newBadge.ocClaimStatus === "awaiting_holder_id"
      ) {
        toast.info(t("achievements.oc.modal.claimToast.pending"));
      } else if (newBadge.ocClaimStatus === "needs_reconciliation") {
        toast.info(t("achievements.oc.modal.reconciliation.title"));
      } else {
        toast.error(t("achievements.oc.modal.claimToast.error.failed"));
      }
      void queryClient.invalidateQueries({ queryKey: achievementKeys.all });
    } catch (error) {
      patchBadge(id, { ocClaimStatus: "failed" });
      console.error("[achievements] standalone credential claim failed", error);
      toast.error(t("achievements.oc.modal.claimToast.error.failed"));
    }
  };

  const handleClaim = async (id: string, kind: "cert" | "badge") => {
    if (kind === "badge") {
      const badge = vault.badges.find((item) => item.id === id);
      if (badge?.ocClaimStatus === "failed" && badge.issuanceId) {
        await handleRetryBadge(badge);
      } else {
        await handleClaimStandaloneCourseCredential(id);
      }
      return;
    }

    const cert = vault.certificates.find((item) => item.id === id);
    if (!cert?.courseId || cert.onchainCredentialAutoIssued) return;
    if (!profile?.ocid?.trim()) {
      setOcidConnectOpen(true);
      return;
    }

    patchCert(id, { ocClaimStatus: "pending" });
    try {
      const row = await claimMutation.mutateAsync({
        courseId: cert.courseId,
        templateId: cert.onchainTemplateId,
      });
      if (!row) {
        patchCert(id, { ocClaimStatus: "unclaimed" });
        toast.error(t("achievements.oc.modal.claimToast.error.notEligible"));
        return;
      }

      const newBadge = issuanceToBadgeItem(row, profile.ocid);
      patchVault((current) => ({
        ...current,
        badges: [newBadge, ...current.badges.filter((item) => item.id !== newBadge.id)],
      }));
      if (newBadge.ocClaimStatus === "claimed") {
        patchCert(id, {
          ocClaimStatus: "claimed" as ClaimStatus,
          ocCredentialId: newBadge.mintCredentialId,
          ocCredentialUrl: newBadge.ocCredentialUrl,
          credentialId: newBadge.mintCredentialId ?? cert.credentialId,
          ocHolderOcId: ocidWithEduSuffix(profile.ocid),
        });
        openModal({ kind: "badge", data: newBadge });
      } else if (
        newBadge.ocClaimStatus === "pending" ||
        newBadge.ocClaimStatus === "awaiting_holder_id"
      ) {
        patchCert(id, { ocClaimStatus: newBadge.ocClaimStatus });
        toast.info(t("achievements.oc.modal.claimToast.pending"));
      } else if (newBadge.ocClaimStatus === "needs_reconciliation") {
        patchCert(id, { ocClaimStatus: "needs_reconciliation" });
        toast.info(t("achievements.oc.modal.reconciliation.title"));
      } else {
        patchCert(id, { ocClaimStatus: "failed" });
        toast.error(t("achievements.oc.modal.claimToast.error.failed"));
      }
      void queryClient.invalidateQueries({ queryKey: achievementKeys.all });
    } catch (error) {
      patchCert(id, { ocClaimStatus: "failed" });
      console.error("[achievements] certificate credential claim failed", error);
      toast.error(t("achievements.oc.modal.claimToast.error.failed"));
    }
  };

  const handleSyncCertificate = async (courseId: string) => {
    if (!user) return;
    try {
      const result = await syncMutation.mutateAsync(courseId);
      if (result.issued) {
        toast.success(t("achievements.vaults.certificates.syncSuccess"));
      } else {
        toast.info(result.message || t("achievements.vaults.certificates.syncPending"));
      }
      await queryClient.invalidateQueries({ queryKey: achievementKeys.all });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("achievements.vaults.certificates.syncError"),
      );
    }
  };

  return {
    certificates: vault.certificates,
    badges: vault.badges,
    loading:
      profileLoading || (vaultQuery.isPending && vaultQuery.fetchStatus !== "idle"),
    loadError: vaultQuery.error ? t("achievements.loadError.body") : null,
    reloadAchievements: vaultQuery.refetch,
    certificateSyncCandidates: vault.certificateSyncCandidates,
    syncingCourseId: syncMutation.isPending ? syncMutation.variables : null,
    modalItem,
    modalOpen,
    setModalOpen,
    claiming: retryMutation.isPending || claimMutation.isPending,
    openModal,
    handleClaim,
    handleRetryBadge,
    handleSyncCertificate,
    ocidConnectOpen,
    setOcidConnectOpen,
  };
}
