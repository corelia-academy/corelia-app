import {
  checkQuota,
  enforceAbuseChecks,
  ensureSession,
  getProfile,
  incrementQuotaSnapshot,
  resolveEffectiveTier,
  requireLessonAccess,
} from "./accessGuards.ts";
import { corsHeadersForRequest, json, withCors } from "./lib/http.ts";
import { encodeSse, sseHeaders } from "./lib/sse.ts";
import { getLearningMemory, updateLearningMemory } from "./learningMemory.ts";
import { streamProviderText } from "./provider.ts";
import { buildSourceRefs, buildSystemPrompt } from "./promptRuntime.ts";
import { buildRecommendedActions } from "./recommendedActions.ts";
import { buildRecommendedEntities } from "./recommendedEntities.ts";
import { buildSuggestedPrompts } from "./suggestedPrompts.ts";
import { estimateTokens, upsertUsage } from "./usageAccounting.ts";
import { createServiceClient, type SupabaseClient, verifyBearerUser } from "./lib/supabase.ts";
import type {
  BackendContextType,
  KnowledgeChunkRow,
  LearningMemoryDelta,
  LearningProfileMemoryRow,
} from "./behaviorTypes.ts";
import type { MessageComplexity } from "./types.ts";

type Tier = "free" | "student" | "pro" | "bootcamp";

type TutorRequest = {
  message?: unknown;
  assistantContext?: unknown;
  sessionId?: unknown;
  lessonId?: unknown;
  courseId?: unknown;
  stream?: unknown;
  action?: unknown;
  selectedText?: unknown;
  attachments?: unknown;
};

type TutorAction = "chat" | "explain_selected_text";

export type MessageAttachment = {
  kind: "image";
  url: string;
  path?: string;
  mime?: string;
};

const MAX_ATTACHMENTS_PER_TURN = 3;

function parseAttachments(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (obj.kind !== "image") continue;
    const url = typeof obj.url === "string" ? obj.url.trim() : "";
    if (!url.startsWith("https://")) continue;
    const path = typeof obj.path === "string" ? obj.path.trim() : undefined;
    const mime = typeof obj.mime === "string" ? obj.mime.trim() : undefined;
    out.push({ kind: "image", url, path, mime });
    if (out.length >= MAX_ATTACHMENTS_PER_TURN) break;
  }
  return out;
}

type ProfileRow = {
  full_name: string | null;
  tier: Tier | null;
  user_level: string | null;
  user_goal: string | null;
  streak_days: number | null;
  track_interest: string | null;
  category_interests: string[] | null;
};

