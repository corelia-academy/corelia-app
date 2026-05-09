import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCourse, getMyEnrollments } from "@/lib/courses";
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
  buildMilestoneBadges,
} from "../utils/buildAchievementsData";

export function useAchievementsPage() {
  const { user, isAuthenticated } = useAuth();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation("common");

  useEffect(() => {
    let cancelled = false;

    const milestonesBlock = {
      milestones: {
        courseFirst: {
          title: t("achievements.milestones.courseFirst.title"),
          description: t("achievements.milestones.courseFirst.description"),
        },
        courseThree: {
          title: t("achievements.milestones.courseThree.title"),
          description: t("achievements.milestones.courseThree.description"),
        },
        firstCertificate: {
          title: t("achievements.milestones.firstCertificate.title"),
          description: t("achievements.milestones.firstCertificate.description"),
        },
        threeCertificates: {
          title: t("achievements.milestones.threeCertificates.title"),
          description: t("achievements.milestones.threeCertificates.description"),
        },
      },
    };

    async function loadAchievements() {
      if (!user || !isAuthenticated) {
        if (!cancelled) {
          setCertificates([]);
          setBadges(buildMilestoneBadges([], milestonesBlock));
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const enrollments = await getMyEnrollments(user.id).catch(
          () => [] as Enrollment[],
        );

        const courseIds = Array.from(
          new Set(enrollments.map((item) => item.course_id)),
        );

        const courseRows = await Promise.all(
          courseIds.map(
            async (courseId) => [courseId, await getCourse(courseId)] as const,
          ),
        );

        if (cancelled) return;

        const courseMap = new Map(courseRows);
        const nextCertificates = buildCourseCertificates(
          enrollments,
          courseMap,
          {
            courseCompletionTitle: t(
              "achievements.certificates.courseCompletionTitle",
            ),
            fallbackCourseName: t(
              "achievements.certificates.fallbackCourseName",
            ),
            fallbackInstructorName: t(
              "achievements.certificates.fallbackInstructorName",
            ),
          },
        ).sort((a, b) => {
          const aDate = a.issuedAt.split("/").reverse().join("-");
          const bDate = b.issuedAt.split("/").reverse().join("-");
          return bDate.localeCompare(aDate);
        });
        const nextBadges = buildMilestoneBadges(enrollments, milestonesBlock);

        setCertificates(nextCertificates);
        setBadges(nextBadges);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAchievements();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, t, user]);

  const openModal = (item: ModalItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const handleClaim = async (id: string, kind: "cert" | "badge") => {
    setClaiming(true);

    const setPending = (status: ClaimStatus) => {
      if (kind === "cert") {
        setCertificates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ocClaimStatus: status } : c)),
        );
        setModalItem((prev) =>
          prev?.kind === "cert" && prev.data.id === id
            ? { kind: "cert", data: { ...prev.data, ocClaimStatus: status } }
            : prev,
        );
      } else {
        setBadges((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ocClaimStatus: status } : b)),
        );
        setModalItem((prev) =>
          prev?.kind === "badge" && prev.data.id === id
            ? { kind: "badge", data: { ...prev.data, ocClaimStatus: status } }
            : prev,
        );
      }
    };

    setPending("pending");
    await new Promise((res) => setTimeout(res, 2500));

    const mockTxHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")}`;
    const mockOcUrl =
      "https://id.opencampus.xyz/public/credentials?username=student.edu";

    if (kind === "cert") {
      setCertificates((prev) => {
        const next = prev.map((c) =>
          c.id === id
            ? {
                ...c,
                ocClaimStatus: "claimed" as ClaimStatus,
                ocTransactionHash: mockTxHash,
                ocCredentialUrl: mockOcUrl,
                ocHolderOcId: "student.edu",
              }
            : c,
        );
        const updated = next.find((c) => c.id === id);
        if (updated) setModalItem({ kind: "cert", data: updated });
        return next;
      });
    } else {
      setBadges((prev) => {
        const next = prev.map((b) =>
          b.id === id
            ? {
                ...b,
                ocClaimStatus: "claimed" as ClaimStatus,
                ocTransactionHash: mockTxHash,
                ocCredentialUrl: mockOcUrl,
              }
            : b,
        );
        const updated = next.find((b) => b.id === id);
        if (updated) setModalItem({ kind: "badge", data: updated });
        return next;
      });
    }

    setClaiming(false);
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
