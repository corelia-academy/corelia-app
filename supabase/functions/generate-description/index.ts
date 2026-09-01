import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Role = "student" | "instructor" | "support_staff" | "admin";
type Locale = "vi" | "en";
type GenerateType = "course" | "lesson";
type ActionType = "generate" | "translate";
type TargetField =
  | "title"
  | "short_description"
  | "description"
  | "description_markdown"
  | "learning_outcomes";
type SourceKind = "short_description" | "description_markdown" | "transcript";
type BundleKind = "course_info" | "section" | "lesson" | "assignment";

type RequestBody = {
  action?: unknown;
  type?: unknown;
  targetField?: unknown;
  intent?: unknown;
  locale?: unknown;
  sourceLocale?: unknown;
  sourceInputs?: unknown;
  bundleKind?: unknown;
  sourceBundle?: unknown;
  careerTrackId?: unknown;
  courseId?: unknown;
  sectionId?: unknown;
  lessonId?: unknown;
  youtubeUrl?: unknown;
  lessonTitle?: unknown;
};

type CourseRow = {
  instructor_id: string;
  data: Record<string, unknown> | null;
};

type CareerTrackRow = {
  instructor_id: string;
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

type SourceInput = {
  id?: unknown;
  title?: unknown;
  lessonTitle?: unknown;
  shortDescription?: unknown;
  markdownDescription?: unknown;
  transcript?: unknown;
  youtubeUrl?: unknown;
};

type TranslationBundle = {
  title?: string;
  shortDescription?: string;
  description?: string;
  markdownDescription?: string;
  learningOutcomes?: string[];
  instructions?: string;
};

const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-secret-key, x-supabase-api-version";

class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

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
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
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
  const secretKeysRaw = readOptionalEnv("SUPABASE_SECRET_KEYS");
  if (!secretKeysRaw) {
    throw new Error("Missing env: SUPABASE_SECRET_KEYS");
  }
  if (secretKeysRaw.startsWith("sb_secret_")) return secretKeysRaw;
  const parsed = JSON.parse(secretKeysRaw) as Record<string, unknown>;
  const directDefault = parsed.default;
  if (typeof directDefault === "string" && directDefault.trim()) return directDefault.trim();
  for (const value of Object.values(parsed)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new Error("Invalid env: SUPABASE_SECRET_KEYS");
}

function createServiceClient(): SupabaseClient {
  const url = requireAnyEnv("SUPABASE_URL");
  const key = readSupabaseSecretKey();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function verifyBearerUser(req: Request, db: SupabaseClient): Promise<User> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) throw new HttpStatusError(401, "Missing Authorization header");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpStatusError(401, "Invalid Authorization header");
  const { data, error } = await db.auth.getUser(match[1]!);
  if (error || !data.user) throw new HttpStatusError(401, "Invalid or expired session");
  if (!data.user.email_confirmed_at) {
    throw new HttpStatusError(401, "Email confirmation required");
  }
  return data.user;
}

function parseBody(body: RequestBody): {
  action: ActionType;
  type: GenerateType;
  targetField: TargetField;
  intent: "practice" | null;
  locale: Locale;
  sourceLocale: Locale | null;
  sourceInputs: SourceInput[] | null;
  bundleKind: BundleKind | null;
  sourceBundle: TranslationBundle | null;
  careerTrackId: string | null;
  courseId: string | null;
  sectionId: string | null;
  lessonId: string | null;
  youtubeUrl: string | null;
  lessonTitle: string | null;
} {
  const action =
    body.action === "translate"
      ? "translate"
      : body.action === "generate" || body.action == null
        ? "generate"
        : null;
  const type = body.type === "lesson" ? "lesson" : body.type === "course" ? "course" : null;
  const targetField =
    body.targetField === "title" ||
    body.targetField === "short_description" ||
    body.targetField === "description" ||
    body.targetField === "description_markdown" ||
    body.targetField === "learning_outcomes"
      ? body.targetField
      : null;
  const intent = body.intent === "practice" ? "practice" : null;
  const locale = body.locale === "en" ? "en" : body.locale === "vi" ? "vi" : null;
  const sourceLocale =
    body.sourceLocale === "en" ? "en" : body.sourceLocale === "vi" ? "vi" : null;
  const sourceInputs = Array.isArray(body.sourceInputs) ? (body.sourceInputs as SourceInput[]) : null;
  const bundleKind =
    body.bundleKind === "course_info" ||
    body.bundleKind === "section" ||
    body.bundleKind === "lesson" ||
    body.bundleKind === "assignment"
      ? body.bundleKind
      : null;
  const sourceBundle = parseTranslationBundle(body.sourceBundle);
  const careerTrackId = parseOptionalResourceId(body.careerTrackId, "careerTrackId");
  const courseId = typeof body.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;
  const sectionId = typeof body.sectionId === "string" && body.sectionId.trim() ? body.sectionId.trim() : null;
  const lessonId = typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
  const youtubeUrl =
    typeof body.youtubeUrl === "string" && body.youtubeUrl.trim() ? body.youtubeUrl.trim() : null;
  const lessonTitle =
    typeof body.lessonTitle === "string" && body.lessonTitle.trim() ? body.lessonTitle.trim() : null;
  if (!action || !type || !targetField || !locale) {
    throw new Error("Thiếu action, type, targetField hoặc locale hợp lệ.");
  }
  if (careerTrackId) {
    if (body.courseId != null) {
      throw new Error("Không được gửi đồng thời courseId và careerTrackId.");
    }
    const isCareerTrackTranslation =
      action === "translate" &&
      type === "course" &&
      targetField === "description" &&
      bundleKind === "course_info";
    const hasCourseResourceInputs =
      body.sectionId != null ||
      body.lessonId != null ||
      body.youtubeUrl != null ||
      body.lessonTitle != null ||
      body.intent != null ||
      body.sourceInputs != null;
    if (!isCareerTrackTranslation || hasCourseResourceInputs) {
      throw new Error("careerTrackId chỉ hợp lệ cho luồng dịch toàn bộ Career Track.");
    }
  }
  return {
    action,
    type,
    targetField,
    intent,
    locale,
    sourceLocale,
    sourceInputs,
    bundleKind,
    sourceBundle,
    careerTrackId,
    courseId,
    sectionId,
    lessonId,
    youtubeUrl,
    lessonTitle,
  };
}