type LessonContextData = {
  courseId: string;
  courseSlug: string | null;
  courseTitle: string;
  lessonTitle: string;
  lessonTopic: string | null;
  lessonDescription: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

type DashboardContextData = {
  activeCourses: Array<{ courseId: string; title: string; completedLessons: number }>;
  totalLessons: number;
  completedLessons: number;
  recentCourses: CourseDiscoveryContextData["recentCourses"];
  featuredTracks: CareerContextData["featuredTracks"];
  featuredHackathons: ActivityContextData["featuredHackathons"];
  goal: string | null;
  trackInterest: string | null;
  currentLevel: string | null;
  categoryInterests: string[];
};

type GlobalContextData = {
  recentCourses: CourseDiscoveryContextData["recentCourses"];
  featuredTracks: CareerContextData["featuredTracks"];
  featuredHackathons: ActivityContextData["featuredHackathons"];
  goal: string | null;
  trackInterest: string | null;
  currentLevel: string | null;
  categoryInterests: string[];
  enrolledCoursesCount: number;
  completedCoursesCount: number;
};

type CourseDiscoveryContextData = {
  enrolledCount: number;
  recentCourseTitles: string[];
  recentCourses: Array<{
    id: string;
    slug: string | null;
    title: string;
    shortDescription: string | null;
    category: string | null;
    level: string | null;
  }>;
  goal: string | null;
  trackInterest: string | null;
  categoryInterests: string[];
};

type CareerContextData = {
  trackTitles: string[];
  featuredTracks: Array<{
    slug: string;
    title: string;
    description: string | null;
    ownerScope: "corelia" | "instructor" | null;
    instructorHandle: string | null;
  }>;
  currentLevel: string | null;
  trackInterest: string | null;
};

type ActivityContextData = {
  hackathonTitles: string[];
  featuredHackathons: Array<{
    slug: string;
    title: string;
    status: string | null;
    tagline: string | null;
    registrationDeadline: string | null;
    submissionDeadline: string | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
  projectTitles: string[];
  trackInterest: string | null;
  categoryInterests: string[];
};

type ProfileReviewContextData = {
  enrolledCoursesCount: number;
  completedCoursesCount: number;
  credentialCount: number;
  aiQuestionCount: number;
  publicProjectCount: number;
  recentCourses: CourseDiscoveryContextData["recentCourses"];
  featuredTracks: CareerContextData["featuredTracks"];
  featuredHackathons: ActivityContextData["featuredHackathons"];
  goal: string | null;
  trackInterest: string | null;
  currentLevel: string | null;
  categoryInterests: string[];
};

function detectPreferredLanguage(input: string): "vi" | "en" {
  return /[à-ỹđ]/i.test(input) ? "vi" : "en";
}

function readEnv(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

const FALLBACK_TIER_LIMITS: Record<
  Tier,
  { monthlyMessages: number; rolling3hSoftCap: number; haikuOnly: boolean; monthlyTokens: number; rolling3hTokens: number }
> = {
  free:     { monthlyMessages: 50,   rolling3hSoftCap: 5,   haikuOnly: true,  monthlyTokens: 100000,   rolling3hTokens: 10000  },
  student:  { monthlyMessages: 700,  rolling3hSoftCap: 70,  haikuOnly: true,  monthlyTokens: 1400000,  rolling3hTokens: 140000 },
  pro:      { monthlyMessages: 1000, rolling3hSoftCap: 100, haikuOnly: false, monthlyTokens: 2000000,  rolling3hTokens: 200000 },
  bootcamp: { monthlyMessages: 2000, rolling3hSoftCap: 200, haikuOnly: false, monthlyTokens: 4000000,  rolling3hTokens: 400000 },
};

function mapAssistantContext(assistantContext: string): BackendContextType {
  switch (assistantContext) {
    case "home":
      return "dashboard";
    case "courses":
    case "search":
      return "course_discovery";
    case "career":
      return "career";
    case "hackathons":
    case "projects":
      return "activity";
    case "achievements":
    case "profile":
    case "account":
      return "profile_review";
    case "lesson":
    case "course":
      return "lesson";
    default:
      return "global";
  }
}

function parseRequest(body: TutorRequest): {
  message: string;
  assistantContext: string;
  lessonId: string | null;
  courseId: string | null;
  sessionId: string | null;
  stream: boolean;
  action: TutorAction;
  selectedText: string | null;
  attachments: MessageAttachment[];
} {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const assistantContext =
    typeof body.assistantContext === "string" ? body.assistantContext.trim() : "default";
  const lessonId = typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
  const courseId = typeof body.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
  const stream = body.stream !== false;
  const action: TutorAction =
    body.action === "explain_selected_text" ? "explain_selected_text" : "chat";
  const selectedText =
    typeof body.selectedText === "string" && body.selectedText.trim()
      ? body.selectedText.trim().slice(0, 2000)
      : null;
  const attachments = parseAttachments(body.attachments);
  return { message, assistantContext, lessonId, courseId, sessionId, stream, action, selectedText, attachments };
}

function classifyComplexity(
  message: string,
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
): MessageComplexity {
  const normalized = message.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const sentenceCount = normalized.split(/[.!?]/).filter((part) => part.trim().length > 0).length;

  const complexSignals = [
    "compare",
    "phân tích",
    "giải thích sâu",
    "step by step",
    "chi tiết",
    "kiến trúc",
    "trade-off",
    "lộ trình",
    "because",
    "why",
    "tại sao",
    "how does",
    "design",
    "debug",
  ];
  const mediumSignals = [
    "plan",
    "kế hoạch",
    "gợi ý",
    "recommend",
    "nên học",
    "what should",
    "tiếp theo",
    "next",
    "summarize",
    "tóm tắt",
  ];

  const hasComplexSignal = complexSignals.some((signal) => normalized.includes(signal));
  const hasMediumSignal = mediumSignals.some((signal) => normalized.includes(signal));
  const lessonHasDescription =
    (contextType === "lesson" || contextType === "course") &&
    typeof contextData.lessonDescription === "string" &&
    contextData.lessonDescription.trim().length > 120;

  if (
    hasComplexSignal ||
    wordCount >= 45 ||
    sentenceCount >= 4 ||
    ((contextType === "lesson" || contextType === "course") && wordCount >= 25 && lessonHasDescription)
  ) {
    return "complex";
  }
  if (hasMediumSignal || wordCount >= 16 || sentenceCount >= 2) {
    return "medium";
  }
  return "simple";
}

function knowledgeCategoriesForContext(
  contextType: BackendContextType,
): string[] {
  switch (contextType) {
    case "lesson":
    case "course":
      return ["lesson", "platform_guide"];
    case "course_discovery":
      return ["course_catalog", "career_track", "platform_guide"];
    case "career":
      return ["career_track", "course_catalog", "platform_guide"];
    case "activity":
      return ["activity", "platform_guide"];
    case "dashboard":
    case "global":
    case "profile_review":
      return ["course_catalog", "career_track", "activity", "credential", "platform_guide"];
    default:
      return [];
  }
}

function extractKnowledgeTerms(
  message: string,
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
): string[] {
  const baseTerms = message
    .toLowerCase()
    .split(/[^a-z0-9à-ỹ]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

  const contextTerms: string[] = [];
  if (contextType === "lesson" || contextType === "course") {
    const lessonData = contextData as Partial<LessonContextData>;
    if (typeof lessonData.lessonTopic === "string") contextTerms.push(lessonData.lessonTopic);
    if (typeof lessonData.lessonTitle === "string") contextTerms.push(lessonData.lessonTitle);
    if (typeof lessonData.courseTitle === "string") contextTerms.push(lessonData.courseTitle);
  } else if (contextType === "course_discovery") {
    const discoveryData = contextData as Partial<CourseDiscoveryContextData>;
    if (typeof discoveryData.goal === "string") contextTerms.push(discoveryData.goal);
    if (typeof discoveryData.trackInterest === "string") contextTerms.push(discoveryData.trackInterest);
    if (Array.isArray(discoveryData.categoryInterests)) {
      contextTerms.push(...discoveryData.categoryInterests);
    }
  } else if (contextType === "career") {
    const careerData = contextData as Partial<CareerContextData>;
    if (typeof careerData.trackInterest === "string") contextTerms.push(careerData.trackInterest);
    if (Array.isArray(careerData.trackTitles)) contextTerms.push(...careerData.trackTitles.slice(0, 2));
  }

  return Array.from(
    new Set(
      [...baseTerms, ...contextTerms]
        .map((part) => part.toLowerCase().trim())
        .filter((part) => part.length >= 3),
    ),
  ).slice(0, 10);
}

async function fetchUserSeenLessonIds(
  db: SupabaseClient,
  userId: string,
  courseId: string | null,
): Promise<Set<string>> {
  let query = db
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .limit(500);
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) {
    console.warn("[ai-tutor] fetchUserSeenLessonIds failed", error.message);
    return new Set();
  }
  return new Set(
    (data ?? [])
      .map((r) => (typeof r.lesson_id === "string" ? r.lesson_id : String(r.lesson_id ?? "")))
      .filter(Boolean),
  );
}

function scoreKnowledgeChunk(
  chunk: KnowledgeChunkRow,
  searchTerms: string[],
  preferredTrack: string | null,
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
  seenLessonIds: Set<string>,
): number {
  const haystack = [
    chunk.topic,
    chunk.subtopic ?? "",
    chunk.track ?? "",
    chunk.title,
    JSON.stringify(chunk.metadata ?? {}),
    chunk.content.slice(0, 500),
  ]
    .join(" ")
    .toLowerCase();

  let score = searchTerms.reduce((scoreValue, term) => {
    if (!term) return score;
    if (haystack.includes(term)) {
      if (chunk.topic.toLowerCase().includes(term)) return scoreValue + 5;
      if ((chunk.subtopic ?? "").toLowerCase().includes(term)) return scoreValue + 3;
      if ((chunk.track ?? "").toLowerCase().includes(term)) return scoreValue + 4;
      return scoreValue + 1;
    }
    return scoreValue;
  }, 0);

  if (preferredTrack && (chunk.track ?? "").toLowerCase().includes(preferredTrack.toLowerCase())) {
    score += 6;
  }

  const metadata = chunk.metadata ?? {};
  const chunkLessonId =
    typeof metadata.lessonId === "string" ? (metadata.lessonId as string) : null;
  if (contextType === "lesson" || contextType === "course") {
    const lessonId = typeof contextData.lessonId === "string" ? contextData.lessonId : null;
    const courseId = typeof contextData.courseId === "string" ? contextData.courseId : null;
    if (lessonId && metadata.lessonId === lessonId) score += 24;
    if (courseId && metadata.courseId === courseId) score += 14;
    if (chunk.content_category === "lesson") score += 3;
    // Boost chunks from OTHER lessons the learner has actually visited (RAG memory across lessons).
    if (
      chunkLessonId &&
      chunkLessonId !== lessonId &&
      seenLessonIds.has(chunkLessonId)
    ) {
      score += 10;
    }
  }
  if (contextType === "course_discovery" && chunk.content_category === "course_catalog") {
    score += 5;
  }
  if (contextType === "career" && chunk.content_category === "career_track") {
    score += 5;
  }
  if (contextType === "activity" && chunk.content_category === "activity") {
    score += 5;
  }

  return score;
}

function normalizeChunkMetadata(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function normalizeKnowledgeChunk(input: Record<string, unknown>): KnowledgeChunkRow {
  return {
    topic: typeof input.topic === "string" ? input.topic : "Knowledge chunk",
    subtopic: typeof input.subtopic === "string" ? input.subtopic : null,
    content: typeof input.content === "string" ? input.content : "",
    content_category: typeof input.content_category === "string" ? input.content_category : "platform_guide",
    track: typeof input.track === "string" ? input.track : null,
    source_table: typeof input.source_table === "string" ? input.source_table : "knowledge_chunks",
    source_id: typeof input.source_id === "string" ? input.source_id : "",
    locale: input.locale === "en" ? "en" : "vi",
    title: typeof input.title === "string" ? input.title : typeof input.topic === "string" ? input.topic : "Knowledge chunk",
    chunk_kind: typeof input.chunk_kind === "string" ? input.chunk_kind : "summary",
    metadata: normalizeChunkMetadata(input.metadata),
    similarity: typeof input.similarity === "number" ? input.similarity : undefined,
  };
}

async function embedQuery(message: string): Promise<number[] | null> {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: message,
    }),
  });
  if (!response.ok) {
    console.warn("[ai-tutor] query embedding failed", response.status);
    return null;
  }
  const payload = await response.json().catch(() => null) as { data?: Array<{ embedding?: number[] }> } | null;
  const embedding = payload?.data?.[0]?.embedding;
  return Array.isArray(embedding) && embedding.length > 0 ? embedding : null;
}

