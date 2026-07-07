import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  fetchCourseIssuanceMapForUser,
  fetchMyCredentialIssuances,
  issuanceToBadgeItem,
  type CourseIssuanceInfo,
} from "@/lib/credentialIssuances";
import {
  getCourse,
  getMyEnrollments,
} from "@/lib/courses";
import type { Enrollment } from "@/types/courses";

import type {
  BadgeItem,
  CertificateItem,
  ModalItem,
} from "../../../achievements/types";
import { buildCourseCertificates } from "../../../achievements/utils/buildAchievementsData";
import { getPublicProfileById } from "@/lib/profile";

export function usePublicAchievements(profileId: string | undefined) {
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation("common");

  const loadAchievements = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      const profile = await getPublicProfileById(profileId);
      
      const [enrollments, courseIssuanceMap, ocRows] = await Promise.all([
        getMyEnrollments(profileId).catch(() => [] as Enrollment[]),
        fetchCourseIssuanceMapForUser(profileId).catch(() => new Map<string, CourseIssuanceInfo>()),
        fetchMyCredentialIssuances(profileId).catch(() => []),
      ]);

      const mintedOcRows = ocRows.filter((r) => r.status === "minted");

      const courseIds = Array.from(
        new Set(enrollments.filter((e) => e.certificate_issued_at).map((item) => item.course_id)),
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
      
      // Only include enrollments that have certificate_issued_at
      const certifiedEnrollments = enrollments.filter(e => e.certificate_issued_at);
      
      const enrollmentCertificates = buildCourseCertificates(
        certifiedEnrollments,
        courseMap,
        certificateLabels,
        courseIssuanceMap,
        profile?.ocid,
        profile?.full_name,
      );
      const nextCertificates = [...enrollmentCertificates].sort((a, b) => {
        const aDate = a.issuedAt.split("/").reverse().join("-");
        const bDate = b.issuedAt.split("/").reverse().join("-");
        return bDate.localeCompare(aDate);
      });

      setCertificates(nextCertificates);
      setBadges(mintedOcRows.map((row) => issuanceToBadgeItem(row, profile?.ocid)));
    } finally {
      setLoading(false);
    }
  }, [profileId, t]);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  const openModal = (item: ModalItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  return {
    certificates,
    badges,
    loading,
    modalItem,
    modalOpen,
    setModalOpen,
    openModal,
  };
}
