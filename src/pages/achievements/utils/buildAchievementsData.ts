import { getCourse } from "@/lib/courses";
import { openCampusCredentialExplorerUrl, type CourseIssuanceInfo } from "@/lib/credentialIssuances";
import { intlLocale } from "@/lib/intl";
import type { Enrollment } from "@/types/courses";

import { BADGE_PLACEHOLDER, BADGE_STYLES, CERT_PLACEHOLDER } from "../constants";
import type { BadgeItem, CertificateItem } from "../types";

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(intlLocale());
}

export function pickCertificateType(
  courseOwnerType?: string | null,
): CertificateItem["type"] {
  return courseOwnerType === "external_partner" ? "offline" : "online";
}

export function buildCredentialId(prefix: string, seed: string): string {
  return `${prefix}-${seed.slice(0, 8).toUpperCase()}`;
}

export function ocidWithEduSuffix(ocid: string | null | undefined): string | undefined {
  if (!ocid?.trim()) return undefined;
  const s = ocid.trim();
  return s.endsWith(".edu") ? s : `${s}.edu`;
}

export function buildCourseCertificates(
  enrollments: Enrollment[],
  courseMap: Map<string, Awaited<ReturnType<typeof getCourse>>>,
  labels: {
    courseCompletionTitle: string;
    fallbackCourseName: string;
    fallbackInstructorName: string;
  },
  courseIssuanceMap?: Map<string, CourseIssuanceInfo>,
  holderOcid?: string | null,
): CertificateItem[] {
  return enrollments
    .filter((item) => !!item.certificate_issued_at)
    .map((item) => {
      const course = courseMap.get(item.course_id);
      const issuance = courseIssuanceMap?.get(item.course_id);
      const ocClaimStatus = issuance
        ? issuance.status === "minted"
          ? "claimed"
          : issuance.status === "failed"
            ? "failed"
            : "pending"
        : "unclaimed";
      const ocCredentialId = issuance?.oc_credential_id ?? null;
      const ocCredentialUrl = ocCredentialId
        ? openCampusCredentialExplorerUrl(ocCredentialId) ?? undefined
        : undefined;
      return {
        id: `course-cert-${item.id}`,
        courseId: item.course_id,
        title: labels.courseCompletionTitle,
        course: course?.title || labels.fallbackCourseName,
        issuedAt: formatDate(item.certificate_issued_at),
        instructor: course?.instructor_name || labels.fallbackInstructorName,
        type: pickCertificateType(course?.owner_type),
        credentialId: ocCredentialId ?? buildCredentialId("COURSE", item.id),
        imageUrl: course?.certificate_template_url || CERT_PLACEHOLDER,
        ocClaimStatus,
        ocCredentialId,
        ocCredentialUrl,
        ocHolderOcId: ocClaimStatus === "claimed" ? ocidWithEduSuffix(holderOcid) : undefined,
      } satisfies CertificateItem;
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function buildMilestoneBadges(
  enrollments: Enrollment[],
  labels: {
    milestones: {
      courseFirst: { title: string; description: string };
      courseThree: { title: string; description: string };
      firstCertificate: { title: string; description: string };
      threeCertificates: { title: string; description: string };
    };
  },
): BadgeItem[] {
  const enrolledCourses = enrollments.length;
  const courseCertificates = enrollments.filter(
    (item) => !!item.certificate_issued_at,
  ).length;
  const milestones = [
    {
      id: "milestone-course-first",
      title: labels.milestones.courseFirst.title,
      description: labels.milestones.courseFirst.description,
      thresholdMet: enrolledCourses >= 1,
      earnedAt: enrollments[0]?.enrolled_at ?? null,
      style: BADGE_STYLES[0],
      category: "milestone" as const,
    },
    {
      id: "milestone-course-three",
      title: labels.milestones.courseThree.title,
      description: labels.milestones.courseThree.description,
      thresholdMet: enrolledCourses >= 3,
      earnedAt: null,
      style: BADGE_STYLES[1],
      category: "learning" as const,
    },
    {
      id: "milestone-course-first-cert",
      title: labels.milestones.firstCertificate.title,
      description: labels.milestones.firstCertificate.description,
      thresholdMet: courseCertificates >= 1,
      earnedAt:
        enrollments.find((item) => item.certificate_issued_at)
          ?.certificate_issued_at ?? null,
      style: BADGE_STYLES[2],
      category: "milestone" as const,
    },
    {
      id: "milestone-course-three-certs",
      title: labels.milestones.threeCertificates.title,
      description: labels.milestones.threeCertificates.description,
      thresholdMet: courseCertificates >= 3,
      earnedAt: null,
      style: BADGE_STYLES[3],
      category: "learning" as const,
    },
  ];

  return milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    icon: milestone.style.icon,
    imageUrl: BADGE_PLACEHOLDER,
    color: milestone.style.color,
    bgColor: milestone.style.bgColor,
    borderColor: milestone.style.borderColor,
    earnedAt: milestone.thresholdMet ? formatDate(milestone.earnedAt) : null,
    locked: !milestone.thresholdMet,
    category: milestone.category,
    ocClaimStatus: "unclaimed",
  }));
}