async function vectorSearchKnowledge(
  db: SupabaseClient,
  queryEmbedding: number[],
  categories: string[],
  locale: "vi" | "en",
): Promise<KnowledgeChunkRow[]> {
  const { data, error } = await db.rpc("match_knowledge_chunks", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    match_count: 8,
    filter_categories: categories,
    preferred_locale: locale,
    metadata_filter: null,
  });
  if (error) {
    console.warn("[ai-tutor] vector search failed", error.message);
    return [];
  }
  return Array.isArray(data)
    ? data
        .map((row) => normalizeKnowledgeChunk(row as Record<string, unknown>))
        .filter((row) => row.content.trim().length > 0)
    : [];
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
}

async function keywordSearchKnowledge(
  db: SupabaseClient,
  searchTerms: string[],
  categories: string[],
  locale: "vi" | "en",
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
): Promise<KnowledgeChunkRow[]> {
  let query = db
    .from("knowledge_chunks")
    .select("topic,subtopic,content,content_category,track,source_table,source_id,locale,title,chunk_kind,metadata")
    .in("content_category", categories)
    .eq("locale", locale)
    .limit(24);

  if (contextType === "lesson" || contextType === "course") {
    const lessonTopic =
      typeof contextData.lessonTopic === "string" ? sanitizeSearchTerm(contextData.lessonTopic) : "";
    if (lessonTopic) {
      query = query.or(
        `topic.ilike.%${lessonTopic}%,subtopic.ilike.%${lessonTopic}%,content.ilike.%${lessonTopic}%`,
      );
    }
  } else if (searchTerms.length > 0) {
    const keyword = sanitizeSearchTerm(searchTerms[0]!);
    if (keyword) {
      query = query.or(
        `topic.ilike.%${keyword}%,subtopic.ilike.%${keyword}%,content.ilike.%${keyword}%,track.ilike.%${keyword}%,title.ilike.%${keyword}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[ai-tutor] keyword knowledge retrieval failed", error.message);
    return [];
  }
  return Array.isArray(data)
    ? data
        .map((row) => normalizeKnowledgeChunk(row as Record<string, unknown>))
        .filter((row) => row.content.trim().length > 0)
    : [];
}

function dedupeKnowledgeChunks(chunks: KnowledgeChunkRow[]): KnowledgeChunkRow[] {
  const seen = new Set<string>();
  const output: KnowledgeChunkRow[] = [];
  for (const chunk of chunks) {
    const key = [
      chunk.source_table,
      chunk.source_id,
      chunk.locale,
      chunk.chunk_kind,
      chunk.title,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(chunk);
  }
  return output;
}

async function retrieveKnowledgeChunks(
  db: SupabaseClient,
  message: string,
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
  seenLessonIds: Set<string>,
): Promise<KnowledgeChunkRow[]> {
  const categories = knowledgeCategoriesForContext(contextType);
  if (categories.length === 0) return [];

  const currentLessonId =
    typeof contextData.lessonId === "string" ? contextData.lessonId : null;
  // For lesson/course contexts, only surface lesson-category chunks the learner
  // has actually visited (plus the current lesson). Other categories are unaffected.
  const allowLessonChunk = (chunk: KnowledgeChunkRow): boolean => {
    if (chunk.content_category !== "lesson") return true;
    if (contextType !== "lesson" && contextType !== "course") return true;
    const meta = chunk.metadata ?? {};
    const lessonId = typeof meta.lessonId === "string" ? (meta.lessonId as string) : null;
    if (!lessonId) return true; // legacy chunk without metadata — let it through
    if (lessonId === currentLessonId) return true;
    return seenLessonIds.has(lessonId);
  };

  const preferredLocale = detectPreferredLanguage(message);
  const fallbackLocale: "vi" | "en" = preferredLocale === "vi" ? "en" : "vi";
  const searchTerms = extractKnowledgeTerms(message, contextType, contextData);
  const preferredTrack =
    typeof contextData.trackInterest === "string" ? contextData.trackInterest.trim() : null;
  const queryEmbedding = await embedQuery(message);

  const vectorPreferred = queryEmbedding
    ? await vectorSearchKnowledge(db, queryEmbedding, categories, preferredLocale)
    : [];
  const keywordPreferred = await keywordSearchKnowledge(
    db,
    searchTerms,
    categories,
    preferredLocale,
    contextType,
    contextData,
  );

  const needFallback = dedupeKnowledgeChunks([...vectorPreferred, ...keywordPreferred]).length < 3;
  const vectorFallback = needFallback && queryEmbedding
    ? await vectorSearchKnowledge(db, queryEmbedding, categories, fallbackLocale)
    : [];
  const keywordFallback = needFallback
    ? await keywordSearchKnowledge(
        db,
        searchTerms,
        categories,
        fallbackLocale,
        contextType,
        contextData,
      )
    : [];

  return dedupeKnowledgeChunks([
    ...vectorPreferred,
    ...keywordPreferred,
    ...vectorFallback,
    ...keywordFallback,
  ])
    .filter(allowLessonChunk)
    .map((chunk) => ({
      ...chunk,
      score:
        scoreKnowledgeChunk(
          chunk,
          searchTerms,
          preferredTrack,
          contextType,
          contextData,
          seenLessonIds,
        ) + (typeof chunk.similarity === "number" ? chunk.similarity * 12 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .filter((chunk) => chunk.score > 0 || searchTerms.length === 0)
    .slice(0, 5)
    .map(({ score: _score, ...chunk }) => chunk);
}

function buildKnowledgePromptSection(chunks: KnowledgeChunkRow[]): string {
  if (chunks.length === 0) return "Knowledge snippets: none";
  return [
    "Knowledge snippets:",
    ...chunks.map((chunk, index) => {
      const header = [chunk.content_category, chunk.topic, chunk.subtopic]
        .filter(Boolean)
        .join(" / ");
      return `${index + 1}. ${header}\n${chunk.content.slice(0, 600)}`;
    }),
  ].join("\n");
}

async function loadDashboardContext(
  db: SupabaseClient,
  userId: string,
  profile: ProfileRow | null,
): Promise<DashboardContextData> {
  const { data: enrollments, error: enrollmentsError } = await db
    .from("enrollments")
    .select("course_id,last_accessed_at")
    .eq("user_id", userId)
    .order("last_accessed_at", { ascending: false })
    .limit(3);
  if (enrollmentsError) throw new Error(enrollmentsError.message);

  const courseIds = Array.from(new Set((enrollments ?? []).map((row) => String(row.course_id ?? ""))).values()).filter(Boolean);
  const [{ data: courses, error: coursesError }, { data: progressRows, error: progressError }, { count: lessonCount, error: lessonCountError }] =
    await Promise.all([
      courseIds.length
        ? db.from("courses").select("id,data").in("id", courseIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? db.from("lesson_progress").select("course_id,completed_at").eq("user_id", userId).in("course_id", courseIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? db.from("course_lessons").select("id", { count: "exact", head: true }).in("course_id", courseIds)
        : Promise.resolve({ count: 0, error: null }),
    ]);
  if (coursesError) throw new Error(coursesError.message);
  if (progressError) throw new Error(progressError.message);
  if (lessonCountError) throw new Error(lessonCountError.message);

  const courseTitles = new Map<string, string>();
  for (const course of courses ?? []) {
    const title = typeof course.data?.title === "string" ? course.data.title : "Course";
    courseTitles.set(String(course.id), title);
  }

  const completedByCourse = new Map<string, number>();
  for (const row of progressRows ?? []) {
    if (!row.completed_at) continue;
    const courseId = String(row.course_id ?? "");
    completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
  }

  const activeCourses = (enrollments ?? []).map((row) => {
    const courseId = String(row.course_id ?? "");
    return {
      courseId,
      title: courseTitles.get(courseId) ?? "Course",
      completedLessons: completedByCourse.get(courseId) ?? 0,
    };
  });

  const [discoveryContext, careerContext, activityContext] = await Promise.all([
    loadCourseDiscoveryContext(db, userId, profile),
    loadCareerContext(db, profile),
    loadActivityContext(db, profile),
  ]);

  return {
    activeCourses,
    totalLessons: Number(lessonCount ?? 0),
    completedLessons: Array.from(completedByCourse.values()).reduce((sum, value) => sum + value, 0),
    recentCourses: discoveryContext.recentCourses,
    featuredTracks: careerContext.featuredTracks,
    featuredHackathons: activityContext.featuredHackathons,
    goal: discoveryContext.goal,
    trackInterest: discoveryContext.trackInterest,
    currentLevel: careerContext.currentLevel,
    categoryInterests: discoveryContext.categoryInterests,
  };
}

async function loadGlobalContext(
  db: SupabaseClient,
  userId: string,
  profile: ProfileRow | null,
): Promise<GlobalContextData> {
  const [discoveryContext, careerContext, activityContext, profileReviewContext] = await Promise.all([
    loadCourseDiscoveryContext(db, userId, profile),
    loadCareerContext(db, profile),
    loadActivityContext(db, profile),
    loadProfileReviewContext(db, userId, profile),
  ]);

  return {
    recentCourses: discoveryContext.recentCourses,
    featuredTracks: careerContext.featuredTracks,
    featuredHackathons: activityContext.featuredHackathons,
    goal: discoveryContext.goal,
    trackInterest: discoveryContext.trackInterest,
    currentLevel: careerContext.currentLevel,
    categoryInterests: discoveryContext.categoryInterests,
    enrolledCoursesCount: profileReviewContext.enrolledCoursesCount,
    completedCoursesCount: profileReviewContext.completedCoursesCount,
  };
}

async function loadLessonContext(
  db: SupabaseClient,
  userId: string,
  lessonId: string,
): Promise<LessonContextData> {
  const { data: lessonRow, error: lessonError } = await db
    .from("course_lessons")
    .select("course_id,data")
    .eq("id", lessonId)
    .maybeSingle<{ course_id: string; data: Record<string, unknown> | null }>();
  if (lessonError) throw new Error(lessonError.message);
  if (!lessonRow?.course_id) throw new Error("Lesson not found");

  const courseId = String(lessonRow.course_id);
  const [{ data: courseRow, error: courseError }, { count: totalLessons, error: lessonCountError }, { data: progressRows, error: progressError }] =
    await Promise.all([
      db.from("courses").select("id,slug,data").eq("id", courseId).maybeSingle<{ id: string; slug: string | null; data: Record<string, unknown> | null }>(),
      db.from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      db.from("lesson_progress").select("lesson_id,completed_at").eq("user_id", userId).eq("course_id", courseId),
    ]);
  if (courseError) throw new Error(courseError.message);
  if (lessonCountError) throw new Error(lessonCountError.message);
  if (progressError) throw new Error(progressError.message);

  const completedLessons = (progressRows ?? []).filter((row) => Boolean(row.completed_at)).length;
  const total = Number(totalLessons ?? 0);
  const progressPercent = total > 0 ? Math.min(100, Math.round((completedLessons / total) * 100)) : 0;

  return {
    courseId,
    courseSlug: courseRow?.slug?.trim() || null,
    courseTitle:
      typeof courseRow?.data?.title === "string" && courseRow.data.title.trim()
        ? courseRow.data.title
        : "Course",
    lessonTitle:
      typeof lessonRow.data?.title === "string" && lessonRow.data.title.trim()
        ? lessonRow.data.title
        : "Lesson",
    lessonTopic:
      typeof lessonRow.data?.topic === "string" && lessonRow.data.topic.trim()
        ? lessonRow.data.topic.trim()
        : typeof lessonRow.data?.subtopic === "string" && lessonRow.data.subtopic.trim()
          ? lessonRow.data.subtopic.trim()
          : typeof lessonRow.data?.title === "string" && lessonRow.data.title.trim()
            ? lessonRow.data.title.trim()
            : null,
    lessonDescription:
      typeof lessonRow.data?.description_markdown === "string"
        ? lessonRow.data.description_markdown
        : typeof lessonRow.data?.short_description === "string"
          ? lessonRow.data.short_description
          : null,
    totalLessons: total,
    completedLessons,
    progressPercent,
  };
}

async function loadCourseDiscoveryContext(
  db: SupabaseClient,
  userId: string,
  profile: ProfileRow | null,
): Promise<CourseDiscoveryContextData> {
  const [{ data: enrollments, error: enrollmentsError }, { data: courses, error: coursesError }] =
    await Promise.all([
      db
        .from("enrollments")
        .select("course_id,last_accessed_at")
        .eq("user_id", userId)
        .order("last_accessed_at", { ascending: false })
        .limit(5),
      db
        .from("courses")
        .select("id,slug,data")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  if (coursesError) throw new Error(coursesError.message);

  const titles = (courses ?? [])
    .map((row) => (typeof row.data?.title === "string" ? row.data.title.trim() : ""))
    .filter(Boolean);
  const recentCourses = (courses ?? [])
    .map((row) => ({
      id: String(row.id ?? ""),
      slug: typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : null,
      title: typeof row.data?.title === "string" ? row.data.title.trim() : "",
      shortDescription:
        typeof row.data?.short_description === "string" && row.data.short_description.trim()
          ? row.data.short_description.trim()
          : typeof row.data?.description === "string" && row.data.description.trim()
            ? row.data.description.trim().slice(0, 180)
            : null,
      category:
        typeof row.data?.primary_category === "string" && row.data.primary_category.trim()
          ? row.data.primary_category.trim()
          : null,
      level:
        typeof row.data?.level === "string" && row.data.level.trim() ? row.data.level.trim() : null,
    }))
    .filter((row) => row.id && row.title);

  return {
    enrolledCount: Number(enrollments?.length ?? 0),
    recentCourseTitles: titles,
    recentCourses,
    goal: profile?.user_goal?.trim() || null,
    trackInterest: profile?.track_interest?.trim() || null,
    categoryInterests: Array.isArray(profile?.category_interests) ? profile!.category_interests : [],
  };
}

async function loadCareerContext(
  db: SupabaseClient,
  profile: ProfileRow | null,
): Promise<CareerContextData> {
  const { data, error } = await db
    .from("career_tracks")
    .select("slug,title,description,owner_scope,instructor_id,published")
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(4);
  if (error) throw new Error(error.message);

  const instructorIds = Array.from(
    new Set(
      (data ?? [])
        .filter((row) => row.owner_scope === "instructor" && typeof row.instructor_id === "string" && row.instructor_id.trim())
        .map((row) => String(row.instructor_id)),
    ),
  );
  const instructorHandles = new Map<string, string>();
  if (instructorIds.length > 0) {
    const { data: profiles, error: profilesError } = await db
      .from("public_profiles")
      .select("id,username,ocid")
      .in("id", instructorIds);
    if (profilesError) throw new Error(profilesError.message);
    for (const profileRow of profiles ?? []) {
      const id = typeof profileRow.id === "string" ? profileRow.id : "";
      const handle =
        (typeof profileRow.username === "string" ? profileRow.username.trim() : "") ||
        (typeof profileRow.ocid === "string" ? profileRow.ocid.trim() : "");
      if (id && handle) instructorHandles.set(id, handle);
    }
  }

  return {
    trackTitles: (data ?? [])
      .map((row) => (typeof row.title === "string" ? row.title.trim() : ""))
      .filter(Boolean),
    featuredTracks: (data ?? [])
      .map((row) => ({
        slug: typeof row.slug === "string" ? row.slug.trim() : "",
        title: typeof row.title === "string" ? row.title.trim() : "",
        description:
          typeof row.description === "string" && row.description.trim()
            ? row.description.trim().slice(0, 180)
            : null,
        ownerScope:
          row.owner_scope === "corelia" || row.owner_scope === "instructor"
            ? row.owner_scope
            : null,
        instructorHandle:
          row.owner_scope === "instructor" && typeof row.instructor_id === "string"
            ? instructorHandles.get(row.instructor_id) ?? null
            : null,
      }))
      .filter((row) => row.slug && row.title),
    currentLevel: profile?.user_level?.trim() || null,
    trackInterest: profile?.track_interest?.trim() || null,
  };
}

async function loadActivityContext(
  db: SupabaseClient,
  profile: ProfileRow | null,
): Promise<ActivityContextData> {
  const [{ data: hackathons, error: hackathonsError }, { data: projects, error: projectsError }] =
    await Promise.all([
      db
        .from("hackathons")
        .select("status,document")
        .in("status", ["published", "running", "ended"])
        .order("updated_at", { ascending: false })
        .limit(3),
      db
        .from("projects")
        .select("title")
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(3),
    ]);
  if (hackathonsError) throw new Error(hackathonsError.message);
  if (projectsError) throw new Error(projectsError.message);

  return {
    hackathonTitles: (hackathons ?? [])
      .map((row) => (typeof row.document?.title === "string" ? row.document.title.trim() : ""))
      .filter(Boolean),
    featuredHackathons: (hackathons ?? [])
      .map((row) => ({
        slug: typeof row.document?.slug === "string" ? row.document.slug.trim() : "",
        title: typeof row.document?.title === "string" ? row.document.title.trim() : "",
        status: typeof row.status === "string" ? row.status : null,
        tagline:
          typeof row.document?.tagline === "string" && row.document.tagline.trim()
            ? row.document.tagline.trim().slice(0, 160)
            : null,
        registrationDeadline:
          typeof row.document?.registration_deadline === "string"
            ? row.document.registration_deadline
            : null,
        submissionDeadline:
          typeof row.document?.submission_deadline === "string"
            ? row.document.submission_deadline
            : null,
        startsAt: typeof row.document?.starts_at === "string" ? row.document.starts_at : null,
        endsAt: typeof row.document?.ends_at === "string" ? row.document.ends_at : null,
      }))
      .filter((row) => row.slug && row.title),
    projectTitles: (projects ?? [])
      .map((row) => (typeof row.title === "string" ? row.title.trim() : ""))
      .filter(Boolean),
    trackInterest: profile?.track_interest?.trim() || null,
    categoryInterests: Array.isArray(profile?.category_interests) ? profile.category_interests : [],
  };
}

async function loadProfileReviewContext(
  db: SupabaseClient,
  userId: string,
  profile: ProfileRow | null,
): Promise<ProfileReviewContextData> {
  const [
    { data: enrollments, error: enrollmentsError },
    { data: progressRows, error: progressError },
    { count: credentialCount, error: credentialError },
    { count: aiQuestionCount, error: aiQuestionError },
    { count: publicProjectCount, error: projectCountError },
  ] = await Promise.all([
    db.from("enrollments").select("course_id").eq("user_id", userId),
    db.from("lesson_progress").select("course_id,lesson_id,completed_at").eq("user_id", userId),
    db
      .from("credential_issuances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    db
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user"),
    db
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("visibility", "public"),
  ]);
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  if (progressError) throw new Error(progressError.message);
  if (credentialError) throw new Error(credentialError.message);
  if (aiQuestionError) throw new Error(aiQuestionError.message);
  if (projectCountError) throw new Error(projectCountError.message);

  const [discoveryContext, careerContext, activityContext] = await Promise.all([
    loadCourseDiscoveryContext(db, userId, profile),
    loadCareerContext(db, profile),
    loadActivityContext(db, profile),
  ]);

  const enrolledCourseIds = Array.from(
    new Set((enrollments ?? []).map((row) => String(row.course_id ?? "")).filter(Boolean)),
  );

  let completedCoursesCount = 0;
  if (enrolledCourseIds.length > 0) {
    const { data: lessons, error: lessonsError } = await db
      .from("course_lessons")
      .select("course_id,id")
      .in("course_id", enrolledCourseIds);
    if (lessonsError) throw new Error(lessonsError.message);

    const totalByCourse = new Map<string, number>();
    for (const row of lessons ?? []) {
      const courseId = String(row.course_id ?? "");
      if (!courseId) continue;
      totalByCourse.set(courseId, (totalByCourse.get(courseId) ?? 0) + 1);
    }

    const completedByCourse = new Map<string, Set<string>>();
    for (const row of progressRows ?? []) {
      if (!row.completed_at) continue;
      const courseId = String(row.course_id ?? "");
      const lessonId = String(row.lesson_id ?? "");
      if (!courseId || !lessonId) continue;
      if (!completedByCourse.has(courseId)) completedByCourse.set(courseId, new Set());
      completedByCourse.get(courseId)!.add(lessonId);
    }

    completedCoursesCount = enrolledCourseIds.filter((courseId) => {
      const total = totalByCourse.get(courseId) ?? 0;
      const completed = completedByCourse.get(courseId)?.size ?? 0;
      return total > 0 && completed >= total;
    }).length;
  }

  return {
    enrolledCoursesCount: enrolledCourseIds.length,
    completedCoursesCount,
    credentialCount: Number(credentialCount ?? 0),
    aiQuestionCount: Number(aiQuestionCount ?? 0),
    publicProjectCount: Number(publicProjectCount ?? 0),
    recentCourses: discoveryContext.recentCourses,
    featuredTracks: careerContext.featuredTracks,
    featuredHackathons: activityContext.featuredHackathons,
    goal: discoveryContext.goal,
    trackInterest: discoveryContext.trackInterest,
    currentLevel: careerContext.currentLevel,
    categoryInterests: discoveryContext.categoryInterests,
  };
}

async function loadContextData(
  db: SupabaseClient,
  userId: string,
  contextType: BackendContextType,
  profile: ProfileRow | null,
  extras: { lessonId: string | null },
): Promise<Record<string, unknown>> {
  if (contextType === "lesson" || contextType === "course") {
    if (!extras.lessonId) throw new Error("lessonId is required for lesson context");
    return loadLessonContext(db, userId, extras.lessonId);
  }
  if (contextType === "dashboard") {
    return loadDashboardContext(db, userId, profile);
  }
  if (contextType === "course_discovery") {
    return loadCourseDiscoveryContext(db, userId, profile);
  }
  if (contextType === "career") {
    return loadCareerContext(db, profile);
  }
  if (contextType === "activity") {
    return loadActivityContext(db, profile);
  }
  if (contextType === "profile_review") {
    return loadProfileReviewContext(db, userId, profile);
  }
  return loadGlobalContext(db, userId, profile);
}


async function getRecentConversationHistory(
  db: SupabaseClient,
  userId: string,
  contextType: BackendContextType,
  lessonId: string | null,
  sessionId: string | null,
): Promise<Array<{ role: "user" | "assistant"; content: string; attachments: MessageAttachment[] }>> {
  let query = db
    .from("ai_conversations")
    .select("role,content,created_at,attachments")
    .eq("user_id", userId)
    .eq("context_type", contextType)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(8);
  query = lessonId ? query.eq("lesson_id", lessonId) : query.eq("session_id", sessionId!);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .reverse()
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: String(row.content ?? ""),
      attachments: parseAttachments((row as { attachments?: unknown }).attachments),
    }))
    .filter((row) => row.content.trim().length > 0 || row.attachments.length > 0);
}

function buildMessageContent(
  text: string,
  attachments: MessageAttachment[],
): string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  if (attachments.length === 0) return text;
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
  if (text.trim()) parts.push({ type: "text", text });
  for (const att of attachments) {
    parts.push({ type: "image_url", image_url: { url: att.url } });
  }
  return parts;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    if (!cors) return json({ message: "Origin not allowed" }, 403);
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return withCors(req, json({ message: "Method not allowed" }, 405));
  }

  try {
    const db = createServiceClient();
    const user = await verifyBearerUser(req, db);
    const body = parseRequest((await req.json().catch(() => ({}))) as TutorRequest);

    if (!body.message && body.attachments.length === 0) {
      return withCors(req, json({ message: "Message is required" }, 400));
    }
    if (body.message.length > 2000) {
      return withCors(req, json({ message: "Message is too long" }, 400));
    }
    if (body.action === "explain_selected_text") {
      if (!body.selectedText || body.selectedText.length < 4) {
        return withCors(req, json({ message: "selectedText is required" }, 400));
      }
    }

    const rawContextType = mapAssistantContext(body.assistantContext);
    // When courseId is provided with lesson context, use course-scoped sessions
    const contextType: BackendContextType =
      rawContextType === "lesson" && body.courseId ? "course" : rawContextType;
    if (rawContextType === "lesson" && !body.lessonId) {
      return withCors(req, json({ message: "lessonId is required for lesson context" }, 400));
    }
    // For course-scoped sessions, don't write lesson_id to ai_conversations (XOR constraint)
    const storeLessonId = contextType === "course" ? null : body.lessonId;

    const profile = await getProfile(db, user.id);
    const tier = await resolveEffectiveTier(db, user.id, profile?.tier ?? "free");
    const quota = await checkQuota(db, user.id, tier, FALLBACK_TIER_LIMITS);
    if (!quota.allowed) {
      const useTokenCounter =
        quota.quotaUnit === "token" ||
        (quota.quotaUnit === "both" && quota.monthlyTokensLimit != null &&
          quota.monthlyTokensUsed >= quota.monthlyTokensLimit);
      return withCors(
        req,
        json(
          {
            message: "Monthly quota exceeded",
            quotaUnit: quota.quotaUnit,
            used: useTokenCounter ? quota.monthlyTokensUsed : quota.monthlyUsed,
            limit: useTokenCounter ? quota.monthlyTokensLimit : quota.monthlyLimit,
            tier: quota.tier,
          },
          429,
        ),
      );
    }

    const sessionId = await ensureSession(db, user.id, contextType, body.sessionId, body.courseId, body.lessonId);

    if (body.lessonId && (contextType === "lesson" || contextType === "course")) {
      await requireLessonAccess(db, user.id, body.lessonId);
    }

    const loadedContextData = await loadContextData(db, user.id, contextType, profile, {
      lessonId: body.lessonId,
    });
    const contextData = {
      ...loadedContextData,
      surfaceHint: body.assistantContext,
      lessonId: body.lessonId,
      courseId: body.courseId ?? (typeof loadedContextData.courseId === "string" ? loadedContextData.courseId : null),
    };
    const learningMemory = await getLearningMemory(db, user.id);
    const language = detectPreferredLanguage(body.message);
    const suggestedPrompts = buildSuggestedPrompts({
      language,
      contextType,
      contextData,
      learningMemory,
    });
    const recommendedActions = buildRecommendedActions({
      language,
      contextType,
      contextData,
      learningMemory,
    });
    const recommendedEntities = buildRecommendedEntities({
      language,
      contextType,
      contextData,
      learningMemory,
    });
    const abuseCheck = await enforceAbuseChecks(db, user.id, body.message, contextType, body.lessonId, sessionId);
    if (abuseCheck.cachedResponse) {
      return withCors(
        req,
        json({
          ok: true,
          cached: true,
          sessionId: abuseCheck.cachedResponse.sessionId,
          assistantMessage: {
            role: "assistant",
            content: abuseCheck.cachedResponse.content,
            createdAt: new Date().toISOString(),
          },
          quota,
          sources: abuseCheck.cachedResponse.sources,
          suggestedPrompts,
          recommendedActions,
          recommendedEntities,
        }),
      );
    }

    const userInsert = {
      user_id: user.id,
      lesson_id: storeLessonId,
      session_id: sessionId,
      context_type: contextType,
      role: "user",
      content: body.message,
      status: "completed",
      tokens_used: estimateTokens(body.message),
      attachments: body.attachments,
    };
    const { error: userMessageError } = await db.from("ai_conversations").insert(userInsert);
    if (userMessageError) throw new Error(userMessageError.message);

    const { data: placeholder, error: placeholderError } = await db
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        lesson_id: storeLessonId,
        session_id: sessionId,
        context_type: contextType,
        role: "assistant",
        content: "",
        status: "pending",
        model_used: "pending",
      })
      .select("id")
      .single<{ id: string }>();
    if (placeholderError || !placeholder?.id) throw new Error(placeholderError?.message ?? "Could not create placeholder");

    const seenLessonIds = await fetchUserSeenLessonIds(db, user.id, body.courseId);
    const knowledgeChunks = await retrieveKnowledgeChunks(
      db,
      body.message,
      contextType,
      contextData,
      seenLessonIds,
    );
    const complexity = classifyComplexity(body.message, contextType, contextData);
    const sourceRefs = buildSourceRefs(knowledgeChunks);

    const history = await getRecentConversationHistory(
      db,
      user.id,
      contextType,
      storeLessonId,
      sessionId,
    );
    const explainSelection =
      body.action === "explain_selected_text" && body.selectedText
        ? { selectedText: body.selectedText }
        : null;
    const systemPrompt = buildSystemPrompt(
      profile,
      contextType,
      contextData,
      knowledgeChunks,
      learningMemory,
      buildKnowledgePromptSection,
      explainSelection,
    );

    if (body.stream) {
      const headers = sseHeaders();
      if (cors) {
        for (const [key, value] of cors.entries()) headers.set(key, value);
      }
      const responseStream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const encoder = new TextEncoder();
          const send = (event: "meta" | "delta" | "done" | "error", data: unknown) => {
            controller.enqueue(encoder.encode(encodeSse(event, data)));
          };

          let outputText = "";
          try {
            send("meta", {
              sessionId,
              quota,
              placeholderId: placeholder.id,
              sources: sourceRefs,
              suggestedPrompts,
              recommendedActions,
              recommendedEntities,
            });

            const result = await streamProviderText(
              {
                messages: [
                  { role: "system", content: systemPrompt },
                  ...history.map((message) => ({
                    role: message.role,
                    content:
                      message.role === "user" && message.attachments.length > 0
                        ? buildMessageContent(message.content, message.attachments)
                        : message.content,
                  })),
                ],
                quota,
                contextType,
                complexity,
              },
              {
                onTextDelta: async (delta) => {
                  outputText += delta;
                  send("delta", { text: delta });
                },
              },
            );

            const finalText = outputText.trim();
            if (!finalText) throw new Error("Empty response from AI provider");
            const nowIso = new Date().toISOString();
            const totalTokensUsed = result.usage
              ? result.usage.inputTokens + result.usage.outputTokens
              : estimateTokens(body.message) + estimateTokens(finalText);
            const updatedQuota = incrementQuotaSnapshot(quota, totalTokensUsed);

            const { error: assistantError } = await db
              .from("ai_conversations")
              .update({
                content: finalText,
                status: "completed",
                complexity,
                model_used: result.model,
                tokens_used: result.usage?.outputTokens ?? estimateTokens(finalText),
                sources: sourceRefs,
                updated_at: nowIso,
              })
              .eq("id", placeholder.id);
            if (assistantError) throw new Error(assistantError.message);

            if (sessionId) {
              const { data: sessionRow } = await db
                .from("ai_chat_sessions")
                .select("message_count,title")
                .eq("id", sessionId)
                .maybeSingle<{ message_count: number; title: string | null }>();
              const prevCount = Number(sessionRow?.message_count ?? 0);
              const isFirstMessage = prevCount === 0;
              const existingTitle = sessionRow?.title?.trim() ?? "";
              const autoTitle = isFirstMessage && !existingTitle
                ? body.message.trim().slice(0, 60)
                : null;
              const sessionUpdate: Record<string, unknown> = {
                message_count: prevCount + 2,
                last_message_at: nowIso,
                updated_at: nowIso,
              };
              if (autoTitle) sessionUpdate.title = autoTitle;
              const { error: sessionUpdateError } = await db
                .from("ai_chat_sessions")
                .update(sessionUpdate)
                .eq("id", sessionId);
              if (sessionUpdateError) throw new Error(sessionUpdateError.message);
            }

            await upsertUsage(db, user.id, {
              inputText: body.message,
              outputText: finalText,
              modelUsed: result.model,
              feature: "cora_chat",
              conversationId: placeholder.id,
              actualUsage: result.usage,
            });
            const memoryDelta = await updateLearningMemory(db, {
              userId: user.id,
              contextType,
              lessonId: body.lessonId,
              sessionId,
              message: body.message,
              assistantText: finalText,
              contextData,
              knowledgeChunks,
              complexity,
            });

            send("done", {
              sessionId,
              quota: updatedQuota,
              model: result.model,
              provider: result.provider,
              createdAt: nowIso,
              fullText: finalText,
              sources: sourceRefs,
              suggestedPrompts,
              recommendedActions,
              recommendedEntities,
              memoryDelta,
            });
            controller.close();
          } catch (streamError) {
            console.error("[ai-tutor] stream failure", streamError);
            await db
              .from("ai_conversations")
              .update({
                content: outputText,
                status: outputText ? "completed" : "error",
                tokens_used: estimateTokens(outputText),
                sources: sourceRefs,
                updated_at: new Date().toISOString(),
              })
              .eq("id", placeholder.id);
            send("error", {
              message:
                streamError instanceof Error ? streamError.message : "Streaming failed",
            });
            controller.close();
          }
        },
      });

      return new Response(responseStream, { status: 200, headers });
    }

    let collected = "";
    const providerResult = await streamProviderText(
      {
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        quota,
        contextType,
        complexity,
      },
      {
        onTextDelta: (delta) => {
          collected += delta;
        },
      },
    );
    const finalText = (providerResult.outputText || collected).trim();
    if (!finalText) throw new Error("Empty response from AI provider");
    const nowIso = new Date().toISOString();
    const totalTokensUsed = providerResult.usage
      ? providerResult.usage.inputTokens + providerResult.usage.outputTokens
      : estimateTokens(body.message) + estimateTokens(finalText);
    const updatedQuota = incrementQuotaSnapshot(quota, totalTokensUsed);

    const { error: assistantError } = await db
      .from("ai_conversations")
      .update({
        content: finalText,
        status: "completed",
        complexity,
        model_used: providerResult.model,
        tokens_used: providerResult.usage?.outputTokens ?? estimateTokens(finalText),
        sources: sourceRefs,
        updated_at: nowIso,
      })
      .eq("id", placeholder.id);
    if (assistantError) throw new Error(assistantError.message);

    if (sessionId) {
      const { data: sessionRow } = await db
        .from("ai_chat_sessions")
        .select("message_count,title")
        .eq("id", sessionId)
        .maybeSingle<{ message_count: number; title: string | null }>();
      const prevCount = Number(sessionRow?.message_count ?? 0);
      const isFirstMessage = prevCount === 0;
      const existingTitle = sessionRow?.title?.trim() ?? "";
      const autoTitle = isFirstMessage && !existingTitle
        ? body.message.trim().slice(0, 60)
        : null;
      const sessionUpdate: Record<string, unknown> = {
        message_count: prevCount + 2,
        last_message_at: nowIso,
        updated_at: nowIso,
      };
      if (autoTitle) sessionUpdate.title = autoTitle;
      const { error: sessionUpdateError } = await db
        .from("ai_chat_sessions")
        .update(sessionUpdate)
        .eq("id", sessionId);
      if (sessionUpdateError) throw new Error(sessionUpdateError.message);
    }

    await upsertUsage(db, user.id, {
      inputText: body.message,
      outputText: finalText,
      modelUsed: providerResult.model,
      feature: "cora_chat",
      conversationId: placeholder.id,
      actualUsage: providerResult.usage,
    });
    const memoryDelta = await updateLearningMemory(db, {
      userId: user.id,
      contextType,
      lessonId: body.lessonId,
      sessionId,
      message: body.message,
      assistantText: finalText,
      contextData,
      knowledgeChunks,
      complexity,
    });

    return withCors(
      req,
      json({
        ok: true,
        cached: false,
        sessionId,
        assistantMessage: {
          role: "assistant",
          content: finalText,
          createdAt: nowIso,
        },
        quota: updatedQuota,
        sources: sourceRefs,
        suggestedPrompts,
        recommendedActions,
        recommendedEntities,
        memoryDelta,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled server error";
    const status =
      message === "Missing Authorization header" ||
      message === "Invalid Authorization header" ||
      message === "Invalid or expired session" ||
      message === "Email confirmation required"
        ? 401
        : message === "Rate limit exceeded" || message === "Too many concurrent AI requests"
          ? 429
          : message === "Lesson access denied"
            ? 403
            : 500;
    console.error("[ai-tutor] unhandled", error);
    const clientMessage =
      status === 500
        ? "Cora AI đang gặp trục trặc, thử lại sau ít phút giúp mình."
        : message;
    return withCors(req, json({ message: clientMessage }, status));
  }
});
