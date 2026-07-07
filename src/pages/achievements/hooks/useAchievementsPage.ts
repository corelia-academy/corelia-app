import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  fetchCourseIssuanceMapForUser,
  fetchMyCredentialIssuances,
  issuanceToBadgeItem,
  type CourseIssuanceInfo,
} from "@/lib/credentialIssuances";
import { CREDENTIAL_SYNC_EVENT } from "@/components/base/CredentialRealtimeSync";
import { invokeCheckCourseCredential, invokeListActiveOcaTemplates } from "@/lib/credentialsEdge";
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
import type { Enrollment } from "@/types/courses";

import type {
  BadgeItem,
  CertificateItem,
  ClaimStatus,
  ModalItem,
} from "../types";
import {
  buildCourseCertificates,
  buildUnclaimedOcaBadges,
  ocidWithEduSuffix,
} from "../utils/buildAchievementsData";

export interface CertificateSyncCandidate {
  courseId: string;
  courseTitle: string;
}

export function useAchievementsPage() {
  const { user, isAuthenticated, profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
  const [certificateSyncCandidates, setCertificateSyncCandidates] = useState<
    CertificateSyncCandidate[]
  >([]);
  const [ocidConnectOpen, setOcidConnectOpen] = useState(false);
  const { t } = useTranslation("common");

  const loadAchievements = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setCertificates([]);
      setBadges([]);
      setCertificateSyncCandidates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Invalidate course cache so certificate template URLs (CDN) are always fresh
      invalidateCourseCache();
      await backfillMissingEnrollmentsForUser(user.id).catch(() => 0);
      const [enrollments, courseIssuanceMap, ocRows] = await Promise.all([
        getMyEnrollments(user.id).catch(() => [] as Enrollment[]),
        fetchCourseIssuanceMapForUser(user.id).catch(() => new Map<string, CourseIssuanceInfo>()),
        fetchMyCredentialIssuances(user.id).catch(() => []),
      ]);

      const courseIds = Array.from(new Set(enrollments.map((item) => item.course_id)));
      const [courseRows, ocaTemplateMap] = await Promise.all([
        Promise.all(courseIds.map(async (courseId) => [courseId, await getCourse(courseId)] as const)),
        invokeListActiveOcaTemplates(courseIds).catch((e) => {
          console.error("OCA Template Fetch Error:", e);
          return new Map();
        }),
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
        ocaTemplateMap,
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

      const courseIdsWithOcaIssuance = new Set(
        ocRows
          .filter((row) => row.course_id && !row.template?.collection_symbol)
          .map((row) => row.course_id!),
      );
      const virtualOcaBadges = buildUnclaimedOcaBadges(
        enrollmentCertificates,
        ocaTemplateMap,
        courseIdsWithOcaIssuance,
      );

      setCertificates(nextCertificates);
      setBadges([
        ...ocRows.map((row) => issuanceToBadgeItem(row, profile?.ocid)),
        ...virtualOcaBadges,
      ]);
      setCertificateSyncCandidates(
        pendingCandidates.filter((item): item is CertificateSyncCandidate => !!item),
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, profile?.full_name, profile?.ocid, t, user]);

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
    // Virtual "unclaimed" OCA cards have no real issuance behind them yet —
    // block opening the modal from any entry point (BadgeCard, the "Recent
    // achievements" list, etc.) and route the user to the Certificate card.
    if (item.kind === "badge" && item.data.ocClaimStatus === "unclaimed_virtual") return;
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

  const handleClaim = async (id: string, kind: "cert" | "badge") => {
    if (kind === "badge") return;

    const cert = certificates.find((c) => c.id === id);
    if (!cert?.courseId) return;

    if (!profile?.ocid?.trim()) {
      setOcidConnectOpen(true);
      return;
    }

    setClaiming(true);
    patchCert(id, { ocClaimStatus: "pending" });

    try {
      await invokeCheckCourseCredential(cert.courseId);

      // Reload issuances (with template info) so we can both patch the cert
      // status and replace the virtual badge with the real minted one.
      const issuances = await fetchMyCredentialIssuances(user!.id);
      const row = issuances.find(
        (r) => r.course_id === cert.courseId && !r.template?.collection_symbol,
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
        ...prev.filter((b) => b.id !== `virtual-${cert.courseId}`),
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
      } else if (newBadge.status === "pending") {
        patchCert(id, { ocClaimStatus: "pending" });
        toast.info(t("achievements.oc.modal.claimToast.pending"));
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