function parseOptionalResourceId(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return value.trim();
}

function parseTranslationBundle(value: unknown): TranslationBundle | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const text = (key: keyof TranslationBundle): string | undefined => {
    const raw = input[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };
  const learningOutcomes = Array.isArray(input.learningOutcomes)
    ? input.learningOutcomes
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : undefined;
  const out: TranslationBundle = {
    title: text("title"),
    shortDescription: text("shortDescription"),
    description: text("description"),
    markdownDescription: text("markdownDescription"),
    instructions: text("instructions"),
  };
  if (learningOutcomes?.length) out.learningOutcomes = learningOutcomes;
  return Object.values(out).some((item) => (Array.isArray(item) ? item.length > 0 : Boolean(item)))
    ? out
    : null;
}

function normalizeYoutubeVideoId(value: string): string | null {
  const trimmed = value.trim();
  const direct = trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
  if (direct) return trimmed;
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
  const text = parts.find((part) => (part?.trim().length ?? 0) > 0)?.trim();
  if (!text) return undefined;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

type CaptionTrack = { langCode: string; name: string; isAsr: boolean; baseUrl?: string };

async function fetchCaptionTracksViaInnerTube(videoId: string): Promise<CaptionTrack[]> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: "WEB", clientVersion: "2.20231208.00.00", hl: "en" } },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json() as Record<string, unknown>;
    const rawTracks = (
      (data?.captions as Record<string, unknown>)
        ?.playerCaptionsTracklistRenderer as Record<string, unknown>
    )?.captionTracks as Record<string, unknown>[] ?? [];
    return rawTracks
      .map((t) => ({
        langCode: String(t.languageCode ?? ""),
        name: String((t.name as { simpleText?: string } | undefined)?.simpleText ?? ""),
        isAsr: t.kind === "asr",
        baseUrl: String(t.baseUrl ?? ""),
      }))
      .filter((t) => t.langCode && t.baseUrl);
  } catch {
    return [];
  }
}

async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  try {
    const url = new URL("https://www.youtube.com/api/timedtext");
    url.searchParams.set("type", "list");
    url.searchParams.set("v", videoId);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = Array.from(
      xml.matchAll(/<track\b([^>]+?)\/>/g),
      (match) => match[1] ?? "",
    );
    return matches
      .map((attrs) => {
        const langCode = attrs.match(/\blang_code="([^"]+)"/)?.[1] ?? "";
        const name = decodeHtml(attrs.match(/\bname="([^"]*)"/)?.[1] ?? "");
        const kind = attrs.match(/\bkind="([^"]+)"/)?.[1] ?? "";
        return { langCode, name, isAsr: kind === "asr" };
      })
      .filter((track) => track.langCode);
  } catch {
    return [];
  }
}

function chooseCaptionTrack(tracks: CaptionTrack[], locale: Locale): CaptionTrack | null {
  const exact = tracks.filter((track) => track.langCode.toLowerCase() === locale);
  if (exact.length > 0) return exact.find((track) => !track.isAsr) ?? exact[0]!;
  const sameFamily = tracks.filter((track) => track.langCode.toLowerCase().startsWith(`${locale}-`));
  if (sameFamily.length > 0) return sameFamily.find((track) => !track.isAsr) ?? sameFamily[0]!;
  return tracks.find((track) => !track.isAsr) ?? tracks[0] ?? null;
}

