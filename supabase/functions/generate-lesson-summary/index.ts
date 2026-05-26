import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Locale = "vi" | "en";

type RequestBody = {
  lessonId?: unknown;
  courseId?: unknown;
  locale?: unknown;
  force?: unknown;
};

type LessonRow = {
  id: string;
  course_id: string;
  data: Record<string, unknown> | null;
};

type LessonSummaryPayload = {
  keyPoints: string[];
  practicalTips: string[];
};

const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-secret-key, x-supabase-api-version";

function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOriginsFromEnv(): Set<string> {
  const explicit = Deno.env.get("CORELIA_CORS_ALLOWED_ORIGINS")?.trim() ?? "";
  const app = Deno.env.get("CORELIA_APP_ORIGIN")?.trim() ?? "";
  const merged = explicit || app;
  const out = new Set<string>();
  if (!merged) return out;
  for (const item of merged.split(",")) {
    const origin = normalizeOrigin(item);
    if (origin) out.add(origin);
  }
  return out;
}

function buildCorsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    Vary: "Origin",
  });
}

function corsHeadersForRequest(req: Request): Headers | null {
  const origin = req.headers.get("origin")?.trim() ?? "";
  if (!origin) return null;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;
  const allowed = allowedOriginsFromEnv();
  if (!allowed.has(normalized)) return null;
  return buildCorsHeaders(normalized);
}

function withCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeadersForRequest(req);
  if (cors) {
    for (const [key, value] of cors.entries()) headers.set(key, value);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readOptionalEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim() ?? "";
    if (value) return value;
  }
  return "";
}

function requireAnyEnv(...names: string[]): string {
  const value = readOptionalEnv(...names);
  if (value) return value;
  throw new Error(`Missing env: ${names.join(" | ")}`);
}

function readSupabaseSecretKey(): string {
  const raw = readOptionalEnv("CORELIA_SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Missing env: CORELIA_SUPABASE_SECRET_KEYS | SUPABASE_SECRET_KEYS");
  if (raw.startsWith("sb_secret_")) return raw;
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const direct = parsed.default;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  for (const v of Object.values(parsed)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  throw new Error("Invalid env: CORELIA_SUPABASE_SECRET_KEYS | SUPABASE_SECRET_KEYS");
}

function createServiceClient(): SupabaseClient {
  const url = requireAnyEnv("CORELIA_SUPABASE_URL", "SUPABASE_URL");
  const key = readSupabaseSecretKey();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function verifyBearerUser(req: Request, db: SupabaseClient): Promise<User> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) throw new Error("Missing Authorization header");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Invalid Authorization header");
  const { data, error } = await db.auth.getUser(match[1]!);
  if (error || !data.user) throw new Error("Invalid or expired session");
  if (!data.user.email_confirmed_at) throw new Error("Email confirmation required");
  return data.user;
}

function parseBody(body: RequestBody): {
  lessonId: string;
  courseId: string;
  locale: Locale;
  force: boolean;
} {
  const lessonId = typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
  const courseId = typeof body.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;
  const locale: Locale = body.locale === "en" ? "en" : "vi";
  const force = body.force === true;
  if (!lessonId) throw new Error("Thiếu lessonId.");
  if (!courseId) throw new Error("Thiếu courseId.");
  return { lessonId, courseId, locale, force };
}

function detectLocaleFromContent(text: string): Locale {
  return /[à-ỹđ]/i.test(text) ? "vi" : "en";
}

type ExistingSummary = {
  id: string;
  key_points: unknown;
  practical_tips: unknown;
  locale: Locale;
  created_at: string;
  updated_at: string;
};

