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
    "Reply in the same language as the user. Be practical, warm, and concise.",
    "Prefer actionable next steps over long theory dumps.",
    `Learner name: ${learnerName}`,
    `Learner level: ${level}`,
    `Learner goal: ${goal}`,
    `Learner streak days: ${streak}`,
    `Context type: ${contextType}`,
    `Context data: ${JSON.stringify(contextData)}`,
    buildKnowledgePromptSection(knowledgeChunks),
    buildLearningMemoryPromptSection(learningMemory),
  ].join("\n");
}
