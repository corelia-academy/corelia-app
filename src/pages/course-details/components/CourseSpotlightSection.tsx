import { useCallback, useMemo } from "react";
import { BookOpen, Rocket, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CoreliaSpotlight,
  type CoreliaSpotlightItem,
} from "@/components/spotlight/CoreliaSpotlight";
import { intlLocale } from "@/lib/intl";
import type { Contest } from "@/types/hackathons";
import type { CourseLesson } from "@/types/courses";

interface CourseSpotlightSectionProps {
  resolvedCourseId: string;
  courseTitle: string;
  hasFullCourseAccess: boolean;
  nextLesson: CourseLesson | null;
  spotlightContests: Contest[];
}

export function CourseSpotlightSection({
  resolvedCourseId,
  courseTitle,
  hasFullCourseAccess,
  nextLesson,
  spotlightContests,
}: CourseSpotlightSectionProps) {
  const { t } = useTranslation("courses");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );

  const items = useMemo<CoreliaSpotlightItem[]>(() => {
    const list: CoreliaSpotlightItem[] = [];

    if (hasFullCourseAccess) {
      list.push({
        id: `learn-${resolvedCourseId}`,
        badge: translate("detail.spotlight.myCourseBadge"),
        title: nextLesson
          ? translate("detail.spotlight.resumeTitle")
          : translate("detail.spotlight.enterSpaceTitle"),
        description: nextLesson
          ? translate("detail.spotlight.resumeDescription", { courseTitle })
          : translate("detail.spotlight.enterSpaceDescription", {
              courseTitle,
            }),
        href: nextLesson
          ? `/learn/${resolvedCourseId}/lesson/${nextLesson.id}`
          : `/learn/${resolvedCourseId}`,
        ctaLabel: nextLesson
          ? translate("detail.spotlight.continueLearning")
          : translate("detail.spotlight.enterLearningPage"),
        meta: nextLesson
          ? translate("detail.spotlight.nextLessonMeta", {
              title: nextLesson.title,
            })
          : translate("detail.spotlight.progressEverywhereMeta"),
        icon: <Rocket className="size-5 shrink-0" aria-hidden />,
        accent: "sky",
      });
    }

    const liveContest = spotlightContests[0];
    if (liveContest) {
      const registrationDeadlineText =
        liveContest.registration_deadline != null
          ? new Date(liveContest.registration_deadline).toLocaleDateString(
              intlLocale(),
            )
          : null;
      list.push({
        id: `contest-${liveContest.id}`,
        badge:
          liveContest.status === "running"
            ? translate("detail.spotlight.runningContestBadge")
            : translate("detail.spotlight.newContestBadge"),
        title: liveContest.title,
        description: liveContest.tagline,
        href: `/hackathons/${liveContest.id}`,
        ctaLabel: translate("detail.spotlight.exploreContest"),
        meta: registrationDeadlineText
          ? translate("detail.spotlight.contestDeadlineMeta", {
              date: registrationDeadlineText,
            })
          : translate("detail.spotlight.contestMetaNoDeadline"),
        icon: <Trophy className="size-5 shrink-0" aria-hidden />,
        accent: "amber",
      });
    }

    if (list.length < 2) {
      list.push({
        id: "courses-library",
        badge: translate("detail.spotlight.exploreMoreBadge"),
        title: translate("detail.spotlight.exploreMoreTitle"),
        description: translate("detail.spotlight.exploreMoreDescription"),
        href: "/courses",
        ctaLabel: translate("detail.spotlight.seeMoreCourses"),
        meta: translate("detail.spotlight.ecosystemMeta"),
        icon: <BookOpen className="size-5 shrink-0" aria-hidden />,
        accent: "sky",
      });
    }

    return list.slice(0, 2);
  }, [
    courseTitle,
    hasFullCourseAccess,
    nextLesson,
    resolvedCourseId,
    spotlightContests,
    translate,
  ]);

  return (
    <div className="mt-8">
      <CoreliaSpotlight
        eyebrow={translate("detail.courseDetail.spotlight.eyebrow")}
        title={translate("detail.courseDetail.spotlight.title")}
        description={translate("detail.courseDetail.spotlight.description")}
        items={items}
        compact
      />
    </div>
  );
}
