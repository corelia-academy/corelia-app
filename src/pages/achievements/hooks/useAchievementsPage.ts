import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  fetchCourseIssuanceMapForUser,
  fetchMyCredentialIssuances,
  issuanceToBadgeItem,
} from "@/lib/credentialIssuances";
import { CREDENTIAL_SYNC_EVENT } from "@/components/base/CredentialRealtimeSync";
import {
  invokeCheckCourseCredential,
  invokeListActiveCourseCredentialTemplates,
} from "@/lib/credentialsEdge";
import {
  backfillMissingEnrollmentsForUser,
  checkAndIssueCertificate,
  computeProgressPercent,
  courseHasCertificate,
  ensureEnrollmentForProgress,
  getCourse,
  getCourseLessons,
  getLessonProgressForCourse,
  getMyEnrollments,
  invalidateCourseCache,
  syncCourseCompletion,
} from "@/lib/courses";
import { useAuth } from "@/stores/authStore";
import type {
  BadgeItem,
  CertificateItem,
  ClaimStatus,
  ModalItem,
} from "../types";
import {
  buildCourseCertificates,
  buildStandaloneCourseCredentialBadges,
  ocidWithEduSuffix,
} from "../utils/buildAchievementsData";

export interface CertificateSyncCandidate {
  courseId: string;
  courseTitle: string;
}