function normalizeTranscriptText(text: string): string | null {
  const out = text.replace(/\s+/g, " ").trim();
  return out || null;
}

async function fetchTranscript(videoId: string, locale: Locale): Promise<string | null> {
  // 1. InnerTube API (primary — returns direct baseUrl per track)
  const innerTubeTracks = await fetchCaptionTracksViaInnerTube(videoId);
  const innerTubeTrack = chooseCaptionTrack(innerTubeTracks, locale);
  if (innerTubeTrack?.baseUrl) {
    try {
      const url = new URL(innerTubeTrack.baseUrl);
      url.searchParams.set("fmt", "json3");
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json() as { events?: Array<{ segs?: Array<{ utf8: string }> }> };
        const text = (json.events ?? [])
          .flatMap((e) => (e.segs ?? []).map((s) => s.utf8))
          .filter((s) => s && s.trim() !== "\n")
          .join(" ");
        const normalized = normalizeTranscriptText(text);
        if (normalized) return normalized.length > 12000 ? normalized.slice(0, 12000) : normalized;
      }
    } catch { /* fall through to timedtext */ }
  }

  // 2. Timedtext API (fallback)
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
  return text.length > 12000 ? text.slice(0, 12000) : text;
}

async function getUserRole(db: SupabaseClient, userId: string): Promise<Role> {
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).single();
  if (error || !data) throw new Error("Không thể kiểm tra quyền người dùng.");
  return (data as ProfileRow).role;
}

async function getCourseAccessRow(db: SupabaseClient, courseId: string): Promise<CourseRow> {
  const { data, error } = await db.from("courses").select("instructor_id,data").eq("id", courseId).maybeSingle();
  if (error) {
    console.error("[generate-description] db error in courses:", error);
    throw new Error("Không thể kết nối cơ sở dữ liệu.");
  }
  if (!data) throw new HttpStatusError(404, "Không tìm thấy khoá học.");
  return data as CourseRow;
}

async function ensureCanManageCourse(
  db: SupabaseClient,
  userId: string,
  role: Role,
  courseId: string,
): Promise<void> {
  const row = await getCourseAccessRow(db, courseId);
  if (role === "admin" || role === "support_staff") return;
  if (row.instructor_id === userId) return;
  const coInstructorPermissions =
    ((row.data ?? {}).co_instructor_permissions as Record<string, Record<string, boolean> | undefined> | undefined) ??
    {};
  if (coInstructorPermissions[userId]?.content) return;
  throw new Error("Bạn không có quyền generate mô tả cho khoá học này.");
}

async function ensureCanManageCareerTrack(
  db: SupabaseClient,
  userId: string,
  role: Role,
  careerTrackId: string,
): Promise<void> {
  const { data, error } = await db
    .from("career_tracks")
    .select("instructor_id")
    .eq("id", careerTrackId)
    .maybeSingle();
  if (error) {
    console.error("[generate-description] db error in career_tracks:", error);
    throw new Error("Không thể kết nối cơ sở dữ liệu.");
  }
  if (!data) throw new HttpStatusError(404, "Không tìm thấy lộ trình nghề nghiệp.");
  if (role === "admin" || role === "support_staff") return;
  const row = data as CareerTrackRow;
  if (row.instructor_id === userId) return;
  throw new Error("Bạn không có quyền dịch lộ trình nghề nghiệp này.");
}

