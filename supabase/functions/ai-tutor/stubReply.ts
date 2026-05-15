import {
  isProjectsActivitySurface,
  isSearchDiscoverySurface,
} from "./surfaceHints.ts";
import type { QuotaResult } from "./types.ts";
import type {
  ActivityContextData,
  BackendContextType,
  CareerContextData,
  CourseDiscoveryContextData,
  LessonContextData,
} from "./behaviorTypes.ts";

type ProfileRow = {
  full_name: string | null;
  user_goal: string | null;
};

type KnowledgeChunkRow = {
  topic: string;
  subtopic: string | null;
  content: string;
  content_category: string;
  track: string | null;
};

type ProfileReviewContextData = {
  enrolledCoursesCount?: number;
  completedCoursesCount?: number;
  credentialCount?: number;
  aiQuestionCount?: number;
  publicProjectCount?: number;
};

export function buildStubReply(args: {
  profile: ProfileRow | null;
  message: string;
  contextType: BackendContextType;
  contextData: Record<string, unknown>;
  quota: QuotaResult;
  knowledgeChunks: KnowledgeChunkRow[];
}): string {
  const name = args.profile?.full_name?.trim() || "bạn";
  const goal = args.profile?.user_goal?.trim();
  const knowledgeHighlights = args.knowledgeChunks
    .slice(0, 2)
    .map((chunk) => {
      const title = chunk.subtopic?.trim() || chunk.topic.trim() || "Nguồn tham chiếu";
      const snippet = chunk.content.trim().replace(/\s+/g, " ").slice(0, 180);
      return `- ${title}: ${snippet}${chunk.content.trim().length > 180 ? "..." : ""}`;
    });
  const knowledgeSection = knowledgeHighlights.length > 0
    ? `Mình cũng đang bám vào một vài knowledge chunks liên quan:\n${knowledgeHighlights.join("\n")}`
    : null;

  if (args.contextType === "dashboard") {
    const activeCourses = Array.isArray(args.contextData.activeCourses)
      ? (args.contextData.activeCourses as { title: string; completedLessons: number }[])
      : [];
    const lead = activeCourses[0];
    const summary = lead
      ? `Bạn đang học nổi bật ở ${lead.title} với ${lead.completedLessons} bài đã hoàn thành.`
      : "Mình chưa thấy khóa học đang học nổi bật nào trong dashboard của bạn.";
    return [
      `Chào ${name}, mình đã nhận câu hỏi: "${args.message}".`,
      summary,
      goal
        ? `Mục tiêu hiện tại mình đang bám theo là: ${goal}.`
        : "Bạn chưa đặt mục tiêu học tập rõ trong hồ sơ, nên mình sẽ ưu tiên gợi ý theo tiến độ gần nhất.",
      knowledgeSection,
      args.quota.throttled
        ? "Trong khung hỏi gần đây bạn đã chạm ngưỡng nhịp hỏi mềm, nên mình sẽ giữ câu trả lời ngắn và tập trung."
        : "Bước tiếp theo hợp lý là chốt 1 mục tiêu học cho tuần này rồi ưu tiên đúng 1 khóa đang dang dở.",
    ].filter(Boolean).join("\n\n");
  }

  if (args.contextType === "lesson") {
    const lesson = args.contextData as Partial<LessonContextData> & {
      completedLessons?: number;
      totalLessons?: number;
      progressPercent?: number;
      lessonDescription?: string | null;
    };
    const progressLine =
      typeof lesson.completedLessons === "number" && typeof lesson.totalLessons === "number"
        ? `Bạn đã hoàn thành ${lesson.completedLessons}/${lesson.totalLessons} bài, tương đương khoảng ${lesson.progressPercent ?? 0}% của khoá.`
        : "Mình đang đọc progress hiện tại của bạn trong khoá học này.";
    const lessonDescription =
      typeof lesson.lessonDescription === "string" && lesson.lessonDescription.trim()
        ? `Ngữ cảnh bài học hiện tại: ${lesson.lessonDescription.trim().slice(0, 240)}`
        : "Bài học hiện tại chưa có mô tả dài, nên mình sẽ bám vào tên bài và tiến độ để hỗ trợ.";
    return [
      `Mình đang hỗ trợ bạn ngay trong bài "${lesson.lessonTitle ?? "Bài học hiện tại"}" của khoá "${lesson.courseTitle ?? "khoá học này"}".`,
      progressLine,
      lessonDescription,
      knowledgeSection,
      `Câu hỏi bạn vừa gửi là: "${args.message}". Ở lát cắt hiện tại, mình sẽ ưu tiên giải thích sát bài học và gợi ý bước luyện tập tiếp theo thay vì trả lời quá rộng.`,
    ].filter(Boolean).join("\n\n");
  }

  if (args.contextType === "course_discovery") {
    const context = args.contextData as Partial<CourseDiscoveryContextData> & {
      trackInterest?: string | null;
      recentCourseTitles?: string[];
    };
    const isSearchSurface = isSearchDiscoverySurface(args.contextData);
    const trackInterest = typeof context.trackInterest === "string" ? context.trackInterest : null;
    const recent = Array.isArray(context.recentCourseTitles) ? context.recentCourseTitles.slice(0, 3) : [];
    return [
      isSearchSurface
        ? `Mình đã nhận yêu cầu tìm kiếm nội dung phù hợp cho ${name}.`
        : `Mình đã nhận yêu cầu tìm hướng học phù hợp cho ${name}.`,
      trackInterest
        ? `Hiện mình đang ưu tiên theo track bạn quan tâm: ${trackInterest}.`
        : "Bạn chưa chốt track cụ thể, nên mình sẽ giữ lời khuyên theo hướng khám phá an toàn.",
      recent.length > 0
        ? isSearchSurface
          ? `Một vài course phù hợp để đối chiếu nhanh với lượt search này là: ${recent.join(", ")}.`
          : `Trong catalog gần nhất mình đang nhìn thấy các course như: ${recent.join(", ")}.`
        : isSearchSurface
          ? "Mình chưa thấy course nổi bật nào để đối chiếu với truy vấn hiện tại."
          : "Catalog course sẽ được mình dùng rõ hơn khi nối thêm RAG ở bước sau.",
      knowledgeSection,
      isSearchSurface
        ? `Câu hỏi bạn vừa gửi là: "${args.message}". Với lát cắt hiện tại, mình sẽ ưu tiên giúp bạn thu hẹp truy vấn và đối chiếu nhanh các lựa chọn phù hợp.`
        : `Câu hỏi bạn vừa gửi là: "${args.message}". Với lát cắt hiện tại, mình sẽ ưu tiên dùng catalog và learning signals để gợi ý hướng học cụ thể hơn.`,
    ].filter(Boolean).join("\n\n");
  }

  if (args.contextType === "career") {
    const context = args.contextData as Partial<CareerContextData> & {
      trackTitles?: string[];
      trackInterest?: string | null;
    };
    const tracks = Array.isArray(context.trackTitles) ? context.trackTitles.slice(0, 4) : [];
    return [
      `Mình đang hỗ trợ ${name} ở ngữ cảnh định hướng nghề nghiệp.`,
      context.trackInterest
        ? `Track bạn đang quan tâm là: ${context.trackInterest}.`
        : "Bạn vẫn đang ở giai đoạn khám phá track phù hợp.",
      tracks.length > 0
        ? `Các track hiện mình đang thấy trên platform gồm: ${tracks.join(", ")}.`
        : "Mình chưa đọc được danh sách track ở thời điểm này.",
      knowledgeSection,
      `Câu hỏi bạn vừa gửi là: "${args.message}". Với lát cắt hiện tại, mình sẽ ưu tiên giúp bạn chọn hướng đi và thứ tự học hợp lý hơn.`,
    ].filter(Boolean).join("\n\n");
  }

  if (args.contextType === "activity") {
    const context = args.contextData as Partial<ActivityContextData> & {
      hackathonTitles?: string[];
      projectTitles?: string[];
    };
    const isProjectsSurface = isProjectsActivitySurface(args.contextData);
    const hackathons = Array.isArray(context.hackathonTitles) ? context.hackathonTitles.slice(0, 3) : [];
    const projects = Array.isArray(context.projectTitles) ? context.projectTitles.slice(0, 3) : [];
    return [
      isProjectsSurface
        ? `Mình đang hỗ trợ ${name} ở ngữ cảnh project và đầu ra thực hành.`
        : `Mình đang hỗ trợ ${name} ở ngữ cảnh hoạt động thực chiến.`,
      hackathons.length > 0
        ? `Một vài hackathon gần đây là: ${hackathons.join(", ")}.`
        : "Mình chưa kéo được danh sách hackathon gần đây.",
      projects.length > 0
        ? `Một vài project public đang nổi bật là: ${projects.join(", ")}.`
        : "Mình chưa kéo được danh sách project public gần đây.",
      knowledgeSection,
      `Câu hỏi bạn vừa gửi là: "${args.message}". Trong lát cắt này, mình sẽ ưu tiên ghép hoạt động phù hợp với giai đoạn học hiện tại của bạn.`,
    ].filter(Boolean).join("\n\n");
  }

  if (args.contextType === "profile_review") {
    const context = args.contextData as Partial<ProfileReviewContextData>;
    return [
      `Mình đang đọc hồ sơ học tập hiện tại của ${name}.`,
      `Bạn đang có khoảng ${context.enrolledCoursesCount ?? 0} khoá đã ghi danh, ${context.completedCoursesCount ?? 0} khoá hoàn thành, ${context.credentialCount ?? 0} credential, và ${context.publicProjectCount ?? 0} project public.`,
      `Bạn đã hỏi Cora khoảng ${context.aiQuestionCount ?? 0} câu cho đến lúc này.`,
      knowledgeSection,
      `Câu hỏi bạn vừa gửi là: "${args.message}". Trong lát cắt này, mình sẽ ưu tiên giải thích khoảng trống hồ sơ và bước tiếp theo để profile mạnh hơn.`,
    ].filter(Boolean).join("\n\n");
  }

  return [
    `Mình đã nhận câu hỏi của ${name}: "${args.message}".`,
    "Phiên bản hiện tại của Cora đã lưu session, đọc context theo trang, và có thể kéo knowledge chunks liên quan khi chúng có sẵn.",
    knowledgeSection,
    "Nếu bạn muốn câu trả lời sâu hơn, bước tiếp theo tốt nhất là seed thêm knowledge và bật provider thật.",
  ].filter(Boolean).join("\n\n");
}