export function useAchievementsPage(enabled = true) {
  const { user, isAuthenticated, profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
  const [certificateSyncCandidates, setCertificateSyncCandidates] = useState<
    CertificateSyncCandidate[]
  >([]);
  const [ocidConnectOpen, setOcidConnectOpen] = useState(false);
  const { t } = useTranslation("common");

  const loadAchievements = useCallback(async () => {
    if (!enabled || !user || !isAuthenticated) {
      setCertificates([]);
      setBadges([]);
      setCertificateSyncCandidates([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      // Invalidate course cache so certificate template URLs (CDN) are always fresh
      invalidateCourseCache();
      await backfillMissingEnrollmentsForUser(user.id).catch(() => 0);
      const [enrollments, courseIssuanceMap, ocRows] = await Promise.all([
        getMyEnrollments(user.id),
        fetchCourseIssuanceMapForUser(user.id),
        fetchMyCredentialIssuances(user.id),
      ]);

      const courseIds = Array.from(new Set(enrollments.map((item) => item.course_id)));
      const [courseRows, courseCredentialTemplateMap] = await Promise.all([
        Promise.all(courseIds.map(async (courseId) => [courseId, await getCourse(courseId)] as const)),
        invokeListActiveCourseCredentialTemplates(courseIds),
      ]);
      const courseMap = new Map(courseRows);

      const certificateLabels = {
        courseCompletionTitle: t("achievements.certificates.courseCompletionTitle"),
        fallbackCourseName: t("achievements.certificates.fallbackCourseName"),
        fallbackInstructorName: t("achievements.certificates.fallbackInstructorName"),
      };
      const enrollmentCertificates = buildCourseCertificates(
        enrollments,
        courseMap,
        certificateLabels,
        courseIssuanceMap,
        profile?.ocid,
        profile?.full_name,
        courseCredentialTemplateMap,
      );
      const nextCertificates = [...enrollmentCertificates].sort((a, b) => {
        const aDate = a.issuedAt.split("/").reverse().join("-");
        const bDate = b.issuedAt.split("/").reverse().join("-");
        return bDate.localeCompare(aDate);
      });
      const pendingCandidates = await Promise.all(
        enrollments
          .filter((item) => !item.certificate_issued_at)
          .map(async (item): Promise<CertificateSyncCandidate | null> => {
            const course = courseMap.get(item.course_id);
            if (!courseHasCertificate(course)) return null;
            const [lessons, progressRows] = await Promise.all([
              getCourseLessons(item.course_id).catch(() => []),
              getLessonProgressForCourse(user.id, item.course_id).catch(() => []),
            ]);
            if (lessons.length === 0) return null;
            if (computeProgressPercent(lessons, progressRows) < 100) return null;
            return {
              courseId: item.course_id,
              courseTitle: course?.title || t("achievements.certificates.fallbackCourseName"),
            };
          }),
      );

      const courseIdsWithCredentialIssuance = new Set(
        ocRows
          .filter((row) => row.course_id)
          .map((row) => row.course_id!),
      );
      const standaloneCourseCredentialBadges = buildStandaloneCourseCredentialBadges(
        courseIds,
        courseMap,
        courseCredentialTemplateMap,
        courseIdsWithCredentialIssuance,
      );
      const nextBadges = [
        ...ocRows.map((row) => issuanceToBadgeItem(row, profile?.ocid)),
        ...standaloneCourseCredentialBadges,
      ];

      setCertificates(nextCertificates);
      setBadges(nextBadges);
      setModalItem((current) => {
        if (!current) return current;

        if (current.kind === "cert") {
          const nextCertificate = nextCertificates.find((item) => item.id === current.data.id);
          return nextCertificate ? { kind: "cert", data: nextCertificate } : current;
        }

        const nextBadge = nextBadges.find(
          (item) =>
            item.id === current.data.id ||
            (Boolean(current.data.courseId) &&
              Boolean(current.data.templateId) &&
              item.courseId === current.data.courseId &&
              item.templateId === current.data.templateId),
        );
        return nextBadge ? { kind: "badge", data: nextBadge } : current;
      });
      setCertificateSyncCandidates(
        pendingCandidates.filter((item): item is CertificateSyncCandidate => !!item),
      );
    } catch (error) {
      console.error("[achievements] load failed", error);
      // Do not replace already-rendered achievements with empty collections on
      // a transient Supabase/Edge failure; that would falsely expose minted
      // credentials as unclaimed.
      setLoadError(t("achievements.loadError.body"));
    } finally {
      setLoading(false);
    }
  }, [enabled, isAuthenticated, profile?.full_name, profile?.ocid, t, user]);

  useEffect(() => {
    void loadAchievements();
    const handleSync = () => {
      void loadAchievements();
    };
    window.addEventListener(CREDENTIAL_SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener(CREDENTIAL_SYNC_EVENT, handleSync);
    };
  }, [loadAchievements]);

  const openModal = (item: ModalItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const patchCert = (id: string, patch: Partial<CertificateItem>) => {
    setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setModalItem((prev) =>
      prev?.kind === "cert" && prev.data.id === id
        ? { kind: "cert", data: { ...prev.data, ...patch } }
        : prev,
    );
  };

  const patchBadge = (id: string, patch: Partial<BadgeItem>) => {
    setBadges((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setModalItem((prev) =>
      prev?.kind === "badge" && prev.data.id === id
        ? { kind: "badge", data: { ...prev.data, ...patch } }
        : prev,
    );
  };

  // Standalone course credentials have no offchain certificate, so their
  // claim is initiated directly from the OCA/OCB card.
  const handleClaimStandaloneCourseCredential = async (id: string) => {
    const badge = badges.find((b) => b.id === id);
    if (!badge?.courseId) return;

    if (!profile?.ocid?.trim()) {
      setOcidConnectOpen(true);
      return;
    }

    setClaiming(true);
    patchBadge(id, { ocClaimStatus: "pending" });

    try {
      await invokeCheckCourseCredential(badge.courseId);

      const issuances = await fetchMyCredentialIssuances(user!.id);
      const row = issuances.find(
        (r) => r.course_id === badge.courseId && r.template_id === badge.templateId,
      );

      if (!row) {
        patchBadge(id, { ocClaimStatus: "unclaimed" });
        toast.error(t("achievements.oc.modal.claimToast.error.notEligible"));
        return;
      }

      const newBadge = issuanceToBadgeItem(row, profile?.ocid);
      setBadges((prev) => [newBadge, ...prev.filter((b) => b.id !== id)]);

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
    } catch (err) {
      patchBadge(id, { ocClaimStatus: "failed" });
      toast.error(err instanceof Error ? err.message : t("achievements.oc.modal.claimToast.error.failed"));
    } finally {
      setClaiming(false);
    }
  };

  const handleClaim = async (id: string, kind: "cert" | "badge") => {
    if (kind === "badge") {
      await handleClaimStandaloneCourseCredential(id);
      return;
    }

    const cert = certificates.find((c) => c.id === id);
    if (!cert?.courseId) return;
    // Certi + OCB is auto-issued at completion. Its card can only View the
    // resulting OCB and must never enter the manual OCA claim path.
    if (cert.onchainCredentialAutoIssued) return;

    if (!profile?.ocid?.trim()) {
      setOcidConnectOpen(true);
      return;
    }

    setClaiming(true);
    patchCert(id, { ocClaimStatus: "pending" });

    try {
      await invokeCheckCourseCredential(cert.courseId);

      // Reload issuances (with template info) so we can patch the certificate
      // status and add the newly minted OCA or OCB card.
      const issuances = await fetchMyCredentialIssuances(user!.id);
      const row = issuances.find(
        (r) => r.course_id === cert.courseId && r.template_id === cert.onchainTemplateId,
      );

      if (!row) {
        // No issuance record created — template not active or criteria not met
        patchCert(id, { ocClaimStatus: "unclaimed" });
        toast.error(t("achievements.oc.modal.claimToast.error.notEligible"));
        return;
      }

      const newBadge = issuanceToBadgeItem(row, profile?.ocid);
      setBadges((prev) => [
        newBadge,
        ...prev,
      ]);

      if (newBadge.ocClaimStatus === "claimed") {
        patchCert(id, {
          ocClaimStatus: "claimed" as ClaimStatus,
          ocCredentialId: newBadge.mintCredentialId,
          ocCredentialUrl: newBadge.ocCredentialUrl,
          credentialId: newBadge.mintCredentialId ?? cert.credentialId,
          ocHolderOcId: ocidWithEduSuffix(profile?.ocid),
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
        // minted without oc_credential_id, or failed — issuanceToBadgeItem
        // already resolved ocClaimStatus to "failed" for both cases.
        patchCert(id, { ocClaimStatus: "failed" });
        toast.error(t("achievements.oc.modal.claimToast.error.failed"));
      }
    } catch (err) {
      patchCert(id, { ocClaimStatus: "failed" });
      toast.error(err instanceof Error ? err.message : t("achievements.oc.modal.claimToast.error.failed"));
    } finally {
      setClaiming(false);
    }
  };

  const handleSyncCertificate = async (courseId: string) => {
    if (!user) return;
    setSyncingCourseId(courseId);
    try {
      await ensureEnrollmentForProgress(user.id, courseId, new Date().toISOString());
      await syncCourseCompletion(user.id, courseId).catch((err) => {
        console.warn("[achievements] course completion sync before certificate failed", {
          userId: user.id,
          courseId,
          error: err instanceof Error ? err.message : err,
        });
      });
      const result = await checkAndIssueCertificate(user.id, courseId);
      if (result.issued) {
        toast.success(t("achievements.vaults.certificates.syncSuccess"));
      } else {
        toast.info(result.message || t("achievements.vaults.certificates.syncPending"));
      }
      await loadAchievements();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("achievements.vaults.certificates.syncError"),
      );
    } finally {
      setSyncingCourseId(null);
    }
  };

  return {
    certificates,
    badges,
    loading,
    loadError,
    reloadAchievements: loadAchievements,
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
  };
}