async function resolveAndValidateCourseScope(
  db: SupabaseClient,
  params: {
    courseId: string | null;
    sectionId: string | null;
    lessonId: string | null;
    intent: "practice" | null;
    sourceInputs: SourceInput[] | null;
  },
): Promise<string> {
  let resolvedCourseId = params.courseId;
  let resolvedSectionId: string | null = null;

  if (params.sectionId) {
    const { data, error } = await db
      .from("course_sections")
      .select("course_id")
      .eq("id", params.sectionId)
      .maybeSingle();
    if (error) throw new Error(`Lỗi kết nối cơ sở dữ liệu: ${error.message}`);
    if (!data?.course_id) throw new HttpStatusError(404, "Không tìm thấy chương học.");
    const sectionCourseId = String(data.course_id);
    if (resolvedCourseId && resolvedCourseId !== sectionCourseId) {
      throw new Error("Chương học không thuộc khoá học đã yêu cầu.");
    }
    resolvedCourseId = sectionCourseId;
    resolvedSectionId = params.sectionId;
  }

  if (params.lessonId) {
    const { data, error } = await db
      .from("course_lessons")
      .select("course_id,section_id")
      .eq("id", params.lessonId)
      .maybeSingle();
    if (error) throw new Error(`Lỗi kết nối cơ sở dữ liệu: ${error.message}`);
    if (!data?.course_id) throw new HttpStatusError(404, "Không tìm thấy bài học.");
    const lessonCourseId = String(data.course_id);
    if (resolvedCourseId && resolvedCourseId !== lessonCourseId) {
      throw new Error("Bài học không thuộc khoá học đã yêu cầu.");
    }
    if (resolvedSectionId && String(data.section_id ?? "") !== resolvedSectionId) {
      throw new Error("Bài học không thuộc chương học đã yêu cầu.");
    }
    resolvedCourseId = lessonCourseId;
  }

  if (!resolvedCourseId) throw new Error("Không xác định được phạm vi khoá học.");

  if (params.intent === "practice" && params.sourceInputs?.length) {
    const sourceLessonIds = Array.from(
      new Set(
        params.sourceInputs.map((source) =>
          typeof source.id === "string" && source.id.trim() ? source.id.trim() : "",
        ),
      ),
    );
    if (sourceLessonIds.includes("")) {
      throw new Error("Nguồn bài học không hợp lệ.");
    }
    const { data, error } = await db
      .from("course_lessons")
      .select("id,course_id")
      .in("id", sourceLessonIds);
    if (error) throw new Error("Không thể kiểm tra nguồn bài học.");
    const rows = (data ?? []) as Array<{ id: string; course_id: string }>;
    if (rows.length !== sourceLessonIds.length) {
      throw new HttpStatusError(404, "Một hoặc nhiều bài học nguồn không tìm thấy.");
    }
    if (rows.some((row) => String(row.course_id) !== resolvedCourseId)) {
      throw new Error("Nguồn bài học không thuộc khoá học đã yêu cầu.");
    }
  }

  return resolvedCourseId;
}

