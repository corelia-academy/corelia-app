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
} from "./behaviorTypes.ts";

function uniquePrompts(input: string[]): string[] {
  return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean))).slice(0, 3);
}

export function buildSuggestedPrompts(args: {
  language: "vi" | "en";
  contextType: BackendContextType;
  contextData: Record<string, unknown>;
  learningMemory: LearningProfileMemoryRow | null;
}): string[] {
  const { language, contextType, contextData, learningMemory } = args;
  const weakTopic = learningMemory?.weak_topics?.[0]?.trim() || "";
  const strongTopic = learningMemory?.strong_topics?.[0]?.trim() || "";
  const style = learningMemory?.learning_style?.trim() || "";
  const lessonTitle =
    typeof contextData.lessonTitle === "string" ? contextData.lessonTitle.trim() : "";
  const courseTitle =
    typeof contextData.courseTitle === "string" ? contextData.courseTitle.trim() : "";
  const trackInterest =
    typeof contextData.trackInterest === "string" ? contextData.trackInterest.trim() : "";
  const goal = typeof contextData.goal === "string" ? contextData.goal.trim() : "";
  const isSearchSurface =
    contextType === "course_discovery" && isSearchDiscoverySurface(contextData);
  const isProjectsSurface =
    contextType === "activity" && isProjectsActivitySurface(contextData);

  const viPrompts: string[] = [];
  const enPrompts: string[] = [];

  if (weakTopic) {
    if (contextType === "lesson") {
      viPrompts.push(`Giải thích lại ${weakTopic} trong bài ${lessonTitle || "này"} theo cách dễ hiểu hơn.`);
      enPrompts.push(`Explain ${weakTopic} again in ${lessonTitle || "this lesson"} in a simpler way.`);
    } else if (contextType === "course_discovery") {
      viPrompts.push(
        isSearchSurface
          ? `Tìm nhanh giúp mình nội dung liên quan ${weakTopic}.`
          : `Tìm giúp mình course để cải thiện ${weakTopic}.`,
      );
      enPrompts.push(
        isSearchSurface
          ? `Help me quickly search for material related to ${weakTopic}.`
          : `Help me find a course to improve ${weakTopic}.`,
      );
    } else if (contextType === "career") {
      viPrompts.push(`Nếu mình còn yếu ở ${weakTopic} thì nên đi theo track nào trước?`);
      enPrompts.push(`If I am still weak at ${weakTopic}, which track should I start with first?`);
    } else if (contextType === "activity") {
      viPrompts.push(
        isProjectsSurface
          ? `Có project nào phù hợp để luyện thêm ${weakTopic} không?`
          : `Có hoạt động nào phù hợp để luyện thêm ${weakTopic} không?`,
      );
      enPrompts.push(
        isProjectsSurface
          ? `Is there a project that would help me practice ${weakTopic} more?`
          : `Is there an activity that would help me practice ${weakTopic} more?`,
      );
    } else if (contextType === "profile_review") {
      viPrompts.push(`${weakTopic} đang ảnh hưởng hồ sơ học tập của mình thế nào?`);
      enPrompts.push(`How is ${weakTopic} affecting my learning profile right now?`);
    } else {
      viPrompts.push(`Mình đang yếu ở ${weakTopic}, nên ưu tiên gì tiếp theo?`);
      enPrompts.push(`I seem weak at ${weakTopic}. What should I prioritize next?`);
    }
  }

  if (strongTopic) {
    if (contextType === "lesson") {
      viPrompts.push(`Từ ${strongTopic}, mình nên mở rộng sang phần nào tiếp theo?`);
      enPrompts.push(`From ${strongTopic}, what should I expand into next?`);
    } else if (contextType === "career") {
      viPrompts.push(`${strongTopic} có thể mở ra hướng nghề nào tiếp theo?`);
      enPrompts.push(`What career direction could ${strongTopic} open up next for me?`);
    } else if (contextType === "activity") {
      viPrompts.push(
        isProjectsSurface
          ? `Có project nào giúp mình nâng ${strongTopic} lên mức mạnh hơn không?`
          : `Có dự án hoặc hoạt động nào giúp mình nâng ${strongTopic} lên mức mạnh hơn không?`,
      );
      enPrompts.push(
        isProjectsSurface
          ? `Is there a project that would push my ${strongTopic} skills further?`
          : `Is there a project or activity that would push my ${strongTopic} skills further?`,
      );
    } else if (contextType === "profile_review") {
      viPrompts.push(`Nếu mình đang mạnh hơn ở ${strongTopic}, nên bổ sung thành tích nào tiếp theo?`);
      enPrompts.push(`If ${strongTopic} is becoming a strength, what achievement should I add next?`);
    } else {
      viPrompts.push(`Sau khi khá hơn ở ${strongTopic}, mình nên học gì nâng cao tiếp?`);
      enPrompts.push(`If I am getting stronger at ${strongTopic}, what advanced topic should I study next?`);
    }
  }

  if (!weakTopic && !strongTopic && style) {
    if (contextType === "lesson") {
      viPrompts.push(`Tiếp tục hỗ trợ mình cho bài ${lessonTitle || "này"} theo kiểu ${style}.`);
      enPrompts.push(`Keep supporting me on ${lessonTitle || "this lesson"} using a ${style} approach.`);
    } else if (contextType === "course_discovery") {
      viPrompts.push(
        isSearchSurface
          ? `Gợi ý cho mình cách tìm nhanh hơn theo kiểu ${style}.`
          : `Gợi ý course tiếp theo cho mình theo kiểu ${style}.`,
      );
      enPrompts.push(
        isSearchSurface
          ? `Suggest a faster search approach for me using a ${style} style.`
          : `Suggest the next course for me using a ${style} approach.`,
      );
    } else {
      viPrompts.push(`Gợi ý bước tiếp theo cho mình theo kiểu ${style}.`);
      enPrompts.push(`Suggest the next step for me using a ${style} approach.`);
    }
  }

  if (courseTitle && contextType === "lesson") {
    viPrompts.push(`Tóm tắt giúp mình nên học gì tiếp theo sau ${courseTitle}.`);
    enPrompts.push(`Summarize what I should study next after ${courseTitle}.`);
  }

  if (contextType === "dashboard") {
    const dashboard = contextData as Partial<DashboardContextData>;
    const hasCareer = (dashboard.featuredTracks?.length ?? 0) > 0;
    const hasActivity = (dashboard.featuredHackathons?.length ?? 0) > 0;
    const hasCourses = (dashboard.recentCourses?.length ?? 0) > 0;

    viPrompts.push("Tóm tắt nhanh tiến độ học của mình tuần này.");
    enPrompts.push("Give me a quick summary of my learning progress this week.");

    if (hasCourses && goal) {
      viPrompts.push(`Từ mục tiêu ${goal}, mình nên học gì tiếp theo ngay trên dashboard?`);
      enPrompts.push(`Given my goal of ${goal}, what should I study next from the dashboard?`);
    } else if (hasCourses) {
      viPrompts.push("Từ dashboard này, mình nên mở course nào tiếp theo?");
      enPrompts.push("From this dashboard, which course should I open next?");
    }

    if (hasCareer && trackInterest) {
      viPrompts.push(`Nếu mình đang nghiêng về ${trackInterest}, nên xem track nào trước?`);
      enPrompts.push(`If I am leaning toward ${trackInterest}, which track should I review first?`);
    } else if (hasCareer) {
      viPrompts.push("Từ tiến độ hiện tại, nên xem career track nào tiếp theo?");
      enPrompts.push("Based on my current progress, which career track should I review next?");
    }

    if (hasActivity && strongTopic) {
      viPrompts.push(`Có hackathon nào phù hợp để mình đem ${strongTopic} ra thực hành không?`);
      enPrompts.push(`Is there a hackathon where I can put ${strongTopic} into practice?`);
    } else if (hasActivity) {
      viPrompts.push("Có hoạt động nào phù hợp để mình vừa học vừa làm không?");
      enPrompts.push("Is there an activity that would help me learn and build at the same time?");
    }
  }

  if (contextType === "global") {
    const global = contextData as Partial<GlobalContextData>;
    const hasCourses = (global.recentCourses?.length ?? 0) > 0;
    const hasCareer = (global.featuredTracks?.length ?? 0) > 0;
    const hasActivity = (global.featuredHackathons?.length ?? 0) > 0;

    if (hasCourses && weakTopic) {
      viPrompts.push(`Nếu mình còn yếu ở ${weakTopic}, nên mở course nào tiếp theo?`);
      enPrompts.push(`If I am still weak at ${weakTopic}, which course should I open next?`);
    } else if (hasCourses && goal) {
      viPrompts.push(`Dựa trên mục tiêu ${goal}, mình nên học gì tiếp theo?`);
      enPrompts.push(`Based on my goal of ${goal}, what should I study next?`);
    }

    if (hasCareer && trackInterest) {
      viPrompts.push(`Nếu mình đang nghiêng về ${trackInterest}, nên xem track nào trước?`);
      enPrompts.push(`If I am leaning toward ${trackInterest}, which track should I review first?`);
    } else if (hasCareer && strongTopic) {
      viPrompts.push(`${strongTopic} có thể dẫn mình sang hướng nghề nào tiếp theo?`);
      enPrompts.push(`What career direction could ${strongTopic} lead me toward next?`);
    }

    if (hasActivity && strongTopic) {
      viPrompts.push(`Có hoạt động nào để mình đem ${strongTopic} ra thực hành không?`);
      enPrompts.push(`Is there an activity where I can put ${strongTopic} into practice?`);
    } else if (hasActivity) {
      viPrompts.push("Có hoạt động nào phù hợp để mình vừa học vừa làm không?");
      enPrompts.push("Is there an activity that would help me learn and build at the same time?");
    }
  }

  if (contextType === "profile_review") {
    const profileReview = contextData as Partial<ProfileReviewContextData>;
    const hasCourses = (profileReview.recentCourses?.length ?? 0) > 0;
    const hasCareer = (profileReview.featuredTracks?.length ?? 0) > 0;
    const hasActivity = (profileReview.featuredHackathons?.length ?? 0) > 0;

    viPrompts.push("Từ hồ sơ hiện tại, mình đang thiếu gì nhất để đi tiếp?");
    enPrompts.push("From my current profile, what am I missing most to move forward?");

    if (hasCourses && weakTopic) {
      viPrompts.push(`Từ hồ sơ này, course nào hợp để cải thiện ${weakTopic}?`);
      enPrompts.push(`From this profile, which course fits improving ${weakTopic}?`);
    } else if (hasCourses && goal) {
      viPrompts.push(`Hồ sơ hiện tại có đang bám đúng mục tiêu ${goal} không?`);
      enPrompts.push(`Is my current profile aligned with my goal of ${goal}?`);
    }

    if (hasCareer && trackInterest) {
      viPrompts.push(`Nếu nghiêng về ${trackInterest}, hồ sơ của mình còn thiếu gì?`);
      enPrompts.push(`If I lean toward ${trackInterest}, what is still missing in my profile?`);
    }

    if (hasActivity && strongTopic) {
      viPrompts.push(`Có hoạt động nào giúp mình biến ${strongTopic} thành thành tích rõ hơn không?`);
      enPrompts.push(`Is there an activity that would turn ${strongTopic} into a clearer achievement?`);
    }
  }

  if (contextType === "course_discovery") {
    if (isSearchSurface) {
      viPrompts.push("Từ nhu cầu hiện tại, mình nên search từ khóa nào trước?");
      enPrompts.push("Given what I need now, which keywords should I search first?");
    } else {
      viPrompts.push("Gợi ý cho mình một hướng học ngắn hạn trong 2 tuần tới.");
      enPrompts.push("Suggest a short two-week learning direction for me.");
    }
  }

  return language === "vi" ? uniquePrompts(viPrompts) : uniquePrompts(enPrompts);
}
