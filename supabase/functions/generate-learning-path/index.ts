import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Locale = "vi" | "en";

type RequestBody = {
  goal?: unknown;
  locale?: unknown;
  force?: unknown;
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

function corsHeadersForRequest(req: Request): Headers | null {
  const origin = req.headers.get("origin")?.trim() ?? "";
  if (!origin) return null;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;
  const allowed = allowedOriginsFromEnv();
  if (!allowed.has(normalized)) return null;
  return new Headers({
    "Access-Control-Allow-Origin": normalized,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    Vary: "Origin",
  });
}

function withCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeadersForRequest(req);
  if (cors) for (const [k, v] of cors.entries()) headers.set(k, v);
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

function parseBody(body: RequestBody): { goal: string; locale: Locale | null; force: boolean } {
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 500) : "";
  const locale: Locale | null = body.locale === "en" ? "en" : body.locale === "vi" ? "vi" : null;
  const force = body.force === true;
  if (goal.length < 4) throw new Error("Thiếu goal hoặc goal quá ngắn.");
  return { goal, locale, force };
}

function detectLocaleFromContent(text: string): Locale {
  return /[à-ỹđ]/i.test(text) ? "vi" : "en";
}

// — Domain types —
type CandidateCourse = {
  id: string;
  slug: string | null;
  title: string;
  shortDescription: string;
  level: string;
  category: string;
  durationHours: number;
};
type CandidateTrack = {
  slug: string;
  title: string;
  description: string;
  courseCount: number;
};

type ProfileSnapshot = {
  user_level: string | null;
  track_interest: string | null;
  category_interests: string[];
  user_goal: string | null;
};

// — Catalog loaders —
async function loadProfile(db: SupabaseClient, userId: string): Promise<ProfileSnapshot> {
  const { data } = await db
    .from("profiles")
    .select("user_level,track_interest,category_interests,user_goal")
    .eq("id", userId)
    .maybeSingle<{
      user_level: string | null;
      track_interest: string | null;
      category_interests: string[] | null;
      user_goal: string | null;
    }>();
  return {
    user_level: data?.user_level ?? null,
    track_interest: data?.track_interest ?? null,
    category_interests: Array.isArray(data?.category_interests) ? data!.category_interests : [],
    user_goal: data?.user_goal ?? null,
  };
}

async function loadCandidateCourses(db: SupabaseClient): Promise<CandidateCourse[]> {
  const { data, error } = await db
    .from("courses")
    .select("id,slug,data")
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  const out: CandidateCourse[] = [];
  for (const row of data ?? []) {
    const d = (row.data ?? {}) as Record<string, unknown>;
    const title = String(d.title ?? "").trim();
    if (!title) continue;
    const short = String(d.short_description ?? "").trim().slice(0, 200);
    const level = String(d.level ?? "").trim() || "beginner";
    const category = String(d.primary_category ?? d.category ?? "").trim() || "general";
    const seconds = Number(d.total_duration_seconds ?? 0);
    const durationHours = Math.max(1, Math.round(seconds / 3600));
    out.push({
      id: String(row.id),
      slug: typeof row.slug === "string" ? row.slug : null,
      title,
      shortDescription: short,
      level,
      category,
      durationHours,
    });
    if (out.length >= 30) break;
  }
  return out;
}

