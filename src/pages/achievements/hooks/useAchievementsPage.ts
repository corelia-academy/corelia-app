import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  fetchCourseIssuanceMapForUser,
  fetchMintedCredentialIssuancesForUser,
  issuanceToBadgeItem,
  openCampusCredentialExplorerUrl,
  type CourseIssuanceInfo,
} from "@/lib/credentialIssuances";
import { invokeCheckCourseCredential } from "@/lib/credentialsEdge";
import { getCourse, getMyEnrollments } from "@/lib/courses";
import { useAuth } from "@/stores/authStore";
import type { Enrollment } from "@/types/courses";

import type {
  BadgeItem,
  CertificateItem,
  ClaimStatus,
  ModalItem,
} from "../types";
import { buildCourseCertificates } from "../utils/buildAchievementsData";

function ocidWithEduSuffix(ocid: string | null | undefined): string | undefined {
  if (!ocid?.trim()) return undefined;
  const s = ocid.trim();
  return s.endsWith(".edu") ? s : `${s}.edu`;
}

export function useAchievementsPage() {
  const { user, isAuthenticated, profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation("common");

  const loadAchievements = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setCertificates([]);
      setBadges([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [enrollments, courseIssuanceMap, ocRows] = await Promise.all([
        getMyEnrollments(user.id).catch(() => [] as Enrollment[]),
        fetchCourseIssuanceMapForUser(user.id).catch(() => new Map<string, CourseIssuanceInfo>()),
        fetchMintedCredentialIssuancesForUser(user.id).catch(() => []),
      ]);

      const courseIds = Array.from(new Set(enrollments.map((item) => item.course_id)));
      const courseRows = await Promise.all(
        courseIds.map(async (courseId) => [courseId, await getCourse(courseId)] as const),
      );
      const courseMap = new Map(courseRows);

      const nextCertificates = buildCourseCertificates(
        enrollments,
        courseMap,
        {
          courseCompletionTitle: t("achievements.certificates.courseCompletionTitle"),
          fallbackCourseName: t("achievements.certificates.fallbackCourseName"),
          fallbackInstructorName: t("achievements.certificates.fallbackInstructorName"),
        },
        courseIssuanceMap,
        profile?.ocid,
      ).sort((a, b) => {
        const aDate = a.issuedAt.split("/").reverse().join("-");
        const bDate = b.issuedAt.split("/").reverse().join("-");
        return bDate.localeCompare(aDate);
      });

      setCertificates(nextCertificates);
      setBadges(ocRows.map(issuanceToBadgeItem));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t, user]);

  useEffect(() => {
    void loadAchievements();
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

    setClaiming(true);
    patchCert(id, { ocClaimStatus: "pending" });

    try {
      await invokeCheckCourseCredential(cert.courseId);

      // Reload issuance status from DB
      const map = await fetchCourseIssuanceMapForUser(user!.id);
      const info = map.get(cert.courseId);

      if (info?.status === "minted") {
        const ocCredentialId = info.oc_credential_id ?? null;
        const ocCredentialUrl = ocCredentialId
          ? openCampusCredentialExplorerUrl(ocCredentialId) ?? undefined
          : undefined;
        patchCert(id, {
          ocClaimStatus: "claimed" as ClaimStatus,
          ocCredentialId,
          ocCredentialUrl,
          credentialId: ocCredentialId ?? cert.credentialId,
          ocHolderOcId: ocidWithEduSuffix(profile?.ocid),
        });
      } else if (info?.status === "failed") {
        patchCert(id, { ocClaimStatus: "failed" });
      } else if (info?.status === "pending") {
        patchCert(id, { ocClaimStatus: "pending" });
      } else {
        // No issuance — template not active or criteria not met
        patchCert(id, { ocClaimStatus: "unclaimed" });
      }
    } catch {
      patchCert(id, { ocClaimStatus: "failed" });
    } finally {
      setClaiming(false);
    }
  };

  return {
    certificates,
    badges,
    loading,
    modalItem,
    modalOpen,
    setModalOpen,
    claiming,
    openModal,
    handleClaim,
  };
}
