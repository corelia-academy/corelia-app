import { queryOptions } from "@tanstack/react-query";

import {
  fetchCourseIssuanceMapForUser,
  fetchMyCredentialIssuances,
  issuanceToBadgeItem,
} from "@/lib/credentialIssuances";
import { invokeListActiveCourseCredentialTemplates } from "@/lib/credentialsEdge";
import {
  computeProgressPercent,
  courseHasCertificate,
  getCoursesByIds,
  getLearnerCourseProgressSnapshot,
  getMyCertificateCodes,
  getMyEnrollments,
} from "@/lib/courses";
import type { BadgeItem, CertificateItem } from "@/pages/achievements/types";
import {
  buildCourseCertificates,
  buildStandaloneCourseCredentialBadges,
} from "@/pages/achievements/utils/buildAchievementsData";

export type CertificateSyncCandidate = {
  courseId: string;
  courseTitle: string;
};

export type AchievementVaultData = {
  certificates: CertificateItem[];
  badges: BadgeItem[];
  certificateSyncCandidates: CertificateSyncCandidate[];
};

export type AchievementLabels = {
  courseCompletionTitle: string;
  fallbackCourseName: string;
  fallbackInstructorName: string;
};

export const achievementKeys = {
  all: ["achievements"] as const,
  vault: (
    userId: string,
    locale: string,
    holderOcid: string,
    holderName: string,
  ) =>
    [
      ...achievementKeys.all,
      "vault",
      userId,
      locale,
      holderOcid,
      holderName,
    ] as const,
};

export function achievementVaultQueryOptions(input: {
  userId: string | undefined;
  locale: string;
  holderOcid?: string | null;
  holderName?: string | null;
  labels: AchievementLabels;
  enabled?: boolean;
}) {
  const userId = input.userId ?? "";
  const holderOcid = input.holderOcid?.trim() ?? "";
  const holderName = input.holderName?.trim() ?? "";

  return queryOptions({
    queryKey: achievementKeys.vault(
      userId || "missing",
      input.locale,
      holderOcid,
      holderName,
    ),
    queryFn: async (): Promise<AchievementVaultData> => {
      const [
        enrollments,
        courseIssuanceMap,
        issuanceRows,
        certificateCodeMap,
        progressSnapshot,
      ] = await Promise.all([
        getMyEnrollments(userId),
        fetchCourseIssuanceMapForUser(userId),
        fetchMyCredentialIssuances(userId),
        getMyCertificateCodes(userId).catch(() => new Map<string, string>()),
        getLearnerCourseProgressSnapshot(userId),
      ]);

      // Progress-only courses cover learners created before enrollment rows were
      // introduced. The dashboard remains read-only; sync creates the missing
      // enrollment only when the learner explicitly requests certificate repair.
      const courseIds = Array.from(
        new Set([
          ...enrollments.map((item) => item.course_id),
          ...progressSnapshot.courseIds,
        ]),
      );
      const [courseMap, courseCredentialTemplateMap] = await Promise.all([
        getCoursesByIds(courseIds),
        invokeListActiveCourseCredentialTemplates(courseIds),
      ]);

      const certificates = buildCourseCertificates(
        enrollments,
        courseMap,
        input.labels,
        courseIssuanceMap,
        holderOcid,
        holderName,
        courseCredentialTemplateMap,
        certificateCodeMap,
      );
      const enrollmentByCourse = new Map(
        enrollments.map((item) => [item.course_id, item] as const),
      );
      const certificateSyncCandidates = courseIds.flatMap(
        (courseId): CertificateSyncCandidate[] => {
          if (enrollmentByCourse.get(courseId)?.certificate_issued_at) return [];
          const course = courseMap.get(courseId);
          if (!courseHasCertificate(course)) return [];
          const lessons = progressSnapshot.lessonsByCourse.get(courseId) ?? [];
          const progress = progressSnapshot.progressByCourse.get(courseId) ?? [];
          if (lessons.length === 0 || computeProgressPercent(lessons, progress) < 100) {
            return [];
          }
          return [
            {
              courseId,
              courseTitle: course?.title || input.labels.fallbackCourseName,
            },
          ];
        },
      );

      const courseIdsWithCredentialIssuance = new Set(
        issuanceRows
          .map((row) => row.course_id)
          .filter((courseId): courseId is string => Boolean(courseId)),
      );
      const badges = [
        ...issuanceRows.map((row) => issuanceToBadgeItem(row, holderOcid)),
        ...buildStandaloneCourseCredentialBadges(
          courseIds,
          courseMap,
          courseCredentialTemplateMap,
          courseIdsWithCredentialIssuance,
        ),
      ];

      return { certificates, badges, certificateSyncCandidates };
    },
    enabled: Boolean(input.enabled !== false && userId),
    staleTime: 60_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}