async function loadCandidateTracks(db: SupabaseClient): Promise<CandidateTrack[]> {
  const { data, error } = await db
    .from("career_tracks")
    .select("slug,title,description")
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(15);
  if (error) throw new Error(error.message);
  const slugs = (data ?? [])
    .map((r) => (typeof r.slug === "string" ? r.slug : ""))
    .filter(Boolean);

  // Count courses per track (best-effort; falls back to 0 if junction table is absent).
  const counts = new Map<string, number>();
  if (slugs.length > 0) {
    const { data: courseLinks } = await db
      .from("career_track_courses")
      .select("track_slug")
      .in("track_slug", slugs);
    for (const row of courseLinks ?? []) {
      const k = String((row as { track_slug?: unknown }).track_slug ?? "");
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  return (data ?? [])
    .map((r) => ({
      slug: String(r.slug ?? "").trim(),
      title: String(r.title ?? "").trim(),
      description: String(r.description ?? "").trim().slice(0, 200),
      courseCount: counts.get(String(r.slug ?? "")) ?? 0,
    }))
    .filter((t) => t.slug && t.title);
}

// — Cache lookup —
type ExistingPathRow = {
  id: string;
  goal: string;
  locale: Locale;
  summary: string | null;
  estimated_weeks: number | null;
  milestones: unknown;
  recommended_courses: unknown;
  recommended_tracks: unknown;
  weekly_plan: unknown;
  created_at: string;
  updated_at: string;
};

async function loadExistingPath(
  db: SupabaseClient,
  userId: string,
  goal: string,
): Promise<ExistingPathRow | null> {
  const { data, error } = await db
    .from("learning_paths")
    .select(
      "id,goal,locale,summary,estimated_weeks,milestones,recommended_courses,recommended_tracks,weekly_plan,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("goal", goal)
    .maybeSingle<ExistingPathRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

// — Prompt building —
function buildPrompt(args: {
  goal: string;
  locale: Locale;
  profile: ProfileSnapshot;
  courses: CandidateCourse[];
  tracks: CandidateTrack[];
}): { system: string; user: string } {
  const { goal, locale, profile, courses, tracks } = args;
  const system =
    locale === "vi"
      ? `Bạn là Cora, gia sư AI của Corelia Academy. Nhiệm vụ: thiết kế MỘT lộ trình học cá nhân hóa cho học viên.

Quy tắc tuyệt đối:
- Chỉ chọn courses và career_tracks từ catalog dưới đây. KHÔNG bịa id/slug mới.
- Trả về JSON đúng schema, KHÔNG kèm văn bản ngoài.
- estimated_weeks phải hợp lý với mục tiêu (thường 8-32 tuần).
- 3-6 milestones, mỗi milestone 1 câu mô tả + số tuần.
- 3-6 courses đề xuất, mỗi cái có "reason" 1 câu.
- 0-2 tracks đề xuất nếu có track phù hợp.
- 4-8 entries trong weekly_plan đại diện chính (không cần đủ mọi tuần).
- summary: 1-2 câu tổng quan.
- Viết hoàn toàn bằng tiếng Việt.

Schema:
{
  "summary": "...",
  "estimated_weeks": 24,
  "milestones": [{"order": 1, "title": "...", "description": "...", "weeks": 2}],
  "recommended_courses": [{"id": "...", "reason": "...", "order": 1}],
  "recommended_tracks": [{"slug": "...", "reason": "...", "order": 1}],
  "weekly_plan": [{"week": 1, "focus": "...", "actions": ["..."]}]
}`
      : `You are Cora, the AI tutor for Corelia Academy. Task: design ONE personalized learning path for a learner.

Hard rules:
- Pick courses and career_tracks ONLY from the catalog below. Never fabricate ids/slugs.
- Return JSON matching the schema. Nothing else.
- estimated_weeks must be reasonable for the goal (typically 8-32 weeks).
- 3-6 milestones; each one short title + description + weeks.
- 3-6 recommended courses; each with a one-sentence "reason".
- 0-2 recommended tracks if any fit.
- 4-8 representative entries in weekly_plan (no need to cover every week).
- summary: 1-2 sentences.
- Write entirely in English.

Schema:
{
  "summary": "...",
  "estimated_weeks": 24,
  "milestones": [{"order": 1, "title": "...", "description": "...", "weeks": 2}],
  "recommended_courses": [{"id": "...", "reason": "...", "order": 1}],
  "recommended_tracks": [{"slug": "...", "reason": "...", "order": 1}],
  "weekly_plan": [{"week": 1, "focus": "...", "actions": ["..."]}]
}`;

  const profileLine = [
    `Level: ${profile.user_level ?? "unspecified"}`,
    `Track interest: ${profile.track_interest ?? "none"}`,
    profile.category_interests.length > 0
      ? `Interests: ${profile.category_interests.slice(0, 5).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const courseLines = courses
    .map(
      (c) =>
        `- id=${c.id} | "${c.title}" | level=${c.level} | ~${c.durationHours}h | ${c.category}\n  ${c.shortDescription}`,
    )
    .join("\n");
  const trackLines = tracks
    .map((t) => `- slug=${t.slug} | "${t.title}" | ${t.courseCount} courses\n  ${t.description}`)
    .join("\n");

  const userPrompt = [
    `Learner goal: ${goal}`,
    `Learner profile: ${profileLine}`,
    "",
    `Course catalog (${courses.length}):`,
    courseLines || "(none)",
    "",
    `Career track catalog (${tracks.length}):`,
    trackLines || "(none)",
  ].join("\n");

  return { system, user: userPrompt };
}

// — OpenAI call —
type OpenAiResponsesPayload = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
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

async function callOpenAi(
  system: string,
  userPrompt: string,
): Promise<{ raw: unknown; model: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) throw new Error("Missing env: OPENAI_API_KEY");
  const model =
    Deno.env.get("CORELIA_OPENAI_COMPLEX_MODEL")?.trim() ||
    Deno.env.get("CORELIA_OPENAI_DEFAULT_MODEL")?.trim() ||
    "gpt-4o";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: `${system}\n\n${userPrompt}` }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[generate-learning-path] openai", response.status, errText);
    throw new Error("OpenAI chưa phản hồi được lộ trình.");
  }
  const payload = (await response.json()) as OpenAiResponsesPayload;
  const text = extractResponseText(payload);
  if (!text) throw new Error("OpenAI trả về nội dung rỗng.");
  return { raw: parseModelJson(text), model };
}

// — Validation / enrichment —
type Milestone = { order: number; title: string; description: string; weeks: number };
type RecCourse = {
  id: string;
  slug: string | null;
  title: string;
  reason: string;
  order: number;
};
type RecTrack = { slug: string; title: string; reason: string; order: number };
type WeeklyItem = { week: number; focus: string; actions: string[] };

type ValidatedPath = {
  summary: string;
  estimated_weeks: number;
  milestones: Milestone[];
  recommended_courses: RecCourse[];
  recommended_tracks: RecTrack[];
  weekly_plan: WeeklyItem[];
};

function validatePath(
  raw: unknown,
  catalog: { courses: Map<string, CandidateCourse>; tracks: Map<string, CandidateTrack> },
): ValidatedPath {
  if (!raw || typeof raw !== "object") throw new Error("AI trả lộ trình không hợp lệ.");
  const obj = raw as Record<string, unknown>;

  const summary = typeof obj.summary === "string" ? obj.summary.trim().slice(0, 500) : "";
  const estimated_weeks =
    typeof obj.estimated_weeks === "number" && Number.isFinite(obj.estimated_weeks)
      ? Math.max(1, Math.min(104, Math.round(obj.estimated_weeks)))
      : 12;

  const milestones: Milestone[] = Array.isArray(obj.milestones)
    ? obj.milestones
        .map((m, i) => {
          if (!m || typeof m !== "object") return null;
          const r = m as Record<string, unknown>;
          const title = typeof r.title === "string" ? r.title.trim() : "";
          const description = typeof r.description === "string" ? r.description.trim() : "";
          const weeks =
            typeof r.weeks === "number" && Number.isFinite(r.weeks)
              ? Math.max(1, Math.min(52, Math.round(r.weeks)))
              : 1;
          if (!title) return null;
          return {
            order: typeof r.order === "number" ? r.order : i + 1,
            title: title.slice(0, 160),
            description: description.slice(0, 400),
            weeks,
          };
        })
        .filter((m): m is Milestone => Boolean(m))
        .slice(0, 8)
    : [];

  const recommended_courses: RecCourse[] = Array.isArray(obj.recommended_courses)
    ? obj.recommended_courses
        .map((c, i) => {
          if (!c || typeof c !== "object") return null;
          const r = c as Record<string, unknown>;
          const id = typeof r.id === "string" ? r.id.trim() : "";
          const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
          const match = catalog.courses.get(id);
          if (!match) return null;
          return {
            id,
            slug: match.slug,
            title: match.title,
            reason,
            order: typeof r.order === "number" ? r.order : i + 1,
          };
        })
        .filter((c): c is RecCourse => Boolean(c))
        .slice(0, 8)
    : [];

  const recommended_tracks: RecTrack[] = Array.isArray(obj.recommended_tracks)
    ? obj.recommended_tracks
        .map((t, i) => {
          if (!t || typeof t !== "object") return null;
          const r = t as Record<string, unknown>;
          const slug = typeof r.slug === "string" ? r.slug.trim() : "";
          const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
          const match = catalog.tracks.get(slug);
          if (!match) return null;
          return {
            slug,
            title: match.title,
            reason,
            order: typeof r.order === "number" ? r.order : i + 1,
          };
        })
        .filter((t): t is RecTrack => Boolean(t))
        .slice(0, 4)
    : [];

  const weekly_plan: WeeklyItem[] = Array.isArray(obj.weekly_plan)
    ? obj.weekly_plan
        .map((w, i) => {
          if (!w || typeof w !== "object") return null;
          const r = w as Record<string, unknown>;
          const week =
            typeof r.week === "number" && Number.isFinite(r.week)
              ? Math.max(1, Math.min(estimated_weeks, Math.round(r.week)))
              : i + 1;
          const focus = typeof r.focus === "string" ? r.focus.trim().slice(0, 200) : "";
          const actions = Array.isArray(r.actions)
            ? (r.actions as unknown[])
                .map((a) => (typeof a === "string" ? a.trim() : ""))
                .filter(Boolean)
                .slice(0, 5)
            : [];
          if (!focus && actions.length === 0) return null;
          return { week, focus, actions };
        })
        .filter((w): w is WeeklyItem => Boolean(w))
        .slice(0, 12)
    : [];

  if (recommended_courses.length === 0 && recommended_tracks.length === 0) {
    throw new Error("AI chưa chọn được course/track phù hợp với mục tiêu này.");
  }

  return { summary, estimated_weeks, milestones, recommended_courses, recommended_tracks, weekly_plan };
}

// — Upsert —
async function upsertPath(
  db: SupabaseClient,
  args: {
    userId: string;
    goal: string;
    userLevel: string | null;
    locale: Locale;
    model: string;
    path: ValidatedPath;
  },
): Promise<ExistingPathRow> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("learning_paths")
    .upsert(
      {
        user_id: args.userId,
        goal: args.goal,
        user_level: args.userLevel,
        locale: args.locale,
        summary: args.path.summary,
        estimated_weeks: args.path.estimated_weeks,
        milestones: args.path.milestones,
        recommended_courses: args.path.recommended_courses,
        recommended_tracks: args.path.recommended_tracks,
        weekly_plan: args.path.weekly_plan,
        model_used: args.model,
        updated_at: nowIso,
      },
      { onConflict: "user_id,goal" },
    )
    .select(
      "id,goal,locale,summary,estimated_weeks,milestones,recommended_courses,recommended_tracks,weekly_plan,created_at,updated_at",
    )
    .single<ExistingPathRow>();
  if (error) throw new Error(error.message);
  return data;
}

function serializePath(row: ExistingPathRow) {
  return {
    id: row.id,
    goal: row.goal,
    locale: row.locale,
    summary: row.summary,
    estimatedWeeks: row.estimated_weeks,
    milestones: Array.isArray(row.milestones) ? row.milestones : [],
    recommendedCourses: Array.isArray(row.recommended_courses) ? row.recommended_courses : [],
    recommendedTracks: Array.isArray(row.recommended_tracks) ? row.recommended_tracks : [],
    weeklyPlan: Array.isArray(row.weekly_plan) ? row.weekly_plan : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    const { goal, locale: requestedLocale, force } = parseBody(
      (await req.json().catch(() => ({}))) as RequestBody,
    );

    if (!force) {
      const existing = await loadExistingPath(db, user.id, goal);
      if (existing) {
        return withCors(req, json({ cached: true, path: serializePath(existing) }));
      }
    }

    const [profile, courses, tracks] = await Promise.all([
      loadProfile(db, user.id),
      loadCandidateCourses(db),
      loadCandidateTracks(db),
    ]);

    if (courses.length === 0 && tracks.length === 0) {
      return withCors(
        req,
        json({ message: "Catalog hiện trống, chưa thể dựng lộ trình." }, 422),
      );
    }

    const locale: Locale = requestedLocale ?? detectLocaleFromContent(goal);
    const { system, user: userPrompt } = buildPrompt({ goal, locale, profile, courses, tracks });
    const { raw, model } = await callOpenAi(system, userPrompt);
    const validated = validatePath(raw, {
      courses: new Map(courses.map((c) => [c.id, c])),
      tracks: new Map(tracks.map((t) => [t.slug, t])),
    });

    const saved = await upsertPath(db, {
      userId: user.id,
      goal,
      userLevel: profile.user_level,
      locale,
      model,
      path: validated,
    });

    return withCors(req, json({ cached: false, path: serializePath(saved) }));
  } catch (error) {
    console.error("[generate-learning-path]", error);
    const message = error instanceof Error ? error.message : "Không tạo được lộ trình.";
    const status = /Missing Authorization|Invalid or expired|Email confirmation/.test(message)
      ? 401
      : /Thiếu|Missing|hợp lệ|ngắn|chưa chọn/.test(message)
        ? 400
        : /trống/.test(message)
          ? 422
          : 500;
    return withCors(req, json({ message }, status));
  }
});