async function loadExistingSummary(
  db: SupabaseClient,
  userId: string,
  lessonId: string,
): Promise<ExistingSummary | null> {
  const { data, error } = await db
    .from("lesson_summaries")
    .select("id,key_points,practical_tips,locale,created_at,updated_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle<ExistingSummary>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function loadLesson(
  db: SupabaseClient,
  courseId: string,
  lessonId: string,
): Promise<LessonRow | null> {
  const { data, error } = await db
    .from("course_lessons")
    .select("id,course_id,data")
    .eq("course_id", courseId)
    .eq("id", lessonId)
    .maybeSingle<LessonRow>();
  if (error) throw new Error(error.message);
  return data;
}

type LessonSourceText = {
  lessonTitle: string;
  shortDescription: string;
  markdownDescription: string;
  sourceKinds: string[];
};

function buildLessonSourceText(row: LessonRow): LessonSourceText {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const lessonTitle = String(data.title ?? "").trim() || "Lesson";
  const shortDescription = String(data.short_description ?? "").trim();
  const markdownDescription = String(data.description_markdown ?? "").trim();
  const sourceKinds: string[] = [];
  if (shortDescription) sourceKinds.push("short_description");
  if (markdownDescription) sourceKinds.push("description_markdown");
  return { lessonTitle, shortDescription, markdownDescription, sourceKinds };
}

function buildPrompt(source: LessonSourceText, locale: Locale): { system: string; user: string } {
  const system =
    locale === "vi"
      ? `Bạn là Cora, gia sư AI của Corelia Academy. Nhiệm vụ: tóm tắt bài học cho học viên VỪA HỌC XONG, dạng "cheat sheet" để ôn lại nhanh.

Yêu cầu:
- Trả về JSON đúng schema, KHÔNG thêm văn bản nào khác.
- key_points: 3-5 ý chính, mỗi ý 1 câu ngắn (<= 25 từ), nêu KHÁI NIỆM hoặc KẾT LUẬN cốt lõi.
- practical_tips: 2-3 mẹo/lưu ý/bước thực hành để học viên áp dụng ngay (mỗi mẹo 1 câu).
- Viết hoàn toàn bằng tiếng Việt, tự nhiên, không sáo rỗng.
- Không lặp lại tiêu đề bài học.

Schema:
{
  "key_points": ["...", "..."],
  "practical_tips": ["...", "..."]
}`
      : `You are Cora, the AI tutor for Corelia Academy. Task: produce a quick-recap cheat sheet for a learner who JUST FINISHED this lesson.

Requirements:
- Return JSON matching the schema. NOTHING else.
- key_points: 3-5 main ideas, each 1 short sentence (<= 25 words), capturing the core CONCEPT or TAKEAWAY.
- practical_tips: 2-3 actionable tips or next steps the learner can apply right away (1 sentence each).
- Write entirely in English, natural and concrete.
- Do not repeat the lesson title.

Schema:
{
  "key_points": ["...", "..."],
  "practical_tips": ["...", "..."]
}`;

  const parts = [
    `Lesson title: ${source.lessonTitle}`,
    source.shortDescription ? `Short description: ${source.shortDescription}` : null,
    source.markdownDescription ? `Lesson content:\n${source.markdownDescription}` : null,
  ].filter(Boolean);

  const user = parts.join("\n\n");
  return { system, user };
}

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function extractResponseText(payload: OpenAiResponsesPayload): string | null {
  const top = payload.output_text?.trim();
  if (top) return top;
  const outputs = Array.isArray(payload.output) ? payload.output : [];
  const joined = outputs
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((item) => item?.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
  return joined || null;
}

function parseModelJson(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("Phản hồi AI không phải JSON hợp lệ.");
  }
}

function normalizeStringList(input: unknown, maxItems: number): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function validateSummary(raw: unknown): LessonSummaryPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI trả về summary không hợp lệ.");
  }
  const obj = raw as Record<string, unknown>;
  const keyPoints = normalizeStringList(obj.key_points ?? obj.keyPoints, 5);
  const practicalTips = normalizeStringList(obj.practical_tips ?? obj.practicalTips, 3);
  if (keyPoints.length < 2) {
    throw new Error("AI không tạo đủ key points cho bài học này.");
  }
  return { keyPoints, practicalTips };
}

