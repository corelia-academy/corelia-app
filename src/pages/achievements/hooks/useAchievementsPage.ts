import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  fetchCourseIssuanceMapForUser,
  fetchMyCredentialIssuances,
  issuanceToBadgeItem,
  openCampusCredentialExplorerUrl,
  type CourseIssuanceInfo,
} from "@/lib/credentialIssuances";
import { CREDENTIAL_SYNC_EVENT } from "@/components/base/CredentialRealtimeSync";
import { invokeCheckCourseCredential } from "@/lib/credentialsEdge";
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
  buildCourseCertificatesFromIssuances,
  ocidWithEduSuffix,
} from "../utils/buildAchievementsData";
import { renderAndUploadCertificate } from "../utils/renderCertificate";

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

      const mintedOcRows = ocRows.filter((r) => r.status === "minted");

      const courseIds = Array.from(
        new Set([
          ...enrollments.map((item) => item.course_id),
          ...mintedOcRows
            .filter((row) => row.template?.scope_type === "course" && row.course_id)
            .map((row) => row.course_id!),
        ]),
      );
      const courseRows = await Promise.all(
        courseIds.map(async (courseId) => [courseId, await getCourse(courseId)] as const),
      );
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
      );
      const certificateCourseIds = new Set(
        enrollmentCertificates
          .map((item) => item.courseId)
          .filter((courseId): courseId is string => !!courseId),
      );
      const issuanceCertificates = buildCourseCertificatesFromIssuances(
        mintedOcRows,
        courseMap,
        certificateCourseIds,
        certificateLabels,
        profile?.ocid,
        profile?.full_name,
      );
      const nextCertificates = [...enrollmentCertificates, ...issuanceCertificates].sort((a, b) => {
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

      setCertificates(nextCertificates);
      setBadges(
        ocRows
          .filter((row) => {
            const atype = row.template?.achievement_type;
            return atype === "Badge" || atype === "Award";
          })
          .map((row) => issuanceToBadgeItem(row, profile?.ocid)),
      );
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
      // Render + upload the name-rendered certificate to the deterministic CDN
      // path BEFORE minting, so the backend can embed it as the OC attachment.
      const renderedUrl = await renderAndUploadCertificate(cert, user!.id);
      if (!renderedUrl) {
        throw new Error(t("achievements.oc.modal.claimToast.error.failed"));
      }

      await invokeCheckCourseCredential(cert.courseId);

      // Reload issuance status from DB
      const map = await fetchCourseIssuanceMapForUser(user!.id);
      const info = map.get(cert.courseId);

      if (info?.status === "minted" && info.oc_credential_id) {
        // oc_credential_id must be present — it is proof the credential exists on-chain
        const ocCredentialId = info.oc_credential_id;
        const ocCredentialUrl = openCampusCredentialExplorerUrl(ocCredentialId, {
          username: profile?.ocid,
          nftCollection: "occredential",
        }) ?? undefined;
        patchCert(id, {
          ocClaimStatus: "claimed" as ClaimStatus,
          ocCredentialId,
          ocCredentialUrl,
          credentialId: ocCredentialId,
          ocHolderOcId: ocidWithEduSuffix(profile?.ocid),
        });
      } else if (info?.status === "minted" && !info.oc_credential_id) {
        // Minted status without credential ID = incomplete mint, treat as failed
        patchCert(id, { ocClaimStatus: "failed" });
        toast.error(t("achievements.oc.modal.claimToast.error.failed"));
      } else if (info?.status === "failed") {
        patchCert(id, { ocClaimStatus: "failed" });
        toast.error(t("achievements.oc.modal.claimToast.error.failed"));
      } else if (info?.status === "pending") {
        patchCert(id, { ocClaimStatus: "pending" });
        toast.info(t("achievements.oc.modal.claimToast.pending"));
      } else {
        // No issuance record created — template not active or criteria not met
        patchCert(id, { ocClaimStatus: "unclaimed" });
        toast.error(t("achievements.oc.modal.claimToast.error.notEligible"));
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
