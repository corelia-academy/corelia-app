import type { SupabaseClient } from "./lib/supabase.ts";
import type { MessageComplexity } from "./types.ts";
import type {
  BackendContextType,
  LearningMemoryDelta,
  LearningProfileMemoryRow,
} from "./behaviorTypes.ts";

type KnowledgeChunkRow = {
  topic: string;
  subtopic: string | null;
  content: string;
  content_category: string;
  track: string | null;
};

type LessonContextData = {
  lessonTopic?: string | null;
  lessonTitle?: string;
  courseTitle?: string;
};

type CareerContextData = {
  trackInterest?: string | null;
  trackTitles?: string[];
};

type CourseDiscoveryContextData = {
  trackInterest?: string | null;
  goal?: string | null;
  recentCourseTitles?: string[];
};

type ActivityContextData = {
  trackInterest?: string | null;
  hackathonTitles?: string[];
  projectTitles?: string[];
};

export async function getLearningMemory(
  db: SupabaseClient,
  userId: string,
): Promise<LearningProfileMemoryRow | null> {
  const { data, error } = await db
    .from("user_learning_profile")
    .select("weak_topics,strong_topics,learning_style,ai_summary,total_questions")
    .eq("user_id", userId)
    .maybeSingle<LearningProfileMemoryRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function uniqueTopics(input: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      input
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 1)),
    ),
  ).slice(0, 8);
}

function inferLearningStyle(message: string): string | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("step by step") ||
    normalized.includes("từng bước") ||
    normalized.includes("chi tiết")
  ) return "step_by_step";
  if (
    normalized.includes("ví dụ") ||
    normalized.includes("example") ||
    normalized.includes("project") ||
    normalized.includes("thực hành")
  ) return "hands_on";
  if (
    normalized.includes("tóm tắt") ||
    normalized.includes("ngắn gọn") ||
    normalized.includes("summarize") ||
    normalized.includes("concise")
  ) return "concise";
  if (
    normalized.includes("tại sao") ||
    normalized.includes("why") ||
    normalized.includes("giải thích") ||
    normalized.includes("concept")
  ) return "conceptual";
  return null;
}

function extractPrimaryTopic(
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
  knowledgeChunks: KnowledgeChunkRow[],
): string | null {
  if (contextType === "lesson") {
    const lesson = contextData as Partial<LessonContextData>;
    return lesson.lessonTopic?.trim() || lesson.lessonTitle?.trim() || lesson.courseTitle?.trim() || null;
  }
  if (contextType === "career") {
    const career = contextData as Partial<CareerContextData>;
    return career.trackInterest?.trim() || career.trackTitles?.[0]?.trim() || null;
  }
  if (contextType === "course_discovery") {
    const discovery = contextData as Partial<CourseDiscoveryContextData>;
    return discovery.trackInterest?.trim() || discovery.goal?.trim() || discovery.recentCourseTitles?.[0]?.trim() || null;
  }
  if (contextType === "activity") {
    const activity = contextData as Partial<ActivityContextData>;
    return activity.trackInterest?.trim() || activity.hackathonTitles?.[0]?.trim() || activity.projectTitles?.[0]?.trim() || null;
  }
  return knowledgeChunks[0]?.subtopic?.trim() || knowledgeChunks[0]?.topic?.trim() || null;
}

export async function updateLearningMemory(
  db: SupabaseClient,
  args: {
    userId: string;
    contextType: BackendContextType;
    lessonId: string | null;
    sessionId: string | null;
    message: string;
    assistantText: string;
    contextData: Record<string, unknown>;
    knowledgeChunks: KnowledgeChunkRow[];
    complexity: MessageComplexity;
  },
): Promise<LearningMemoryDelta> {
  const topic = extractPrimaryTopic(args.contextType, args.contextData, args.knowledgeChunks);
  const normalized = args.message.toLowerCase();
  const weakSignal =
    normalized.includes("không hiểu") ||
    normalized.includes("chưa hiểu") ||
    normalized.includes("confused") ||
    normalized.includes("struggle") ||
    normalized.includes("khó") ||
    normalized.includes("stuck");
  const strongSignal =
    !weakSignal &&
    (args.complexity === "complex" ||
      normalized.includes("so sánh") ||
      normalized.includes("compare") ||
      normalized.includes("design") ||
      normalized.includes("debug") ||
      normalized.includes("ứng dụng"));
  const style = inferLearningStyle(args.message);
  const assistantPreview = args.assistantText.trim().replace(/\s+/g, " ").slice(0, 120);
  const summary = topic
    ? `Recent focus: ${topic}. Last question complexity: ${args.complexity}. Last guidance: ${assistantPreview}`
    : `Recent question complexity: ${args.complexity}. Last guidance: ${assistantPreview}`;

  if (topic) {
    const observation = weakSignal
      ? `Learner showed friction around ${topic}.`
      : strongSignal
        ? `Learner engaged with ${topic} at a deeper level.`
        : `Learner asked for support around ${topic}.`;
    const insight = style
      ? `Preferred response style in this turn looked ${style}.`
      : "No strong response-style signal detected in this turn.";
    const { error: observationError } = await db.from("learning_observations").insert({
      user_id: args.userId,
      lesson_id: args.lessonId,
      session_id: args.sessionId,
      topic,
      observation,
      insight,
    });
    if (observationError) throw new Error(observationError.message);
  }

  const existing = await getLearningMemory(db, args.userId);
  const prevWeakTopics = Array.isArray(existing?.weak_topics) ? existing.weak_topics : [];
  const prevStrongTopics = Array.isArray(existing?.strong_topics) ? existing.strong_topics : [];
  const nextWeakTopics = weakSignal
    ? uniqueTopics([...(existing?.weak_topics ?? []), topic])
    : uniqueTopics(existing?.weak_topics ?? []);
  const nextStrongTopics = strongSignal
    ? uniqueTopics([...(existing?.strong_topics ?? []), topic])
    : uniqueTopics(existing?.strong_topics ?? []);
  const nextTotalQuestions = Number(existing?.total_questions ?? 0) + 1;

  const payload = {
    user_id: args.userId,
    weak_topics: nextWeakTopics,
    strong_topics: nextStrongTopics,
    learning_style: style ?? existing?.learning_style ?? null,
    ai_summary: summary.slice(0, 280),
    total_questions: nextTotalQuestions,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await db
    .from("user_learning_profile")
    .upsert(payload, { onConflict: "user_id" });
  if (profileError) throw new Error(profileError.message);

  return {
    newWeakTopic:
      topic && weakSignal && !prevWeakTopics.includes(topic) ? topic : null,
    newStrongTopic:
      topic && strongSignal && !prevStrongTopics.includes(topic) ? topic : null,
    learningStyle: style ?? existing?.learning_style ?? null,
    summary: summary.slice(0, 280),
    totalQuestions: nextTotalQuestions,
  };
}
