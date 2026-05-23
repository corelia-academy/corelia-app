import type {
  BackendContextType,
  KnowledgeChunkRow,
  LearningProfileMemoryRow,
} from "./behaviorTypes.ts";

type ProfilePromptRow = {
  full_name: string | null;
  user_goal: string | null;
  user_level: string | null;
  streak_days: number | null;
};

function buildLearningMemoryPromptSection(memory: LearningProfileMemoryRow | null): string {
  if (!memory) return "Learning memory: none";
  const weakTopics = Array.isArray(memory.weak_topics) ? memory.weak_topics.filter(Boolean).slice(0, 5) : [];
  const strongTopics = Array.isArray(memory.strong_topics) ? memory.strong_topics.filter(Boolean).slice(0, 5) : [];
  const learningStyle = memory.learning_style?.trim() || "unknown";
  const summary = memory.ai_summary?.trim() || "none";
  const totalQuestions = Number(memory.total_questions ?? 0);
  return [
    "Learning memory:",
    `- Weak topics: ${weakTopics.length > 0 ? weakTopics.join(", ") : "none"}`,
    `- Strong topics: ${strongTopics.length > 0 ? strongTopics.join(", ") : "none"}`,
    `- Preferred learning style: ${learningStyle}`,
    `- Running summary: ${summary}`,
    `- Total AI questions observed: ${totalQuestions}`,
  ].join("\n");
}

export function buildSourceRefs(knowledgeChunks: KnowledgeChunkRow[]) {
  return knowledgeChunks.slice(0, 3).map((chunk) => ({
    topic: chunk.topic,
    subtopic: chunk.subtopic,
    category: chunk.content_category,
    track: chunk.track,
    sourceTable: chunk.source_table,
    sourceId: chunk.source_id,
    locale: chunk.locale,
    label:
      typeof chunk.metadata?.label === "string"
        ? chunk.metadata.label
        : chunk.title,
    href:
      typeof chunk.metadata?.href === "string"
        ? chunk.metadata.href
        : null,
  }));
}

function pickString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pickStringArray(data: Record<string, unknown>, key: string, limit: number): string[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, limit);
}

function summarizeContext(contextType: BackendContextType, data: Record<string, unknown>): string {
  const lines: string[] = [];
  switch (contextType) {
    case "lesson":
    case "course": {
      const courseTitle = pickString(data, "courseTitle");
      const lessonTitle = pickString(data, "lessonTitle");
      const lessonDescription = pickString(data, "lessonDescription");
      const lessonTopic = pickString(data, "lessonTopic");
      const completed = pickNumber(data, "completedLessons");
      const total = pickNumber(data, "totalLessons");
      const progress = pickNumber(data, "progressPercent");
      if (courseTitle) lines.push(`- Course: ${courseTitle}`);
      if (lessonTitle) lines.push(`- Lesson: ${lessonTitle}`);
      if (lessonTopic) lines.push(`- Lesson topic: ${lessonTopic}`);
      if (lessonDescription) lines.push(`- Lesson description: ${lessonDescription.slice(0, 400)}`);
      if (completed !== null && total !== null) {
        lines.push(`- Progress: ${completed}/${total} lessons (${progress ?? 0}%)`);
      }
      break;
    }
    case "dashboard": {
      const active = Array.isArray(data.activeCourses) ? data.activeCourses : [];
      const titles = active
        .map((entry) => (entry && typeof entry === "object" && typeof (entry as { title?: unknown }).title === "string" ? (entry as { title: string }).title : null))
        .filter((title): title is string => Boolean(title))
        .slice(0, 3);
      if (titles.length > 0) lines.push(`- Active courses: ${titles.join(", ")}`);
      break;
    }
    case "course_discovery": {
      const trackInterest = pickString(data, "trackInterest");
      const recent = pickStringArray(data, "recentCourseTitles", 5);
      if (trackInterest) lines.push(`- Track interest: ${trackInterest}`);
      if (recent.length > 0) lines.push(`- Recent course titles: ${recent.join(", ")}`);
      break;
    }
    case "career": {
      const trackInterest = pickString(data, "trackInterest");
      const tracks = pickStringArray(data, "trackTitles", 5);
      if (trackInterest) lines.push(`- Track interest: ${trackInterest}`);
      if (tracks.length > 0) lines.push(`- Available tracks: ${tracks.join(", ")}`);
      break;
    }
    case "activity": {
      const hackathons = pickStringArray(data, "hackathonTitles", 5);
      const projects = pickStringArray(data, "projectTitles", 5);
      if (hackathons.length > 0) lines.push(`- Recent hackathons: ${hackathons.join(", ")}`);
      if (projects.length > 0) lines.push(`- Public projects: ${projects.join(", ")}`);
      break;
    }
    case "profile_review": {
      const enrolled = pickNumber(data, "enrolledCoursesCount");
      const completed = pickNumber(data, "completedCoursesCount");
      const credentials = pickNumber(data, "credentialCount");
      const projects = pickNumber(data, "publicProjectCount");
      lines.push(
        `- Profile: ${enrolled ?? 0} enrolled, ${completed ?? 0} completed, ${credentials ?? 0} credentials, ${projects ?? 0} public projects`,
      );
      break;
    }
    default:
      break;
  }
  return lines.length > 0 ? ["Context details:", ...lines].join("\n") : "Context details: none";
}

export function buildSystemPrompt(
  profile: ProfilePromptRow | null,
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
  knowledgeChunks: KnowledgeChunkRow[],
  learningMemory: LearningProfileMemoryRow | null,
  buildKnowledgePromptSection: (chunks: KnowledgeChunkRow[]) => string,
): string {
  const learnerName = profile?.full_name?.trim() || "Learner";
  const goal = profile?.user_goal?.trim() || "Not specified";
  const level = profile?.user_level?.trim() || "beginner";
  const streak = Number(profile?.streak_days ?? 0);

  return [
    "You are Cora, the AI tutor for Corelia Academy.",
    "Reply in the same language the user wrote in. Be practical, warm, and concise.",
    "",
    "Answering rules:",
    "- Answer the user's question directly. Do NOT preface with phrases like \"Mình đã nhận câu hỏi…\", \"I received your question…\", or any restatement of what they asked.",
    "- Do NOT describe your own capabilities, session state, knowledge chunks pipeline, or talk about \"the current version of Cora\". Just answer.",
    "- When knowledge chunks below are relevant, prefer them and weave in the source topic naturally (e.g. \"Theo tài liệu khóa học…\"). If no chunk is relevant, answer from general knowledge and note that briefly.",
    "- Keep replies tight: 3-6 short paragraphs or a bullet list, under ~250 words unless the user asks for more depth.",
    "- End with one concrete next step or follow-up question only when it adds value, not by default.",
    "",
    `Learner: ${learnerName} (level: ${level}, streak: ${streak} days)`,
    `Learner goal: ${goal}`,
    `Surface: ${contextType}`,
    summarizeContext(contextType, contextData),
    buildKnowledgePromptSection(knowledgeChunks),
    buildLearningMemoryPromptSection(learningMemory),
  ].join("\n");
}
