import {
  isProjectsActivitySurface,
  isSearchDiscoverySurface,
} from "./surfaceHints.ts";
import type {
  BackendContextType,
  DashboardContextData,
  GlobalContextData,
  LearningProfileMemoryRow,
  ProfileReviewContextData,
  RecommendedAction,
} from "./behaviorTypes.ts";

export function buildRecommendedActions(args: {
  language: "vi" | "en";
  contextType: BackendContextType;
  contextData: Record<string, unknown>;
  learningMemory: LearningProfileMemoryRow | null;
}): RecommendedAction[] {
  const { language, contextType, contextData, learningMemory } = args;
  const weakTopic = learningMemory?.weak_topics?.[0]?.trim() || "";
  const strongTopic = learningMemory?.strong_topics?.[0]?.trim() || "";
  const courseTitle =
    typeof contextData.courseTitle === "string" ? contextData.courseTitle.trim() : "";
  const trackInterest =
    typeof contextData.trackInterest === "string" ? contextData.trackInterest.trim() : "";
  const goal = typeof contextData.goal === "string" ? contextData.goal.trim() : "";
  const isSearchSurface =
    contextType === "course_discovery" && isSearchDiscoverySurface(contextData);
  const isProjectsSurface =
    contextType === "activity" && isProjectsActivitySurface(contextData);

  const items: RecommendedAction[] = [];
  const push = (vi: RecommendedAction, en: RecommendedAction) => {
    items.push(language === "vi" ? vi : en);
  };

  if (contextType === "dashboard") {
    const dashboard = contextData as Partial<DashboardContextData>;
    const actionCandidates: Array<{ score: number; action: RecommendedAction }> = [];

    actionCandidates.push({
      score: weakTopic ? 6 : goal ? 4 : 3,
      action:
        language === "vi"
          ? {
              label: "Khám phá khóa học",
              to: "/courses",
              reason: weakTopic
                ? `Tìm course để cải thiện ${weakTopic}.`
                : goal
                  ? `Tìm course bám sát mục tiêu hiện tại: ${goal}.`
                  : "Mở thư viện để tìm bước học tiếp theo.",
            }
          : {
              label: "Explore courses",
              to: "/courses",
              reason: weakTopic
                ? `Find a course to improve ${weakTopic}.`
                : goal
                  ? `Find a course that matches your current goal: ${goal}.`
                  : "Open the library to find the next learning step.",
            },
    });

    if ((dashboard.featuredTracks?.length ?? 0) > 0 || trackInterest) {
      actionCandidates.push({
        score: trackInterest ? 5 : 3,
        action:
          language === "vi"
            ? {
                label: "Xem career track",
                to: "/career",
                reason: trackInterest
                  ? `Rà lại lộ trình liên quan ${trackInterest}.`
                  : "Mở career track để nối việc học với định hướng dài hạn hơn.",
              }
            : {
                label: "Browse career tracks",
                to: "/career",
                reason: trackInterest
                  ? `Review paths related to ${trackInterest}.`
                  : "Open career tracks to connect learning with a longer-term direction.",
              },
      });
    }

    if ((dashboard.featuredHackathons?.length ?? 0) > 0 || strongTopic) {
      actionCandidates.push({
        score: strongTopic ? 5 : 2,
        action:
          language === "vi"
            ? {
                label: "Thử một hackathon",
                to: "/hackathons",
                reason: strongTopic
                  ? `Tìm một hoạt động để biến ${strongTopic} thành đầu ra thực tế.`
                  : "Mở hackathon để cân bằng giữa học và làm.",
              }
            : {
                label: "Try a hackathon",
                to: "/hackathons",
                reason: strongTopic
                  ? `Find an activity that turns ${strongTopic} into practical output.`
                  : "Open hackathons to balance learning with doing.",
              },
      });
    }

    for (const candidate of actionCandidates.sort((a, b) => b.score - a.score).slice(0, 2)) {
      items.push(candidate.action);
    }
  }

  if (contextType === "global") {
    const global = contextData as Partial<GlobalContextData>;
    const actionCandidates: Array<{ score: number; action: RecommendedAction }> = [];

    if ((global.recentCourses?.length ?? 0) > 0 || weakTopic || goal) {
      actionCandidates.push({
        score: weakTopic ? 6 : goal ? 4 : 3,
        action:
          language === "vi"
            ? {
                label: "Mở course phù hợp",
                to: "/courses",
                reason: weakTopic
                  ? `Tìm course để xử lý tốt hơn phần ${weakTopic}.`
                  : goal
                    ? `Tìm course phù hợp với mục tiêu hiện tại: ${goal}.`
                    : "Mở thư viện để chốt bước học tiếp theo.",
              }
            : {
                label: "Open a fitting course",
                to: "/courses",
                reason: weakTopic
                  ? `Find a course to handle ${weakTopic} better.`
                  : goal
                    ? `Find a course that fits your current goal: ${goal}.`
                    : "Open the library to choose the next learning step.",
              },
      });
    }

    if ((global.featuredTracks?.length ?? 0) > 0 || trackInterest) {
      actionCandidates.push({
        score: trackInterest ? 5 : 3,
        action:
          language === "vi"
            ? {
                label: "Xem career track",
                to: "/career",
                reason: trackInterest
                  ? `Rà lại track liên quan ${trackInterest}.`
                  : "Mở career track để nối việc học với hướng đi dài hạn.",
              }
            : {
                label: "Browse career tracks",
                to: "/career",
                reason: trackInterest
                  ? `Review tracks related to ${trackInterest}.`
                  : "Open career tracks to connect learning with a longer-term path.",
              },
      });
    }

    if ((global.featuredHackathons?.length ?? 0) > 0 || strongTopic) {
      actionCandidates.push({
        score: strongTopic ? 5 : 2,
        action:
          language === "vi"
            ? {
                label: "Xem hoạt động thực chiến",
                to: "/hackathons",
                reason: strongTopic
                  ? `Tìm hoạt động để biến ${strongTopic} thành đầu ra thực tế.`
                  : "Mở hackathon để cân bằng giữa học và làm.",
              }
            : {
                label: "See hands-on activities",
                to: "/hackathons",
                reason: strongTopic
                  ? `Find an activity to turn ${strongTopic} into practical output.`
                  : "Open hackathons to balance learning with doing.",
              },
      });
    }

    actionCandidates.push({
      score: 1,
      action:
        language === "vi"
          ? {
              label: "Mở hồ sơ học tập",
              to: "/account",
              reason: "Xem lại tiến độ, gói AI, và các tín hiệu học tập gần đây.",
            }
          : {
              label: "Open learning profile",
              to: "/account",
              reason: "Review your progress, AI plan, and recent learning signals.",
            },
    });

    for (const candidate of actionCandidates.sort((a, b) => b.score - a.score).slice(0, 2)) {
      items.push(candidate.action);
    }
  }

  if (contextType === "lesson") {
    push(
      {
        label: "Xem thêm khóa học",
        to: "/courses",
        reason: courseTitle ? `Mở rộng sau ${courseTitle}.` : "Tìm course liên quan để học sâu hơn.",
      },
      {
        label: "View more courses",
        to: "/courses",
        reason: courseTitle ? `Expand beyond ${courseTitle}.` : "Find related courses to go deeper.",
      },
    );
  }

  if (contextType === "course_discovery") {
    if (isSearchSurface) {
      push(
        {
          label: "Mở thư viện khóa học",
          to: "/courses",
          reason: weakTopic
            ? `Chuyển từ search sang library để lọc kỹ hơn cho ${weakTopic}.`
            : "Mở library để đánh giá course cụ thể thay vì chỉ xem kết quả tìm kiếm.",
        },
        {
          label: "Open course library",
          to: "/courses",
          reason: weakTopic
            ? `Move from search into the library to narrow down ${weakTopic} more carefully.`
            : "Open the library to evaluate concrete courses beyond search results.",
        },
      );
      push(
        {
          label: "Tìm lại với từ khóa khác",
          to: "/search",
          reason: weakTopic
            ? `Thử một lượt search khác xoay quanh ${weakTopic}.`
            : "Làm mới hướng tìm kiếm để mở rộng kết quả phù hợp hơn.",
        },
        {
          label: "Search again",
          to: "/search",
          reason: weakTopic
            ? `Try another search pass centered on ${weakTopic}.`
            : "Refresh the search direction to widen the set of fitting results.",
        },
      );
    } else {
      push(
        {
          label: "Mở tìm kiếm",
          to: "/search",
          reason: weakTopic
            ? `Tìm nhanh nội dung liên quan ${weakTopic}.`
            : "Tìm course, lộ trình, và hoạt động phù hợp hơn.",
        },
        {
          label: "Open search",
          to: "/search",
          reason: weakTopic
            ? `Search quickly for material related to ${weakTopic}.`
            : "Search for better-fit courses, paths, and activities.",
        },
      );
      push(
        {
          label: "Xem thư viện khóa học",
          to: "/courses",
          reason: goal
            ? `Rà lại library theo mục tiêu hiện tại: ${goal}.`
            : "Mở library để chọn course tiếp theo rõ ràng hơn.",
        },
        {
          label: "Browse course library",
          to: "/courses",
          reason: goal
            ? `Review the library against your current goal: ${goal}.`
            : "Open the library to choose the next course more clearly.",
        },
      );
    }
  }

  if (contextType === "career") {
    push(
      {
        label: "Xem lộ trình",
        to: "/career",
        reason: strongTopic
          ? `Kiểm tra hướng đi phù hợp với ${strongTopic}.`
          : "So sánh các track để chọn hướng đi hợp lý.",
      },
      {
        label: "View paths",
        to: "/career",
        reason: strongTopic
          ? `Check which path fits ${strongTopic}.`
          : "Compare tracks and choose the most sensible direction.",
      },
    );
  }

  if (contextType === "activity") {
    if (isProjectsSurface) {
      push(
        {
          label: "Xem dự án",
          to: "/projects",
          reason: strongTopic
            ? `Tìm project để đẩy mạnh ${strongTopic}.`
            : "Khám phá project để biến việc học thành đầu ra rõ hơn.",
        },
        {
          label: "View projects",
          to: "/projects",
          reason: strongTopic
            ? `Find a project to push ${strongTopic} further.`
            : "Explore projects to turn learning into clearer output.",
        },
      );
      push(
        {
          label: "Xem hackathon",
          to: "/hackathons",
          reason: weakTopic
            ? `Tìm hoạt động để luyện thêm ${weakTopic}.`
            : "Tìm hoạt động thực chiến phù hợp với giai đoạn hiện tại.",
        },
        {
          label: "View hackathons",
          to: "/hackathons",
          reason: weakTopic
            ? `Find an activity to practice ${weakTopic} more.`
            : "Look for practical activities that fit your current stage.",
        },
      );
    } else {
      push(
        {
          label: "Xem hackathon",
          to: "/hackathons",
          reason: weakTopic
            ? `Tìm hoạt động để luyện thêm ${weakTopic}.`
            : "Tìm hoạt động thực chiến phù hợp với giai đoạn hiện tại.",
        },
        {
          label: "View hackathons",
          to: "/hackathons",
          reason: weakTopic
            ? `Find an activity to practice ${weakTopic} more.`
            : "Look for practical activities that fit your current stage.",
        },
      );
      push(
        {
          label: "Xem dự án",
          to: "/projects",
          reason: strongTopic
            ? `Tìm project để đẩy mạnh ${strongTopic}.`
            : "Khám phá project để biến việc học thành đầu ra rõ hơn.",
        },
        {
          label: "View projects",
          to: "/projects",
          reason: strongTopic
            ? `Find a project to push ${strongTopic} further.`
            : "Explore projects to turn learning into clearer output.",
        },
      );
    }
  }

  if (contextType === "profile_review") {
    const profileReview = contextData as Partial<ProfileReviewContextData>;
    const actionCandidates: Array<{ score: number; action: RecommendedAction }> = [];

    actionCandidates.push({
      score: 5,
      action:
        language === "vi"
          ? {
              label: "Mở hồ sơ",
              to: "/account",
              reason: weakTopic
                ? `Xem lại hồ sơ học tập liên quan ${weakTopic}.`
                : "Kiểm tra tiến độ, thành tích, và các tín hiệu học tập của bạn.",
            }
          : {
              label: "Open profile",
              to: "/account",
              reason: weakTopic
                ? `Review the profile areas related to ${weakTopic}.`
                : "Check your progress, achievements, and learning signals.",
            },
    });

    if ((profileReview.recentCourses?.length ?? 0) > 0 || weakTopic) {
      actionCandidates.push({
        score: weakTopic ? 6 : 3,
        action:
          language === "vi"
            ? {
                label: "Bổ sung khóa học",
                to: "/courses",
                reason: weakTopic
                  ? `Tìm course để lấp khoảng trống ở ${weakTopic}.`
                  : "Mở course để tăng độ dày cho hồ sơ học tập.",
              }
            : {
                label: "Add a course",
                to: "/courses",
                reason: weakTopic
                  ? `Find a course to close the gap in ${weakTopic}.`
                  : "Open courses to strengthen your learning profile.",
              },
      });
    }

    if ((profileReview.featuredTracks?.length ?? 0) > 0 || trackInterest) {
      actionCandidates.push({
        score: trackInterest ? 5 : 2,
        action:
          language === "vi"
            ? {
                label: "Xem hướng nghề",
                to: "/career",
                reason: trackInterest
                  ? `Rà lại hướng ${trackInterest} để biết hồ sơ còn thiếu gì.`
                  : "Mở career track để đối chiếu hồ sơ với hướng đi dài hạn.",
              }
            : {
                label: "Review career path",
                to: "/career",
                reason: trackInterest
                  ? `Review the ${trackInterest} direction to see what your profile still lacks.`
                  : "Open career tracks to compare your profile with a longer-term direction.",
              },
      });
    }

    if ((profileReview.featuredHackathons?.length ?? 0) > 0 || strongTopic) {
      actionCandidates.push({
        score: strongTopic ? 4 : 1,
        action:
          language === "vi"
            ? {
                label: "Tìm hoạt động thực chiến",
                to: "/hackathons",
                reason: strongTopic
                  ? `Biến ${strongTopic} thành thành tích hoặc đầu ra cụ thể hơn.`
                  : "Mở hackathon để bổ sung trải nghiệm thực chiến cho hồ sơ.",
              }
            : {
                label: "Find hands-on activity",
                to: "/hackathons",
                reason: strongTopic
                  ? `Turn ${strongTopic} into a clearer achievement or output.`
                  : "Open hackathons to add hands-on experience to your profile.",
              },
      });
    }

    for (const candidate of actionCandidates.sort((a, b) => b.score - a.score).slice(0, 2)) {
      items.push(candidate.action);
    }
  }

  if (contextType === "global") {
    push(
      {
        label: "Mở hồ sơ",
        to: "/account",
        reason: weakTopic
          ? `Xem lại hồ sơ học tập liên quan ${weakTopic}.`
          : "Kiểm tra tiến độ, thành tích, và thông tin học tập của bạn.",
      },
      {
        label: "Open profile",
        to: "/account",
        reason: weakTopic
          ? `Review the profile areas related to ${weakTopic}.`
          : "Check your progress, achievements, and learning profile.",
      },
    );
  }

  return items.slice(0, 2);
}