async function resolveLessonRows(
  db: SupabaseClient,
  params: {
    courseId: string | null;
    sectionId: string | null;
    lessonId: string | null;
  },
): Promise<LessonRow[]> {
  if (params.lessonId) {
    const query = db
      .from("course_lessons")
      .select("id,course_id,section_id,data")
      .eq("id", params.lessonId);
    if (params.courseId) query.eq("course_id", params.courseId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Lỗi kết nối cơ sở dữ liệu: ${error.message}`);
    if (!data) throw new HttpStatusError(404, "Không tìm thấy bài học.");
    return [data as LessonRow];
  }
  if (params.sectionId) {
    const query = db
      .from("course_lessons")
      .select("id,course_id,section_id,data")
      .eq("section_id", params.sectionId)
      .order("sort_order", { ascending: true });
    if (params.courseId) query.eq("course_id", params.courseId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as LessonRow[];
  }
  if (!params.courseId) return [];
  const { data, error } = await db
    .from("course_lessons")
    .select("id,course_id,section_id,data")
    .eq("course_id", params.courseId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LessonRow[];
}

async function buildLessonSources(
  rows: LessonRow[],
  locale: Locale,
  options?: { forceTranscript?: boolean; youtubeUrlOverride?: string | null },
): Promise<LessonSource[]> {
  const sources: LessonSource[] = [];
  for (const row of rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    const shortDescription = String(data.short_description ?? "").trim();
    const markdownDescription = String(data.description_markdown ?? "").trim();
    const youtubeUrl =
      options?.youtubeUrlOverride ?? (typeof data.youtube_url === "string" ? data.youtube_url.trim() : "");
    const sourceKinds: SourceKind[] = [];
    if (shortDescription) sourceKinds.push("short_description");
    if (markdownDescription) sourceKinds.push("description_markdown");

    let transcript: string | undefined;
    const needsTranscript =
      options?.forceTranscript ||
      sourceKinds.length === 0 ||
      (shortDescription.length + markdownDescription.length < 180 && !!youtubeUrl);
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

async function buildProvidedSources(
  inputs: SourceInput[],
  locale: Locale,
): Promise<LessonSource[]> {
  const sources: LessonSource[] = [];
  for (const [index, raw] of inputs.entries()) {
    const shortDescription = String(raw.shortDescription ?? "").trim();
    const markdownDescription = String(raw.markdownDescription ?? "").trim();
    const transcriptInput = String(raw.transcript ?? "").trim();
    const youtubeUrl = String(raw.youtubeUrl ?? "").trim();
    const sourceKinds: SourceKind[] = [];
    if (shortDescription) sourceKinds.push("short_description");
    if (markdownDescription) sourceKinds.push("description_markdown");
    if (transcriptInput) sourceKinds.push("transcript");

    let transcript = transcriptInput || undefined;
    const needsTranscript =
      sourceKinds.length === 0 ||
      (shortDescription.length + markdownDescription.length < 180 && !!youtubeUrl && !transcript);
    if (needsTranscript && youtubeUrl) {
      const videoId = normalizeYoutubeVideoId(youtubeUrl);
      if (videoId) {
        transcript = (await fetchTranscript(videoId, locale)) ?? undefined;
        if (transcript) sourceKinds.push("transcript");
      }
    }

    const title = String(raw.title ?? raw.lessonTitle ?? "").trim() || `Source ${index + 1}`;

    sources.push({
      lessonId: String(raw.id ?? `source-${index + 1}`),
      lessonTitle: title,
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

function buildWarning(sources: LessonSource[]): string | null {
  const usable = sources.filter((source) => source.sourceKinds.length > 0);
  const totalChars = usable.reduce(
    (sum, source) =>
      sum +
      (source.shortDescription?.length ?? 0) +
      (source.markdownDescription?.length ?? 0) +
      (source.transcript?.length ?? 0),
    0,
  );
  if (usable.length === 0) {
    return "Hãy kiểm tra đủ nội dung để generate mô tả chất lượng.";
  }
  if (usable.length < 2 || totalChars < 300) {
    return "Nội dung nguồn hiện còn ít. Hãy kiểm tra đủ nội dung để generate mô tả chất lượng.";
  }
  return null;
}

function buildPrompt(params: {
  action: ActionType;
  type: GenerateType;
  targetField: TargetField;
  intent: "practice" | null;
  locale: Locale;
  sourceLocale: Locale | null;
  sources: LessonSource[];
  isSectionScoped: boolean;
}): string {
  const localeInstruction =
    params.locale === "vi"
      ? "Viết hoàn toàn bằng tiếng Việt, tự nhiên, rõ ràng, không quảng cáo quá mức."
      : "Write entirely in English, clear and natural, without hype.";
  const targetInstruction =
    params.action === "translate"
      ? params.targetField === "title"
        ? params.locale === "vi"
          ? "Dịch và biên tập thành một tiêu đề ngắn, tự nhiên, giữ đúng nghĩa."
          : "Translate and polish into a short, natural title that preserves the meaning."
        : params.targetField === "learning_outcomes"
          ? params.locale === "vi"
            ? "Dịch thành danh sách kết quả học tập, mỗi dòng là một ý ngắn, không bullet marker."
            : "Translate into a list of learning outcomes, one short outcome per line, no bullet markers."
          : params.targetField === "short_description"
        ? params.locale === "vi"
          ? "Dịch và biên tập thành mô tả ngắn 1-2 câu, tự nhiên, không dịch từng chữ."
          : "Translate and polish into a natural 1-2 sentence short description, not word-for-word."
        : params.targetField === "description_markdown"
          ? params.locale === "vi"
            ? "Dịch sang Markdown tự nhiên, giữ cấu trúc hữu ích và biên tập cho mượt."
            : "Translate into natural Markdown, preserving useful structure and polishing the writing."
          : params.locale === "vi"
            ? "Dịch và biên tập thành mô tả đầy đủ, rõ ý, tự nhiên."
            : "Translate and polish into a clear, natural full description."
      : params.targetField === "title"
        ? params.intent === "practice"
          ? params.locale === "vi"
            ? "Kết quả là một tiêu đề bài thực hành ngắn, cụ thể, tự nhiên, không thêm dấu ngoặc kép."
            : "Return one short, specific, natural practice activity title, without quotation marks."
          : params.locale === "vi"
            ? "Kết quả là một tiêu đề bài học ngắn, tự nhiên, không thêm dấu ngoặc kép."
            : "Return one short, natural lesson title, without quotation marks."
      : params.intent === "practice" && params.targetField === "description_markdown"
        ? params.locale === "vi"
          ? "Kết quả là bài thực hành dạng Markdown: nêu bối cảnh/ngữ cảnh ngắn, yêu cầu cụ thể, tiêu chí hoàn thành và gợi ý nếu hữu ích. Không viết như mô tả marketing."
          : "Return a Markdown practice activity: brief context, concrete task requirements, completion criteria, and hints if useful. Do not write marketing copy."
      : params.targetField === "short_description"
      ? params.locale === "vi"
        ? "Kết quả là mô tả ngắn 1-2 câu, súc tích, không bullet."
        : "Return a concise short description in 1-2 sentences, no bullets."
      : params.targetField === "description_markdown"
        ? params.locale === "vi"
          ? "Kết quả là mô tả chi tiết dạng Markdown cho bài học, có thể dùng đoạn văn ngắn và bullet nếu hợp lý."
          : "Return a detailed Markdown lesson description, using short paragraphs and bullets when useful."
        : params.isSectionScoped
          ? params.locale === "vi"
            ? "Kết quả là mô tả chương ngắn gọn, tóm tắt các bài học bên trong."
            : "Return a concise section description summarizing the lessons inside."
          : params.locale === "vi"
            ? "Kết quả là mô tả khoá học rõ ràng, giàu thông tin."
            : "Return a clear, informative course description.";
  const framing =
    params.action === "translate"
      ? params.locale === "vi"
        ? `Bạn đang dịch nội dung giáo dục từ ${params.sourceLocale === "en" ? "tiếng Anh" : "tiếng Việt"} sang tiếng Việt.`
        : `You are translating educational content from ${params.sourceLocale === "vi" ? "Vietnamese" : "English"} into English.`
      : params.intent === "practice"
      ? params.locale === "vi"
        ? "Bạn đang tạo một bài thực hành dựa trên các bài học nguồn đã chọn."
        : "You are creating a practice activity from the selected source lessons."
      : params.type === "lesson"
      ? params.locale === "vi"
        ? "Bạn đang viết mô tả cho một bài học dựa trên transcript video YouTube và nội dung hiện có."
        : "You are writing a lesson description from the YouTube transcript and any existing lesson copy."
      : params.isSectionScoped
        ? params.locale === "vi"
          ? "Bạn đang viết mô tả cho một chương dựa trên các bài học bên trong."
          : "You are writing a section description from the lessons inside it."
        : params.locale === "vi"
          ? "Bạn đang viết mô tả cho một khoá học dựa trên các bài học bên trong."
          : "You are writing a course description from the lessons inside it.";

  const sourceText = params.sources
    .map((source, index) => {
      const parts = [
        `Source ${index + 1}: ${source.lessonTitle}`,
        source.shortDescription ? `Short description: ${source.shortDescription}` : null,
        source.markdownDescription ? `Long description: ${source.markdownDescription}` : null,
        source.transcript ? `Transcript excerpt: ${source.transcript}` : null,
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n");

  return [
    framing,
    localeInstruction,
    targetInstruction,
    params.locale === "vi"
      ? "Chỉ trả về nội dung cuối cùng, không thêm lời dẫn, không giải thích."
      : "Return only the final content, with no preface or explanation.",
    sourceText,
  ].join("\n\n");
}

function bundleFieldInstruction(kind: BundleKind, locale: Locale): string {
  const common =
    locale === "vi"
      ? "Dịch tự nhiên, rõ ràng, giữ ý nghĩa giáo dục, không dịch từng chữ."
      : "Translate naturally and clearly, preserving the educational meaning without word-for-word phrasing.";
  if (kind === "course_info") {
    return `${common} Return JSON with keys: title, shortDescription, description, learningOutcomes. learningOutcomes must be an array of short strings.`;
  }
  if (kind === "section") {
    return `${common} Return JSON with keys: title, description.`;
  }
  if (kind === "lesson") {
    return `${common} Return JSON with keys: title, shortDescription, markdownDescription. Preserve useful Markdown structure in markdownDescription.`;
  }
  return `${common} Return JSON with keys: title, description, instructions.`;
}

function buildBundlePrompt(params: {
  kind: BundleKind;
  locale: Locale;
  sourceLocale: Locale | null;
  sourceBundle: TranslationBundle;
}): string {
  const localeInstruction =
    params.locale === "vi"
      ? "Viết hoàn toàn bằng tiếng Việt."
      : "Write entirely in English.";
  const framing =
    params.locale === "vi"
      ? `Bạn đang dịch nội dung khoá học từ ${params.sourceLocale === "en" ? "tiếng Anh" : "tiếng Việt"} sang tiếng Việt.`
      : `You are translating course content from ${params.sourceLocale === "vi" ? "Vietnamese" : "English"} into English.`;
  return [
    framing,
    localeInstruction,
    bundleFieldInstruction(params.kind, params.locale),
    "Return only valid JSON. Do not include Markdown fences, preface, or explanation.",
    `Source JSON:\n${JSON.stringify(params.sourceBundle, null, 2)}`,
  ].join("\n\n");
}

async function generateWithOpenAi(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) throw new Error("Missing env: OPENAI_API_KEY");
  const model = Deno.env.get("CORELIA_OPENAI_DESCRIPTION_MODEL")?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[generate-description] openai", response.status, errorText);
    throw new Error("OpenAI chưa phản hồi được mô tả.");
  }
  const payload = (await response.json()) as OpenAiResponsesPayload;
  const { text, debug } = extractResponseText(payload);
  if (!text) {
    console.error("[generate-description] openai empty_output", debug);
    throw new Error("OpenAI trả về mô tả rỗng.");
  }
  return text;
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1));
    }
    throw new Error("OpenAI trả về JSON không hợp lệ.");
  }
}

function validateBundle(kind: BundleKind, value: unknown): TranslationBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OpenAI trả về bản dịch không hợp lệ.");
  }
  const input = value as Record<string, unknown>;
  const readString = (key: string): string => {
    const raw = input[key];
    return typeof raw === "string" ? raw.trim() : "";
  };
  const bundle: TranslationBundle = {};
  if (kind === "course_info") {
    bundle.title = readString("title");
    bundle.shortDescription = readString("shortDescription");
    bundle.description = readString("description");
    bundle.learningOutcomes = Array.isArray(input.learningOutcomes)
      ? input.learningOutcomes
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];
    if (!bundle.title && !bundle.shortDescription && !bundle.description && !bundle.learningOutcomes.length) {
      throw new Error("OpenAI trả về bản dịch rỗng.");
    }
    return bundle;
  }
  if (kind === "section") {
    bundle.title = readString("title");
    bundle.description = readString("description");
    if (!bundle.title && !bundle.description) throw new Error("OpenAI trả về bản dịch rỗng.");
    return bundle;
  }
  if (kind === "lesson") {
    bundle.title = readString("title");
    bundle.shortDescription = readString("shortDescription");
    bundle.markdownDescription = readString("markdownDescription");
    if (!bundle.title && !bundle.shortDescription && !bundle.markdownDescription) {
      throw new Error("OpenAI trả về bản dịch rỗng.");
    }
    return bundle;
  }
  bundle.title = readString("title");
  bundle.description = readString("description");
  bundle.instructions = readString("instructions");
  if (!bundle.title && !bundle.description && !bundle.instructions) {
    throw new Error("OpenAI trả về bản dịch rỗng.");
  }
  return bundle;
}

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

function normalizeModelText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text || null;
}

function summarizeResponsePayload(payload: OpenAiResponsesPayload): Record<string, unknown> {
  const outputs = Array.isArray(payload.output) ? payload.output : [];
  return {
    hasOutputText: Boolean(payload.output_text?.trim()),
    outputCount: outputs.length,
    outputTypes: outputs.map((item) => item?.type ?? "unknown").slice(0, 6),
    contentTypes: outputs
      .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
      .map((item) => item?.type ?? "unknown")
      .slice(0, 10),
    hasRefusal: outputs.some((item) =>
      (Array.isArray(item?.content) ? item.content : []).some((content) =>
        typeof content?.refusal === "string" && content.refusal.trim().length > 0
      )
    ),
  };
}

function extractResponseText(payload: OpenAiResponsesPayload): {
  text: string | null;
  debug: Record<string, unknown>;
} {
  const topLevelText = normalizeModelText(payload.output_text);
  if (topLevelText) {
    return {
      text: topLevelText,
      debug: {
        source: "output_text",
        ...summarizeResponsePayload(payload),
      },
    };
  }

  const outputs = Array.isArray(payload.output) ? payload.output : [];
  const contentText = outputs
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((item) => normalizeModelText(item?.text))
    .filter((item): item is string => Boolean(item))
    .join("\n")
    .trim();

  if (contentText) {
    return {
      text: contentText,
      debug: {
        source: "output.content.text",
        ...summarizeResponsePayload(payload),
      },
    };
  }

  return {
    text: null,
    debug: {
      source: "empty",
      ...summarizeResponsePayload(payload),
    },
  };
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new HttpStatusError(400, "Payload JSON không hợp lệ.");
    }
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      throw new HttpStatusError(400, "Payload JSON phải là một object.");
    }
    const parsed = parseBody(rawBody as RequestBody);
    const normalizedYoutubeVideoId = parsed.youtubeUrl ? normalizeYoutubeVideoId(parsed.youtubeUrl) : null;

    let guardCourseId: string | null = null;
    if (parsed.careerTrackId) {
      await ensureCanManageCareerTrack(db, user.id, role, parsed.careerTrackId);
    } else {
      guardCourseId = await resolveAndValidateCourseScope(db, parsed);
      await ensureCanManageCourse(db, user.id, role, guardCourseId);
    }

    if (parsed.action === "translate" && parsed.bundleKind) {
      if (!parsed.sourceBundle) {
        return withCors(req, json({ message: "Không đủ nội dung nguồn để dịch." }, 422));
      }
      const prompt = buildBundlePrompt({
        kind: parsed.bundleKind,
        locale: parsed.locale,
        sourceLocale: parsed.sourceLocale,
        sourceBundle: parsed.sourceBundle,
      });
      const raw = await generateWithOpenAi(prompt);
      const bundle = validateBundle(parsed.bundleKind, parseModelJson(raw));
      const sourceTitle = parsed.sourceLocale
        ? `Source ${parsed.sourceLocale.toUpperCase()}`
        : "Source content";
      return withCors(
        req,
        json({
          description: JSON.stringify(bundle),
          bundle,
          sources: [
            {
              lessonId: `${parsed.bundleKind}-source`,
              lessonTitle: sourceTitle,
              sourceKinds: ["description_markdown"],
              snippet: JSON.stringify(parsed.sourceBundle).slice(0, 180),
            },
          ],
          warning: null,
        }),
      );
    }

    let rows: LessonRow[] = [];
    let isSectionScoped = false;
    const hasProvidedSources =
      (parsed.action === "translate" || parsed.intent === "practice") &&
      (parsed.sourceInputs?.length ?? 0) > 0;

    if (hasProvidedSources) {
      isSectionScoped = Boolean(parsed.sectionId);
    } else if (parsed.lessonId) {
      rows = await resolveLessonRows(db, parsed);
    } else if (parsed.type === "lesson" && parsed.courseId && !parsed.sectionId && normalizedYoutubeVideoId) {
      // New/unsaved lesson (no lessonId) within a known course — treat as single draft row
      // so youtubeUrlOverride applies and permissions are still validated.
      rows = [
        {
          id: "draft",
          course_id: parsed.courseId,
          section_id: "",
          data: { title: parsed.lessonTitle ?? "Draft lesson", youtube_url: parsed.youtubeUrl },
        },
      ];
    } else if (parsed.courseId || parsed.sectionId) {
      rows = await resolveLessonRows(db, {
        courseId: String(guardCourseId),
        sectionId: parsed.sectionId,
        lessonId: null,
      });
      isSectionScoped = Boolean(parsed.sectionId);
    } else if (parsed.type === "lesson" && normalizedYoutubeVideoId) {
      rows = [
        {
          id: "draft",
          course_id: "",
          section_id: "",
          data: {
            title: "Draft lesson",
            youtube_url: parsed.youtubeUrl,
          },
        },
      ];
    } else {
      return withCors(
        req,
        json({ message: "Thiếu lessonId, courseId/sectionId hoặc youtubeUrl hợp lệ." }, 400),
      );
    }

    const sources = hasProvidedSources
      ? await buildProvidedSources(parsed.sourceInputs ?? [], parsed.locale)
      : await buildLessonSources(rows, parsed.locale, {
          forceTranscript:
            parsed.action === "generate" && parsed.type === "lesson" && !!normalizedYoutubeVideoId,
          youtubeUrlOverride:
            parsed.action === "generate" &&
            parsed.type === "lesson" &&
            rows.length === 1 &&
            parsed.youtubeUrl
              ? parsed.youtubeUrl
              : null,
        });
    const warning = buildWarning(sources);
    const usable = sources.filter((source) => source.sourceKinds.length > 0);
    const sourcesForPrompt = hasProvidedSources
      ? usable
      : (() => {
          const trivialTitles = ["lesson", "draft lesson"];
          const titledSources = sources.filter(
            (source) =>
              source.lessonTitle && !trivialTitles.includes(source.lessonTitle.toLowerCase()),
          );
          if (usable.length === 0 && titledSources.length === 0) {
            return null;
          }
          return usable.length > 0 ? usable : titledSources;
        })();
    if (!sourcesForPrompt) {
      return withCors(req, json({ message: warning ?? "Không đủ nội dung để generate." }, 422));
    }

    const prompt = buildPrompt({
      action: parsed.action,
      type: parsed.type,
      targetField: parsed.targetField,
      intent: parsed.intent,
      locale: parsed.locale,
      sourceLocale: parsed.sourceLocale,
      sources: sourcesForPrompt,
      isSectionScoped,
    });
    const description = await generateWithOpenAi(prompt);

    return withCors(
      req,
      json({
        description,
        sources: sourcesForPrompt.map((source) => ({
          lessonId: source.lessonId,
          lessonTitle: source.lessonTitle,
          sourceKinds: source.sourceKinds,
          snippet: source.snippet,
        })),
        warning,
      }),
    );
  } catch (error) {
    console.error("[generate-description]", error);
    const rawMessage =
      error instanceof Error ? error.message : "Không thể generate description lúc này.";
    const status = error instanceof HttpStatusError
      ? error.status
      : /không có quyền|permission/i.test(rawMessage)
        ? 403
        : /Không tìm thấy/i.test(rawMessage)
          ? 404
          : /Thiếu|Missing|hợp lệ|Không xác định|không thuộc/i.test(rawMessage)
            ? 400
            : /không đủ nội dung|rỗng/i.test(rawMessage)
              ? 422
              : 500;
    const message = status === 500 ? "Đã xảy ra lỗi hệ thống khi xử lý yêu cầu." : rawMessage;
    return withCors(req, json({ message }, status));
  }
});