async function generateSummaryWithOpenAi(
  system: string,
  userPrompt: string,
): Promise<{ summary: LessonSummaryPayload; model: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) throw new Error("Missing env: OPENAI_API_KEY");
  const model = Deno.env.get("CORELIA_OPENAI_SUMMARY_MODEL")?.trim() || "gpt-4o-mini";

  const input = `${system}\n\n${userPrompt}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[generate-lesson-summary] openai", response.status, errText);
    throw new Error("OpenAI chưa phản hồi được tóm tắt.");
  }

  const payload = (await response.json()) as OpenAiResponsesPayload;
  const content = extractResponseText(payload);
  if (!content) throw new Error("OpenAI trả về nội dung rỗng.");
  const parsed = parseModelJson(content);
  return { summary: validateSummary(parsed), model };
}

async function upsertSummary(
  db: SupabaseClient,
  args: {
    userId: string;
    courseId: string;
    lessonId: string;
    locale: Locale;
    summary: LessonSummaryPayload;
    sourceKinds: string[];
    model: string;
  },
): Promise<ExistingSummary> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("lesson_summaries")
    .upsert(
      {
        user_id: args.userId,
        course_id: args.courseId,
        lesson_id: args.lessonId,
        locale: args.locale,
        key_points: args.summary.keyPoints,
        practical_tips: args.summary.practicalTips,
        source_kinds: args.sourceKinds,
        model_used: args.model,
        updated_at: nowIso,
      },
      { onConflict: "user_id,lesson_id" },
    )
    .select("id,key_points,practical_tips,locale,created_at,updated_at")
    .single<ExistingSummary>();
  if (error) throw new Error(error.message);
  return data;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    if (!cors) return json({ message: "Origin not allowed" }, 403);
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (req.method !== "POST") return withCors(req, json({ message: "Method not allowed" }, 405));

    const db = createServiceClient();
    const user = await verifyBearerUser(req, db);
    const { lessonId, courseId, locale: requestedLocale, force } = parseBody(
      (await req.json().catch(() => ({}))) as RequestBody,
    );

    if (!force) {
      const existing = await loadExistingSummary(db, user.id, lessonId);
      if (existing) {
        return withCors(
          req,
          json({
            cached: true,
            summary: {
              id: existing.id,
              keyPoints: normalizeStringList(existing.key_points, 5),
              practicalTips: normalizeStringList(existing.practical_tips, 3),
              locale: existing.locale,
              createdAt: existing.created_at,
              updatedAt: existing.updated_at,
            },
          }),
        );
      }
    }

    const lesson = await loadLesson(db, courseId, lessonId);
    if (!lesson) {
      return withCors(req, json({ message: "Không tìm thấy bài học." }, 404));
    }

    const source = buildLessonSourceText(lesson);
    if (source.sourceKinds.length === 0) {
      return withCors(
        req,
        json({ message: "Bài học chưa có nội dung văn bản để tóm tắt." }, 422),
      );
    }

    const haystack = `${source.shortDescription}\n${source.markdownDescription}`;
    const locale: Locale = requestedLocale || detectLocaleFromContent(haystack);

    const { system, user: userPrompt } = buildPrompt(source, locale);
    const { summary, model } = await generateSummaryWithOpenAi(system, userPrompt);

    const saved = await upsertSummary(db, {
      userId: user.id,
      courseId,
      lessonId,
      locale,
      summary,
      sourceKinds: source.sourceKinds,
      model,
    });

    return withCors(
      req,
      json({
        cached: false,
        summary: {
          id: saved.id,
          keyPoints: summary.keyPoints,
          practicalTips: summary.practicalTips,
          locale,
          createdAt: saved.created_at,
          updatedAt: saved.updated_at,
        },
      }),
    );
  } catch (error) {
    console.error("[generate-lesson-summary]", error);
    const message = error instanceof Error ? error.message : "Không thể tóm tắt bài học lúc này.";
    const status = /Missing Authorization|Invalid or expired|Email confirmation/.test(message)
      ? 401
      : /Thiếu|Missing|hợp lệ/.test(message)
        ? 400
        : /Không tìm thấy/.test(message)
          ? 404
          : /chưa có nội dung/.test(message)
            ? 422
            : 500;
    return withCors(req, json({ message }, status));
  }
});
