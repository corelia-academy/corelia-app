import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Role = "student" | "instructor" | "support_staff" | "admin";
type Locale = "vi" | "en";

type RequestBody = {
  courseId?: unknown;
  sectionId?: unknown;
  locale?: unknown;
  count?: unknown;
};

type CourseRow = {
  instructor_id: string;
  data: Record<string, unknown> | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  section_id: string;
  data: Record<string, unknown> | null;
};

type ProfileRow = {
  role: Role;
};

type SourceKind = "short_description" | "description_markdown" | "transcript";

type LessonSource = {
  lessonId: string;
  lessonTitle: string;
  shortDescription?: string;
  markdownDescription?: string;
  youtubeUrl?: string;
  transcript?: string;
  sourceKinds: SourceKind[];
  snippet?: string;
};

type GeneratedQuestion = {
  type: "mcq";
  question: string;
  options: Array<{ id: string; text: string }>;
  correct_index: number;
  explanation?: string;
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
  const allowedOrigins = allowedOriginsFromEnv();
  if (!allowedOrigins.has(normalized)) return null;
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
  const secretKeysRaw = readOptionalEnv("CORELIA_SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEYS");
  if (!secretKeysRaw) {
    throw new Error("Missing env: CORELIA_SUPABASE_SECRET_KEYS | SUPABASE_SECRET_KEYS");
  }
  if (secretKeysRaw.startsWith("sb_secret_")) return secretKeysRaw;
  const parsed = JSON.parse(secretKeysRaw) as Record<string, unknown>;
  const directDefault = parsed.default;
  if (typeof directDefault === "string" && directDefault.trim()) return directDefault.trim();
  for (const value of Object.values(parsed)) {
    if (typeof value === "string" && value.trim()) return value.trim();
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

async function getUserRole(db: SupabaseClient, userId: string): Promise<Role> {
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).single();
  if (error || !data) throw new Error("Không thể kiểm tra quyền người dùng.");
  return (data as ProfileRow).role;
}

async function ensureCanManageCourse(
  db: SupabaseClient,
  userId: string,
  role: Role,
  courseId: string,
): Promise<void> {
  if (role === "admin" || role === "support_staff") return;
  const { data, error } = await db
    .from("courses")
    .select("instructor_id,data")
    .eq("id", courseId)
    .single();
  if (error || !data) throw new Error("Không tìm thấy khoá học.");
  const row = data as CourseRow;
  if (row.instructor_id === userId) return;
  const coPerms =
    ((row.data ?? {}).co_instructor_permissions as Record<string, Record<string, boolean> | undefined> | undefined) ??
    {};
  if (coPerms[userId]?.content) return;
  throw new Error("Bạn không có quyền thực hiện thao tác này với khoá học.");
}

function parseBody(body: RequestBody): {
  courseId: string;
  sectionId: string;
  locale: Locale;
  count: number;
} {
  const courseId =
    typeof body.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;
  const sectionId =
    typeof body.sectionId === "string" && body.sectionId.trim() ? body.sectionId.trim() : null;
  const locale = body.locale === "en" ? "en" : "vi";
  const rawCount = typeof body.count === "number" ? body.count : parseInt(String(body.count ?? "5"), 10);
  const count = isNaN(rawCount) ? 5 : Math.min(10, Math.max(1, rawCount));
  if (!courseId) throw new Error("Thiếu courseId.");
  if (!sectionId) throw new Error("Thiếu sectionId.");
  return { courseId, sectionId, locale, count };
}

function normalizeYoutubeVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      const first = url.pathname.split("/").filter(Boolean)[0];
      return first && /^[a-zA-Z0-9_-]{11}$/.test(first) ? first : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    return embed?.[1] ?? null;
  } catch {
    return null;
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripAndNormalizeText(input: string): string {
  return decodeHtml(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSnippet(...parts: Array<string | undefined>): string | undefined {
  const text = parts.find((p) => (p?.trim().length ?? 0) > 0)?.trim();
  if (!text) return undefined;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

async function fetchCaptionTracks(
  videoId: string,
): Promise<Array<{ langCode: string; name: string; isAsr: boolean }>> {
  const url = new URL("https://www.youtube.com/api/timedtext");
  url.searchParams.set("type", "list");
  url.searchParams.set("v", videoId);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const xml = await res.text();
  const matches = Array.from(xml.matchAll(/<track\b([^>]+?)\/>/g), (m) => m[1] ?? "");
  return matches
    .map((attrs) => ({
      langCode: attrs.match(/\blang_code="([^"]+)"/)?.[1] ?? "",
      name: decodeHtml(attrs.match(/\bname="([^"]*)"/)?.[1] ?? ""),
      isAsr: attrs.match(/\bkind="([^"]+)"/)?.[1] === "asr",
    }))
    .filter((t) => t.langCode);
}

function chooseCaptionTrack(
  tracks: Array<{ langCode: string; name: string; isAsr: boolean }>,
  locale: Locale,
) {
  const exact = tracks.filter((t) => t.langCode.toLowerCase() === locale);
  if (exact.length > 0) return exact.find((t) => !t.isAsr) ?? exact[0];
  const family = tracks.filter((t) => t.langCode.toLowerCase().startsWith(`${locale}-`));
  if (family.length > 0) return family.find((t) => !t.isAsr) ?? family[0];
  return tracks.find((t) => !t.isAsr) ?? tracks[0] ?? null;
}

async function fetchTranscript(videoId: string, locale: Locale): Promise<string | null> {
  const tracks = await fetchCaptionTracks(videoId);
  const track = chooseCaptionTrack(tracks, locale);
  if (!track) return null;
  const url = new URL("https://www.youtube.com/api/timedtext");
  url.searchParams.set("v", videoId);
  url.searchParams.set("lang", track.langCode);
  if (track.name) url.searchParams.set("name", track.name);
  if (track.isAsr) url.searchParams.set("kind", "asr");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const xml = await res.text();
  const text = stripAndNormalizeText(xml);
  if (!text) return null;
  // Cap per-lesson transcript to 4000 chars (multiple lessons → avoid huge prompts)
  return text.length > 4000 ? text.slice(0, 4000) : text;
}

async function buildLessonSources(rows: LessonRow[], locale: Locale): Promise<LessonSource[]> {
  const sources: LessonSource[] = [];
  for (const row of rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    const shortDescription = String(data.short_description ?? "").trim();
    const markdownDescription = String(data.description_markdown ?? "").trim();
    const youtubeUrl = typeof data.youtube_url === "string" ? data.youtube_url.trim() : "";
    const sourceKinds: SourceKind[] = [];
    if (shortDescription) sourceKinds.push("short_description");
    if (markdownDescription) sourceKinds.push("description_markdown");

    let transcript: string | undefined;
    const needsTranscript =
      sourceKinds.length === 0 ||
      shortDescription.length + markdownDescription.length < 180;
    if (needsTranscript && youtubeUrl) {
      const videoId = normalizeYoutubeVideoId(youtubeUrl);
      if (videoId) {
        transcript = (await fetchTranscript(videoId, locale)) ?? undefined;
        if (transcript) sourceKinds.push("transcript");
      }
    }

    sources.push({
      lessonId: row.id,
      lessonTitle: String(data.title ?? "").trim() || "Lesson",
      shortDescription: shortDescription || undefined,
      markdownDescription: markdownDescription || undefined,
      youtubeUrl: youtubeUrl || undefined,
      transcript,
      sourceKinds,
      snippet: pickSnippet(shortDescription, markdownDescription, transcript),
    });
  }
  return sources;
}

function buildPrompt(sources: LessonSource[], locale: Locale, count: number): {
  system: string;
  user: string;
} {
  const langInstruction =
    locale === "vi"
      ? "Viết hoàn toàn bằng tiếng Việt, tự nhiên, dễ hiểu."
      : "Write entirely in English, clear and natural.";

  const system = `Bạn là giáo viên chuyên tạo câu hỏi trắc nghiệm cho khoá học online.
Nhiệm vụ: Tạo đúng ${count} câu hỏi MCQ từ nội dung bài học dưới đây.
Yêu cầu:
- Mỗi câu có đúng 4 lựa chọn với id "a", "b", "c", "d".
- Chỉ 1 lựa chọn đúng. correct_index là số nguyên 0-3 (0=a, 1=b, 2=c, 3=d).
- Độ khó: trung bình — học viên vừa xem xong video có thể trả lời nếu chú ý.
- Câu hỏi bám sát nội dung, không hỏi kiến thức ngoài phạm vi bài học.
- Mỗi câu có giải thích ngắn (1-2 câu) vì sao đáp án đúng.
- ${langInstruction}
- Chỉ trả về JSON theo đúng schema sau, không thêm bất kỳ nội dung nào khác:

{
  "questions": [
    {
      "type": "mcq",
      "question": "<câu hỏi>",
      "options": [
        { "id": "a", "text": "<lựa chọn A>" },
        { "id": "b", "text": "<lựa chọn B>" },
        { "id": "c", "text": "<lựa chọn C>" },
        { "id": "d", "text": "<lựa chọn D>" }
      ],
      "correct_index": 0,
      "explanation": "<giải thích>"
    }
  ]
}`;

  const sourceText = sources
    .map((s, i) => {
      const parts = [
        `--- Bài ${i + 1}: ${s.lessonTitle} ---`,
        s.shortDescription ? `Mô tả ngắn: ${s.shortDescription}` : null,
        s.markdownDescription ? `Nội dung chi tiết: ${s.markdownDescription}` : null,
        s.transcript ? `Transcript video: ${s.transcript}` : null,
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n");

  const user = `Nội dung chương học:\n\n${sourceText}\n\nHãy tạo đúng ${count} câu hỏi trắc nghiệm.`;

  return { system, user };
}

function validateAndNormalizeQuestions(raw: unknown): GeneratedQuestion[] {
  let list: unknown[];

  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.questions ?? obj.data ?? obj.items ?? obj.result;
    if (Array.isArray(candidate)) {
      list = candidate;
    } else {
      // single question object
      list = [raw];
    }
  } else {
    return [];
  }

  const OPTION_IDS = ["a", "b", "c", "d"];
  const out: GeneratedQuestion[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;

    const question = typeof q.question === "string" ? q.question.trim() : "";
    if (!question) continue;

    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions
      .slice(0, 4)
      .map((opt, idx) => {
        if (opt && typeof opt === "object") {
          const o = opt as Record<string, unknown>;
          return {
            id: typeof o.id === "string" ? o.id : OPTION_IDS[idx] ?? String(idx),
            text: typeof o.text === "string" ? o.text.trim() : "",
          };
        }
        return { id: OPTION_IDS[idx] ?? String(idx), text: String(opt ?? "").trim() };
      })
      .filter((o) => o.text);

    if (options.length < 2) continue;

    const rawIndex = typeof q.correct_index === "number" ? q.correct_index : 0;
    const correct_index = Math.max(0, Math.min(options.length - 1, Math.round(rawIndex)));

    const explanation = typeof q.explanation === "string" ? q.explanation.trim() : undefined;

    out.push({ type: "mcq", question, options, correct_index, explanation });
  }

  return out;
}

async function generateQuestionsWithOpenAi(
  system: string,
  user: string,
): Promise<GeneratedQuestion[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) throw new Error("Missing env: OPENAI_API_KEY");
  const model = Deno.env.get("CORELIA_OPENAI_QUESTIONS_MODEL")?.trim() || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[generate-questions] openai", response.status, errText);
    throw new Error("OpenAI chưa phản hồi được câu hỏi.");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("OpenAI trả về nội dung rỗng.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI trả về JSON không hợp lệ.");
  }

  const questions = validateAndNormalizeQuestions(parsed);
  if (questions.length === 0) throw new Error("Không thể parse câu hỏi từ phản hồi AI.");
  return questions;
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
    const role = await getUserRole(db, user.id);
    if (!["instructor", "support_staff", "admin"].includes(role)) {
      return withCors(req, json({ message: "Bạn không có quyền dùng tính năng này." }, 403));
    }

    const { courseId, sectionId, locale, count } = parseBody((await req.json()) as RequestBody);

    await ensureCanManageCourse(db, user.id, role, courseId);

    const { data: lessonData, error: lessonError } = await db
      .from("course_lessons")
      .select("id,course_id,section_id,data")
      .eq("course_id", courseId)
      .eq("section_id", sectionId)
      .order("sort_order", { ascending: true })
      .limit(8);

    if (lessonError) throw new Error(lessonError.message);
    const rows = (lessonData ?? []) as LessonRow[];

    if (rows.length === 0) {
      return withCors(req, json({ message: "Chương này chưa có bài học nào." }, 422));
    }

    const sources = await buildLessonSources(rows, locale);
    const usable = sources.filter((s) => s.sourceKinds.length > 0);

    if (usable.length === 0) {
      return withCors(
        req,
        json({ message: "Các bài học trong chương chưa có nội dung để generate câu hỏi." }, 422),
      );
    }

    const warning =
      rows.length > 8
        ? "Chỉ lấy nội dung từ 8 bài đầu tiên của chương."
        : usable.length < rows.length
          ? "Một số bài học chưa có nội dung và không được đưa vào."
          : null;

    const { system, user: userPrompt } = buildPrompt(usable, locale, count);
    const questions = await generateQuestionsWithOpenAi(system, userPrompt);

    return withCors(
      req,
      json({
        questions,
        sources: usable.map((s) => ({
          lessonId: s.lessonId,
          lessonTitle: s.lessonTitle,
          sourceKinds: s.sourceKinds,
          snippet: s.snippet,
        })),
        warning,
      }),
    );
  } catch (error) {
    console.error("[generate-questions]", error);
    const message =
      error instanceof Error ? error.message : "Không thể generate câu hỏi lúc này.";
    const status = /Missing Authorization|Invalid or expired|Email confirmation/.test(message)
      ? 401
      : /không có quyền/i.test(message)
        ? 403
        : /Thiếu|Missing|hợp lệ/.test(message)
          ? 400
          : /chưa có nội dung|chưa có bài/.test(message)
            ? 422
            : 500;
    return withCors(req, json({ message }, status));
  }
});
