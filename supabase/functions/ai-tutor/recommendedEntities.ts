import {
  isProjectsActivitySurface,
  isSearchDiscoverySurface,
} from "./surfaceHints.ts";
import type {
  ActivityContextData,
  BackendContextType,
  CareerContextData,
  CourseDiscoveryContextData,
  DashboardContextData,
  GlobalContextData,
  LearningProfileMemoryRow,
  LessonContextData,
  ProfileReviewContextData,
  RecommendedEntity,
} from "./behaviorTypes.ts";

function scoreTextMatch(haystack: string, terms: string[]): number {
  const normalized = haystack.toLowerCase();
  return terms.reduce((score, term) => {
    const needle = term.trim().toLowerCase();
    if (!needle) return score;
    if (!normalized.includes(needle)) return score;
    if (normalized.startsWith(needle)) return score + 4;
    return score + 2;
  }, 0);
}

function formatCompactDate(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(time));
}

export function buildRecommendedEntities(args: {
  language: "vi" | "en";
  contextType: BackendContextType;
  contextData: Record<string, unknown>;
  learningMemory: LearningProfileMemoryRow | null;
}): RecommendedEntity[] {
  const { language, contextType, contextData, learningMemory } = args;
  const weakTopic = learningMemory?.weak_topics?.[0]?.trim() || "";
  const strongTopic = learningMemory?.strong_topics?.[0]?.trim() || "";
  const trackInterest = typeof contextData.trackInterest === "string" ? contextData.trackInterest.trim() : "";
  const goal = typeof contextData.goal === "string" ? contextData.goal.trim() : "";
  const currentLevel = typeof contextData.currentLevel === "string" ? contextData.currentLevel.trim() : "";
  const categoryInterests = Array.isArray(contextData.categoryInterests)
    ? contextData.categoryInterests.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const isSearchSurface = contextType === "course_discovery" && isSearchDiscoverySurface(contextData);
  const isProjectsSurface = contextType === "activity" && isProjectsActivitySurface(contextData);
  const rankingTerms = [weakTopic, strongTopic, trackInterest, goal, currentLevel, ...categoryInterests].filter(Boolean);
  const items: RecommendedEntity[] = [];
  const push = (vi: RecommendedEntity, en: RecommendedEntity) => {
    items.push(language === "vi" ? vi : en);
  };

  if (contextType === "lesson") {
    const lesson = contextData as Partial<LessonContextData>;
    const target = lesson.courseSlug || lesson.courseId;
    if (target && lesson.courseTitle) {
      push(
        {
          kind: "course",
          title: lesson.courseTitle,
          to: `/courses/${encodeURIComponent(target)}`,
          reason: weakTopic
            ? `Quay lại khóa học để bám tiếp phần ${weakTopic}.`
            : "Mở lại khóa học để xem bối cảnh và các bài liên quan.",
          subtitle: lesson.lessonTitle ? `Bài hiện tại: ${lesson.lessonTitle}` : null,
          badge: "Course",
        },
        {
          kind: "course",
          title: lesson.courseTitle,
          to: `/courses/${encodeURIComponent(target)}`,
          reason: weakTopic
            ? `Reopen the course and keep working on ${weakTopic}.`
            : "Open the course again to review the wider context and related lessons.",
          subtitle: lesson.lessonTitle ? `Current lesson: ${lesson.lessonTitle}` : null,
          badge: "Course",
        },
      );
    }
  }

  if (contextType === "dashboard") {
    const dashboard = contextData as Partial<DashboardContextData>;
    const candidates: Array<{ score: number; entity: RecommendedEntity }> = [];
    const recentCourses = [...(dashboard.recentCourses ?? [])]
      .sort((a, b) => {
        const aScore =
          scoreTextMatch(
            `${a.title} ${a.shortDescription ?? ""} ${a.category ?? ""} ${a.level ?? ""}`,
            rankingTerms,
          ) + (a.level && currentLevel && a.level.toLowerCase() === currentLevel.toLowerCase() ? 2 : 0);
        const bScore =
          scoreTextMatch(
            `${b.title} ${b.shortDescription ?? ""} ${b.category ?? ""} ${b.level ?? ""}`,
            rankingTerms,
          ) + (b.level && currentLevel && b.level.toLowerCase() === currentLevel.toLowerCase() ? 2 : 0);
        return bScore - aScore;
      })
      .slice(0, 1);
    for (const course of recentCourses) {
      if (!course?.title || (!course.slug && !course.id)) continue;
      candidates.push({
        score:
          scoreTextMatch(
            `${course.title} ${course.shortDescription ?? ""} ${course.category ?? ""} ${course.level ?? ""}`,
            rankingTerms,
          ) + 2,
        entity: language === "vi"
          ? {
              kind: "course",
              title: course.title,
              to: `/courses/${encodeURIComponent(course.slug || course.id)}`,
              reason: weakTopic
                ? `Khóa học nên mở tiếp nếu bạn muốn cải thiện ${weakTopic}.`
                : "Một khóa học phù hợp để nối tiếp tiến độ hiện tại trên dashboard.",
              subtitle: course.shortDescription || course.category,
              badge: ["Course", course.level].filter(Boolean).join(" • "),
            }
          : {
              kind: "course",
              title: course.title,
              to: `/courses/${encodeURIComponent(course.slug || course.id)}`,
              reason: weakTopic
                ? `A course worth opening next if you want to improve ${weakTopic}.`
                : "A fitting course to continue from your current dashboard momentum.",
              subtitle: course.shortDescription || course.category,
              badge: ["Course", course.level].filter(Boolean).join(" • "),
            },
      });
    }

    const featuredTrack = [...(dashboard.featuredTracks ?? [])]
      .sort((a, b) => {
        const aHrefReady = a.ownerScope === "corelia" || Boolean(a.instructorHandle);
        const bHrefReady = b.ownerScope === "corelia" || Boolean(b.instructorHandle);
        const aScore = scoreTextMatch(`${a.title} ${a.description ?? ""}`, rankingTerms) + (aHrefReady ? 3 : 0);
        const bScore = scoreTextMatch(`${b.title} ${b.description ?? ""}`, rankingTerms) + (bHrefReady ? 3 : 0);
        return bScore - aScore;
      })[0];
    if (featuredTrack?.slug && featuredTrack.title) {
      const to =
        featuredTrack.ownerScope === "corelia"
          ? `/career/corelia/${encodeURIComponent(featuredTrack.slug)}`
          : featuredTrack.instructorHandle
            ? `/career/${encodeURIComponent(featuredTrack.instructorHandle)}/${encodeURIComponent(featuredTrack.slug)}`
            : "/career";
      const badge =
        featuredTrack.ownerScope === "instructor" && featuredTrack.instructorHandle
          ? `Career • @${featuredTrack.instructorHandle}`
          : "Career";
      candidates.push({
        score: scoreTextMatch(`${featuredTrack.title} ${featuredTrack.description ?? ""}`, rankingTerms) + 1,
        entity: language === "vi"
          ? {
              kind: "career",
              title: featuredTrack.title,
              to,
              reason: trackInterest
                ? `Một track đáng xem nếu bạn đang nghiêng về ${trackInterest}.`
                : "Một lộ trình nghề nghiệp hợp lý để mở rộng hướng đi tiếp theo.",
              subtitle: featuredTrack.description,
              badge,
            }
          : {
              kind: "career",
              title: featuredTrack.title,
              to,
              reason: trackInterest
                ? `A track worth exploring if you are leaning toward ${trackInterest}.`
                : "A sensible career path to expand your next direction.",
              subtitle: featuredTrack.description,
              badge,
            },
      });
    }

    const featuredHackathon = [...(dashboard.featuredHackathons ?? [])]
      .sort((a, b) => {
        const deadlineScore = (value: string | null) => {
          if (!value) return 0;
          const time = Date.parse(value);
          if (Number.isNaN(time)) return 0;
          const days = Math.round((time - Date.now()) / 86_400_000);
          if (days < 0) return 0;
          if (days <= 7) return 4;
          if (days <= 21) return 3;
          if (days <= 45) return 2;
          return 1;
        };
        const statusScore = (status: string | null) =>
          status === "running" ? 4 : status === "published" ? 3 : status === "ended" ? 1 : 0;
        const aScore =
          statusScore(a.status) +
          deadlineScore(a.registrationDeadline) +
          deadlineScore(a.submissionDeadline) +
          scoreTextMatch(`${a.title} ${a.tagline ?? ""}`, rankingTerms);
        const bScore =
          statusScore(b.status) +
          deadlineScore(b.registrationDeadline) +
          deadlineScore(b.submissionDeadline) +
          scoreTextMatch(`${b.title} ${b.tagline ?? ""}`, rankingTerms);
        return bScore - aScore;
      })[0];
    if (featuredHackathon?.slug && featuredHackathon.title) {
      const deadlineText = formatCompactDate(
        featuredHackathon.submissionDeadline || featuredHackathon.registrationDeadline,
      );
      candidates.push({
        score:
          scoreTextMatch(`${featuredHackathon.title} ${featuredHackathon.tagline ?? ""}`, rankingTerms) + 1,
        entity: language === "vi"
          ? {
              kind: "hackathon",
              title: featuredHackathon.title,
              to: `/hackathons/${encodeURIComponent(featuredHackathon.slug)}`,
              reason: strongTopic
                ? `Một hoạt động hợp để biến ${strongTopic} thành đầu ra thực tế hơn.`
                : "Một hoạt động cụ thể để cân bằng giữa học và làm.",
              subtitle: featuredHackathon.tagline,
              badge: [featuredHackathon.status || "Hackathon", deadlineText ? `Due ${deadlineText}` : null]
                .filter(Boolean)
                .join(" • "),
            }
          : {
              kind: "hackathon",
              title: featuredHackathon.title,
              to: `/hackathons/${encodeURIComponent(featuredHackathon.slug)}`,
              reason: strongTopic
                ? `A useful activity to turn ${strongTopic} into more practical output.`
                : "A concrete activity to balance learning with doing.",
              subtitle: featuredHackathon.tagline,
              badge: [featuredHackathon.status || "Hackathon", deadlineText ? `Due ${deadlineText}` : null]
                .filter(Boolean)
                .join(" • "),
            },
      });
    }

    for (const candidate of candidates.sort((a, b) => b.score - a.score).slice(0, 2)) {
      items.push(candidate.entity);
    }
  }

  if (contextType === "global") {
    const global = contextData as Partial<GlobalContextData>;
    const candidates: Array<{ score: number; entity: RecommendedEntity }> = [];

    const course = [...(global.recentCourses ?? [])]
      .sort((a, b) => {
        const aScore = scoreTextMatch(
          `${a.title} ${a.shortDescription ?? ""} ${a.category ?? ""} ${a.level ?? ""}`,
          rankingTerms,
        );
        const bScore = scoreTextMatch(
          `${b.title} ${b.shortDescription ?? ""} ${b.category ?? ""} ${b.level ?? ""}`,
          rankingTerms,
        );
        return bScore - aScore;
      })[0];
    if (course?.title && (course.slug || course.id)) {
      candidates.push({
        score: scoreTextMatch(`${course.title} ${course.shortDescription ?? ""}`, rankingTerms) + 2,
        entity: language === "vi"
          ? {
              kind: "course",
              title: course.title,
              to: `/courses/${encodeURIComponent(course.slug || course.id)}`,
              reason: weakTopic
                ? `Một course hợp lý để xử lý tốt hơn phần ${weakTopic}.`
                : "Một course phù hợp để mở tiếp từ widget Cora.",
              subtitle: course.shortDescription || course.category,
              badge: ["Course", course.level].filter(Boolean).join(" • "),
            }
          : {
              kind: "course",
              title: course.title,
              to: `/courses/${encodeURIComponent(course.slug || course.id)}`,
              reason: weakTopic
                ? `A sensible course to handle ${weakTopic} better.`
                : "A fitting course to open next from the Cora widget.",
              subtitle: course.shortDescription || course.category,
              badge: ["Course", course.level].filter(Boolean).join(" • "),
            },
      });
    }

    const track = [...(global.featuredTracks ?? [])]
      .sort((a, b) => {
        const aHrefReady = a.ownerScope === "corelia" || Boolean(a.instructorHandle);
        const bHrefReady = b.ownerScope === "corelia" || Boolean(b.instructorHandle);
        const aScore = scoreTextMatch(`${a.title} ${a.description ?? ""}`, rankingTerms) + (aHrefReady ? 3 : 0);
        const bScore = scoreTextMatch(`${b.title} ${b.description ?? ""}`, rankingTerms) + (bHrefReady ? 3 : 0);
        return bScore - aScore;
      })[0];
    if (track?.slug && track.title) {
      const to =
        track.ownerScope === "corelia"
          ? `/career/corelia/${encodeURIComponent(track.slug)}`
          : track.instructorHandle
            ? `/career/${encodeURIComponent(track.instructorHandle)}/${encodeURIComponent(track.slug)}`
            : "/career";
      candidates.push({
        score: scoreTextMatch(`${track.title} ${track.description ?? ""}`, rankingTerms) + 1,
        entity: language === "vi"
          ? {
              kind: "career",
              title: track.title,
              to,
              reason: trackInterest
                ? `Đáng xem nếu bạn đang nghiêng về ${trackInterest}.`
                : "Một hướng nghề nghiệp hợp lý để xem tiếp từ widget.",
              subtitle: track.description,
              badge:
                track.ownerScope === "instructor" && track.instructorHandle
                  ? `Career • @${track.instructorHandle}`
                  : "Career",
            }
          : {
              kind: "career",
              title: track.title,
              to,
              reason: trackInterest
                ? `Worth checking if you are leaning toward ${trackInterest}.`
                : "A sensible career direction to review from the widget.",
              subtitle: track.description,
              badge:
                track.ownerScope === "instructor" && track.instructorHandle
                  ? `Career • @${track.instructorHandle}`
                  : "Career",
            },
      });
    }

    const hackathon = [...(global.featuredHackathons ?? [])]
      .sort((a, b) => {
        const statusScore = (status: string | null) =>
          status === "running" ? 4 : status === "published" ? 3 : status === "ended" ? 1 : 0;
        const aScore = statusScore(a.status) + scoreTextMatch(`${a.title} ${a.tagline ?? ""}`, rankingTerms);
        const bScore = statusScore(b.status) + scoreTextMatch(`${b.title} ${b.tagline ?? ""}`, rankingTerms);
        return bScore - aScore;
      })[0];
    if (hackathon?.slug && hackathon.title) {
      candidates.push({
        score: scoreTextMatch(`${hackathon.title} ${hackathon.tagline ?? ""}`, rankingTerms) + 1,
        entity: language === "vi"
          ? {
              kind: "hackathon",
              title: hackathon.title,
              to: `/hackathons/${encodeURIComponent(hackathon.slug)}`,
              reason: strongTopic
                ? `Một hoạt động hợp để đem ${strongTopic} ra thực hành.`
                : "Một hoạt động cụ thể để cân bằng giữa học và làm.",
              subtitle: hackathon.tagline,
              badge: hackathon.status || "Hackathon",
            }
          : {
              kind: "hackathon",
              title: hackathon.title,
              to: `/hackathons/${encodeURIComponent(hackathon.slug)}`,
              reason: strongTopic
                ? `A useful activity to put ${strongTopic} into practice.`
                : "A concrete activity to balance learning with doing.",
              subtitle: hackathon.tagline,
              badge: hackathon.status || "Hackathon",
            },
      });
    }

    for (const candidate of candidates.sort((a, b) => b.score - a.score).slice(0, 2)) {
      items.push(candidate.entity);
    }
  }

  if (contextType === "profile_review") {
    const profileReview = contextData as Partial<ProfileReviewContextData>;
    const candidates: Array<{ score: number; entity: RecommendedEntity }> = [];

    const course = [...(profileReview.recentCourses ?? [])]
      .sort((a, b) => {
        const aScore = scoreTextMatch(
          `${a.title} ${a.shortDescription ?? ""} ${a.category ?? ""} ${a.level ?? ""}`,
          rankingTerms,
        );
        const bScore = scoreTextMatch(
          `${b.title} ${b.shortDescription ?? ""} ${b.category ?? ""} ${b.level ?? ""}`,
          rankingTerms,
        );
        return bScore - aScore;
      })[0];
    if (course?.title && (course.slug || course.id)) {
      candidates.push({
        score: scoreTextMatch(`${course.title} ${course.shortDescription ?? ""}`, rankingTerms) + 2,
        entity: language === "vi"
          ? {
              kind: "course",
              title: course.title,
              to: `/courses/${encodeURIComponent(course.slug || course.id)}`,
              reason: weakTopic
                ? `Một course phù hợp để bù đắp khoảng trống ở ${weakTopic}.`
                : "Một course hợp để làm dày thêm hồ sơ học tập của bạn.",
              subtitle: course.shortDescription || course.category,
              badge: ["Course", course.level].filter(Boolean).join(" • "),
            }
          : {
              kind: "course",
              title: course.title,
              to: `/courses/${encodeURIComponent(course.slug || course.id)}`,
              reason: weakTopic
                ? `A fitting course to close the gap in ${weakTopic}.`
                : "A useful course to strengthen your learning profile.",
              subtitle: course.shortDescription || course.category,
              badge: ["Course", course.level].filter(Boolean).join(" • "),
            },
      });
    }

    const track = [...(profileReview.featuredTracks ?? [])]
      .sort((a, b) => {
        const aHrefReady = a.ownerScope === "corelia" || Boolean(a.instructorHandle);
        const bHrefReady = b.ownerScope === "corelia" || Boolean(b.instructorHandle);
        const aScore = scoreTextMatch(`${a.title} ${a.description ?? ""}`, rankingTerms) + (aHrefReady ? 3 : 0);
        const bScore = scoreTextMatch(`${b.title} ${b.description ?? ""}`, rankingTerms) + (bHrefReady ? 3 : 0);
        return bScore - aScore;
      })[0];
    if (track?.slug && track.title) {
      const to =
        track.ownerScope === "corelia"
          ? `/career/corelia/${encodeURIComponent(track.slug)}`
          : track.instructorHandle
            ? `/career/${encodeURIComponent(track.instructorHandle)}/${encodeURIComponent(track.slug)}`
            : "/career";
      candidates.push({
        score: scoreTextMatch(`${track.title} ${track.description ?? ""}`, rankingTerms) + 1,
        entity: language === "vi"
          ? {
              kind: "career",
              title: track.title,
              to,
              reason: trackInterest
                ? `Đáng xem nếu bạn muốn đối chiếu hồ sơ với hướng ${trackInterest}.`
                : "Một hướng nghề phù hợp để soi xem hồ sơ còn thiếu gì.",
              subtitle: track.description,
              badge:
                track.ownerScope === "instructor" && track.instructorHandle
                  ? `Career • @${track.instructorHandle}`
                  : "Career",
            }
          : {
              kind: "career",
              title: track.title,
              to,
              reason: trackInterest
                ? `Worth reviewing if you want to compare your profile against ${trackInterest}.`
                : "A useful career direction to inspect what your profile still lacks.",
              subtitle: track.description,
              badge:
                track.ownerScope === "instructor" && track.instructorHandle
                  ? `Career • @${track.instructorHandle}`
                  : "Career",
            },
      });
    }

    const hackathon = [...(profileReview.featuredHackathons ?? [])]
      .sort((a, b) => {
        const statusScore = (status: string | null) =>
          status === "running" ? 4 : status === "published" ? 3 : status === "ended" ? 1 : 0;
        const aScore = statusScore(a.status) + scoreTextMatch(`${a.title} ${a.tagline ?? ""}`, rankingTerms);
        const bScore = statusScore(b.status) + scoreTextMatch(`${b.title} ${b.tagline ?? ""}`, rankingTerms);
        return bScore - aScore;
      })[0];
    if (hackathon?.slug && hackathon.title) {
      candidates.push({
        score: scoreTextMatch(`${hackathon.title} ${hackathon.tagline ?? ""}`, rankingTerms) + 1,
        entity: language === "vi"
          ? {
              kind: "hackathon",
              title: hackathon.title,
              to: `/hackathons/${encodeURIComponent(hackathon.slug)}`,
              reason: strongTopic
                ? `Một hoạt động hợp để biến ${strongTopic} thành thành tích rõ hơn.`
                : "Một hoạt động thực chiến để bổ sung đầu ra cho hồ sơ.",
              subtitle: hackathon.tagline,
              badge: hackathon.status || "Hackathon",
            }
          : {
              kind: "hackathon",
              title: hackathon.title,
              to: `/hackathons/${encodeURIComponent(hackathon.slug)}`,
              reason: strongTopic
                ? `A good activity to turn ${strongTopic} into a clearer achievement.`
                : "A hands-on activity to add stronger output to your profile.",
              subtitle: hackathon.tagline,
              badge: hackathon.status || "Hackathon",
            },
      });
    }

    for (const candidate of candidates.sort((a, b) => b.score - a.score).slice(0, 2)) {
      items.push(candidate.entity);
    }
  }

  if (contextType === "course_discovery") {
    const discovery = contextData as Partial<CourseDiscoveryContextData>;
    const recentCourses = [...(discovery.recentCourses ?? [])]
      .sort((a, b) => {
        const aScore =
          scoreTextMatch(
            `${a.title} ${a.shortDescription ?? ""} ${a.category ?? ""} ${a.level ?? ""}`,
            rankingTerms,
          ) + (a.level && currentLevel && a.level.toLowerCase() === currentLevel.toLowerCase() ? 2 : 0);
        const bScore =
          scoreTextMatch(
            `${b.title} ${b.shortDescription ?? ""} ${b.category ?? ""} ${b.level ?? ""}`,
            rankingTerms,
          ) + (b.level && currentLevel && b.level.toLowerCase() === currentLevel.toLowerCase() ? 2 : 0);
        return bScore - aScore;
      })
      .slice(0, 2);
    for (const recentCourse of recentCourses) {
      if (!recentCourse?.title || (!recentCourse.slug && !recentCourse.id)) continue;
      const target = recentCourse.slug || recentCourse.id;
      const badge = ["Course", recentCourse.level].filter(Boolean).join(" • ");
      push(
        {
          kind: "course",
          title: recentCourse.title,
          to: `/courses/${encodeURIComponent(target)}`,
          reason: weakTopic
            ? `Một lựa chọn hợp lý để cải thiện ${weakTopic}.`
            : goal
              ? `Phù hợp hơn với mục tiêu hiện tại: ${goal}.`
              : "Một course cụ thể để bạn mở và đánh giá ngay bây giờ.",
          subtitle: recentCourse.shortDescription || recentCourse.category,
          badge,
        },
        {
          kind: "course",
          title: recentCourse.title,
          to: `/courses/${encodeURIComponent(target)}`,
          reason: weakTopic
            ? `A sensible option to improve ${weakTopic}.`
            : goal
              ? `A better fit for your current goal: ${goal}.`
              : "A concrete course you can open and evaluate right now.",
          subtitle: recentCourse.shortDescription || recentCourse.category,
          badge,
        },
      );
    }

    if (isSearchSurface) {
      items.sort((a, b) => {
        const aScore = a.kind === "course" ? 1 : 0;
        const bScore = b.kind === "course" ? 1 : 0;
        return bScore - aScore;
      });
    }
  }

  if (contextType === "career") {
    const career = contextData as Partial<CareerContextData>;
    const tracks = [...(career.featuredTracks ?? [])]
      .sort((a, b) => {
        const aHrefReady = a.ownerScope === "corelia" || Boolean(a.instructorHandle);
        const bHrefReady = b.ownerScope === "corelia" || Boolean(b.instructorHandle);
        const aScore =
          scoreTextMatch(`${a.title} ${a.description ?? ""}`, rankingTerms) +
          (aHrefReady ? 3 : 0);
        const bScore =
          scoreTextMatch(`${b.title} ${b.description ?? ""}`, rankingTerms) +
          (bHrefReady ? 3 : 0);
        return bScore - aScore;
      })
      .slice(0, 2);
    for (const track of tracks) {
      if (!track?.slug || !track.title) continue;
      const to =
        track.ownerScope === "corelia"
          ? `/career/corelia/${encodeURIComponent(track.slug)}`
          : track.instructorHandle
            ? `/career/${encodeURIComponent(track.instructorHandle)}/${encodeURIComponent(track.slug)}`
            : "/career";
      const badge =
        track.ownerScope === "instructor" && track.instructorHandle
          ? `Career • @${track.instructorHandle}`
          : "Career";
      push(
        {
          kind: "career",
          title: track.title,
          to,
          reason: weakTopic
            ? `Một track đáng xem nếu bạn muốn xử lý tốt hơn phần ${weakTopic}.`
            : trackInterest
              ? `Đáng xem nếu bạn đang nghiêng về hướng ${trackInterest}.`
              : "Một lộ trình cụ thể để xem hướng đi học tập rõ hơn.",
          subtitle: track.description,
          badge,
        },
        {
          kind: "career",
          title: track.title,
          to,
          reason: weakTopic
            ? `A worthwhile track to inspect if you want to handle ${weakTopic} better.`
            : trackInterest
              ? `Worth checking if you are leaning toward ${trackInterest}.`
              : "A concrete path to review next for clearer direction.",
          subtitle: track.description,
          badge,
        },
      );
    }
  }

  if (contextType === "activity") {
    const activity = contextData as Partial<ActivityContextData>;
    const hackathons = [...(activity.featuredHackathons ?? [])]
      .sort((a, b) => {
        const statusScore = (status: string | null) =>
          status === "running" ? 4 : status === "published" ? 3 : status === "ended" ? 1 : 0;
        const recencyScore = (value: string | null) => {
          if (!value) return 0;
          const time = Date.parse(value);
          if (Number.isNaN(time)) return 0;
          const days = Math.round((time - Date.now()) / 86_400_000);
          if (days < 0) return 0;
          if (days <= 7) return 4;
          if (days <= 21) return 3;
          if (days <= 45) return 2;
          return 1;
        };
        const aScore =
          statusScore(a.status) +
          recencyScore(a.registrationDeadline) +
          recencyScore(a.submissionDeadline) +
          scoreTextMatch(`${a.title} ${a.tagline ?? ""}`, rankingTerms);
        const bScore =
          statusScore(b.status) +
          recencyScore(b.registrationDeadline) +
          recencyScore(b.submissionDeadline) +
          scoreTextMatch(`${b.title} ${b.tagline ?? ""}`, rankingTerms);
        return bScore - aScore;
      })
      .slice(0, 2);
    for (const hackathon of hackathons) {
      if (!hackathon?.slug || !hackathon.title) continue;
      const deadlineLabel = hackathon.submissionDeadline || hackathon.registrationDeadline;
      const deadlineText = formatCompactDate(deadlineLabel);
      const badge = [hackathon.status || "Hackathon", deadlineText ? `Due ${deadlineText}` : null]
        .filter(Boolean)
        .join(" • ");
      push(
        {
          kind: "hackathon",
          title: hackathon.title,
          to: `/hackathons/${encodeURIComponent(hackathon.slug)}`,
          reason: weakTopic
            ? `Một hoạt động có thể giúp bạn luyện thêm ${weakTopic}.`
            : strongTopic
              ? `Hợp để biến ${strongTopic} thành đầu ra thực tế hơn.`
              : "Một hackathon cụ thể để chuyển từ học sang làm.",
          subtitle: hackathon.tagline,
          badge,
        },
        {
          kind: "hackathon",
          title: hackathon.title,
          to: `/hackathons/${encodeURIComponent(hackathon.slug)}`,
          reason: weakTopic
            ? `An activity that could help you practice ${weakTopic} more.`
            : strongTopic
              ? `A good place to turn ${strongTopic} into more concrete output.`
              : "A concrete hackathon to move from learning into doing.",
          subtitle: hackathon.tagline,
          badge,
        },
      );
    }

    if (isProjectsSurface) {
      items.sort((a, b) => {
        if (a.kind === b.kind) return 0;
        if (a.kind === "hackathon") return 1;
        if (b.kind === "hackathon") return -1;
        return 0;
      });
    }
  }

  return items.slice(0, 2);
}
