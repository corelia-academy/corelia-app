import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Locale = "vi" | "en";
type Mode = "prompt" | "youtube_playlist" | "youtube_video_list";

type RequestBody = {
  generationId?: unknown;
  mode?: unknown;
  locale?: unknown;
  prompt?: unknown;
  playlistUrl?: unknown;
  videoUrls?: unknown;
  maxVideos?: unknown;
  targetLevel?: unknown;
  sectionsCount?: unknown;
};

type VideoMeta = {
  videoId: string;
  title: string;
  url: string;
  duration_seconds: number;
  description?: string;
  channel_title?: string;
  thumbnail_url?: string;
  published_at?: string;
};

type GeneratedLesson = {
  title: string;
  youtube_url?: string;
  duration_seconds?: number;
  video_primary_locale?: Locale;
};

type GeneratedSection = {
  title: string;
  lessons: GeneratedLesson[];
};

type GeneratedCourse = {
  title: string;
  slug?: string;
  description: string;
  short_description?: string;
  learning_outcomes: string[];
  sections: GeneratedSection[];
  is_external_aggregated?: boolean;
  external_source_urls?: string[];
  external_source_attribution_note?: string | null;
  warnings?: string[];
};

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
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
  for (const value of Object.values(parsed)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new Error("Invalid Supabase secret key env");
}

function createServiceClient(): SupabaseClient {
  return createClient(
    requireAnyEnv("CORELIA_SUPABASE_URL", "SUPABASE_URL"),
    readSupabaseSecretKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function verifyBearerUser(req: Request, db: SupabaseClient): Promise<User> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Missing Authorization header");
  const { data, error } = await db.auth.getUser(match[1]!);
  if (error || !data.user) throw new Error("Invalid or expired session");
  if (!data.user.email_confirmed_at) throw new Error("Email confirmation required");
  return data.user;
}

function parseBody(body: RequestBody): {
  generationId: number;
  mode: Mode;
  locale: Locale;
  prompt: string;
  playlistUrl: string | null;
  videoUrls: string[];
  maxVideos: number;
  targetLevel: string;
  sectionsCount: number;
} {
  const generationId = Number(body.generationId);
  if (!Number.isSafeInteger(generationId) || generationId <= 0) throw new Error("generationId is required");
  const mode =
    body.mode === "prompt" || body.mode === "youtube_playlist" || body.mode === "youtube_video_list"
      ? body.mode
      : null;
  if (!mode) throw new Error("Invalid generation mode");
  const locale = body.locale === "en" ? "en" : "vi";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
  const playlistUrl = typeof body.playlistUrl === "string" ? body.playlistUrl.trim() : null;
  const videoUrls = Array.isArray(body.videoUrls)
    ? body.videoUrls.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 200)
    : [];
  const maxVideos = Math.max(1, Math.min(200, Number(body.maxVideos ?? 12) || 12));
  const targetLevel = typeof body.targetLevel === "string" ? body.targetLevel.trim().slice(0, 40) : "all";
  const sectionsCount = Math.max(3, Math.min(12, Number(body.sectionsCount ?? 6) || 6));
  if (mode === "prompt" && prompt.length < 8) throw new Error("Prompt is too short");
  if (mode === "youtube_playlist" && !playlistUrl) throw new Error("playlistUrl is required");
  if (mode === "youtube_video_list" && videoUrls.length === 0) throw new Error("videoUrls is required");
  return { generationId, mode, locale, prompt, playlistUrl, videoUrls, maxVideos, targetLevel, sectionsCount };
}

function youtubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function youtubePlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("list");
  } catch {
    return null;
  }
}

function parseIsoDurationSeconds(value?: string): number {
  if (!value) return 0;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

async function fetchYoutubeVideos(videoIds: string[]): Promise<VideoMeta[]> {
  const key = Deno.env.get("YT_API_KEY")?.trim() ?? Deno.env.get("YOUTUBE_API_KEY")?.trim() ?? "";
  const ids = Array.from(new Set(videoIds)).filter(Boolean).slice(0, 200);
  if (!key || ids.length === 0) {
    return ids.map((videoId) => ({
      videoId,
      title: `YouTube video ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      duration_seconds: 0,
    }));
  }
  const out: VideoMeta[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", key);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not fetch YouTube video metadata");
    const payload = (await res.json()) as { items?: Array<Record<string, unknown>> };
    for (const item of payload.items ?? []) {
      const id = String(item.id ?? "");
      const snippet = (item.snippet ?? {}) as Record<string, unknown>;
      const contentDetails = (item.contentDetails ?? {}) as Record<string, unknown>;
      const thumbnails = (snippet.thumbnails ?? {}) as Record<string, Record<string, unknown>>;
      out.push({
        videoId: id,
        title: String(snippet.title ?? id),
        url: `https://www.youtube.com/watch?v=${id}`,
        duration_seconds: parseIsoDurationSeconds(String(contentDetails.duration ?? "")),
        description: String(snippet.description ?? "").slice(0, 500),
        channel_title: String(snippet.channelTitle ?? ""),
        thumbnail_url: String(thumbnails.high?.url ?? thumbnails.default?.url ?? ""),
        published_at: String(snippet.publishedAt ?? ""),
      });
    }
  }
  return out;
}

async function fetchPlaylistVideos(playlistUrl: string, maxVideos: number): Promise<VideoMeta[]> {
  const key = Deno.env.get("YT_API_KEY")?.trim() ?? Deno.env.get("YOUTUBE_API_KEY")?.trim() ?? "";
  const playlistId = youtubePlaylistId(playlistUrl);
  if (!playlistId) throw new Error("Invalid YouTube playlist URL");
  if (!key) throw new Error("Missing YT_API_KEY for playlist import");

  const videoIds: string[] = [];
  let pageToken = "";
  while (videoIds.length < maxVideos) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,status");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", key);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not fetch YouTube playlist");
    const payload = (await res.json()) as {
      nextPageToken?: string;
      items?: Array<{ snippet?: { resourceId?: { videoId?: string } } }>;
    };
    for (const item of payload.items ?? []) {
      const id = item.snippet?.resourceId?.videoId;
      if (id && videoIds.length < maxVideos) videoIds.push(id);
    }
    pageToken = payload.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return fetchYoutubeVideos(videoIds);
}

function extractResponseText(payload: OpenAiResponsesPayload): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseModelJson(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("OpenAI returned invalid JSON");
  }
}

function validateGeneratedCourse(value: unknown): GeneratedCourse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid generated course");
  const raw = value as Record<string, unknown>;
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((section) => {
        const s = section as Record<string, unknown>;
        return {
          title: String(s.title ?? "").trim(),
          lessons: Array.isArray(s.lessons)
            ? s.lessons.map((lesson) => {
                const l = lesson as Record<string, unknown>;
                return {
                  title: String(l.title ?? "").trim(),
                  youtube_url: typeof l.youtube_url === "string" ? l.youtube_url : undefined,
                  duration_seconds: Number(l.duration_seconds ?? 0),
                  video_primary_locale: l.video_primary_locale === "en" ? "en" : "vi",
                };
              }).filter((lesson) => lesson.title)
            : [],
        };
      }).filter((section) => section.title && section.lessons.length > 0)
    : [];
  const learningOutcomes = Array.isArray(raw.learning_outcomes)
    ? raw.learning_outcomes.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
    : [];
  const course = {
    title: String(raw.title ?? "").trim(),
    slug: typeof raw.slug === "string" ? raw.slug.trim() : undefined,
    description: String(raw.description ?? "").trim(),
    short_description: typeof raw.short_description === "string" ? raw.short_description.trim() : undefined,
    learning_outcomes: learningOutcomes,
    sections,
    is_external_aggregated: raw.is_external_aggregated === true,
    external_source_urls: Array.isArray(raw.external_source_urls)
      ? raw.external_source_urls.map((x) => String(x).trim()).filter(Boolean)
      : [],
    external_source_attribution_note:
      typeof raw.external_source_attribution_note === "string" ? raw.external_source_attribution_note.trim() : null,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((x) => String(x)).filter(Boolean) : [],
  };
  if (!course.title || !course.description || course.sections.length === 0) {
    throw new Error("Generated course is missing required fields");
  }
  return course;
}

function buildPrompt(args: {
  mode: Mode;
  locale: Locale;
  prompt: string;
  targetLevel: string;
  sectionsCount: number;
  playlistUrl: string | null;
  videoUrls: string[];
  videos: VideoMeta[];
}): string {
  const localeInstruction = args.locale === "vi" ? "Write all user-facing content in Vietnamese." : "Write all user-facing content in English.";
  const schemaInstruction = [
    "Return only valid JSON with this shape:",
    "{",
    '  "title": string,',
    '  "slug": string,',
    '  "short_description": string,',
    '  "description": string,',
    '  "learning_outcomes": string[],',
    '  "sections": [{"title": string, "lessons": [{"title": string, "youtube_url"?: string, "duration_seconds"?: number, "video_primary_locale"?: "vi" | "en"}]}],',
    '  "is_external_aggregated"?: boolean,',
    '  "external_source_urls"?: string[],',
    '  "external_source_attribution_note"?: string,',
    '  "warnings"?: string[]',
    "}",
  ].join("\n");
  const videoBlock = args.videos.length
    ? `Videos:\n${args.videos.map((v, i) => `${i + 1}. ${v.title} (${v.duration_seconds}s) ${v.url}\nChannel: ${v.channel_title ?? ""}\nDescription: ${v.description ?? ""}`).join("\n\n")}`
    : "";
  const sourceNote = args.mode === "prompt"
    ? `Course idea: ${args.prompt}\nTarget sections: ${args.sectionsCount}`
    : `Build a curated YouTube course from the supplied videos. Preserve each youtube_url on the matching lesson. Source URL: ${args.playlistUrl ?? args.videoUrls.join(", ")}`;
  return [
    "You are designing an editable course skeleton for Corelia.",
    localeInstruction,
    `Target level: ${args.targetLevel || "all"}.`,
    sourceNote,
    videoBlock,
    "Keep lessons concise. Do not generate full lesson articles. The user will edit before publishing.",
    "For YouTube modes, add attribution and set is_external_aggregated=true.",
    schemaInstruction,
  ].filter(Boolean).join("\n\n");
}

async function generateWithOpenAi(prompt: string, model: string): Promise<{ course: GeneratedCourse; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) throw new Error("Missing env: OPENAI_API_KEY");
  const resolvedModel = model === "gpt-5.4"
    ? (Deno.env.get("CORELIA_OPENAI_COURSE_FULL_MODEL")?.trim() || model)
    : model === "gpt-5.4-mini"
      ? (Deno.env.get("CORELIA_OPENAI_COURSE_MINI_MODEL")?.trim() || model)
      : model;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolvedModel,
      input: prompt,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[generate-course] openai", response.status, text);
    throw new Error("OpenAI could not generate the course skeleton");
  }
  const payload = (await response.json()) as OpenAiResponsesPayload;
  const text = extractResponseText(payload);
  if (!text) throw new Error("OpenAI returned an empty response");
  return {
    course: validateGeneratedCourse(parseModelJson(text)),
    inputTokens: Number(payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4)),
    outputTokens: Number(payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? Math.ceil(text.length / 4)),
  };
}

async function settle(
  db: SupabaseClient,
  generationId: number,
  status: "succeeded" | "failed",
  args?: { inputTokens?: number; outputTokens?: number; error?: string },
) {
  const { error } = await db.rpc("settle_course_generation", {
    p_generation_id: generationId,
    p_status: status,
    p_course_id: null,
    p_input_tokens: args?.inputTokens ?? null,
    p_output_tokens: args?.outputTokens ?? null,
    p_error: args?.error ?? null,
  });
  if (error) console.error("[generate-course] settle failed", error.message);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    if (!cors) return json({ message: "Origin not allowed" }, 403);
    return new Response(null, { status: 204, headers: cors });
  }

  let generationIdForRefund: number | null = null;
  let db: SupabaseClient | null = null;
  try {
    if (req.method !== "POST") return withCors(req, json({ message: "Method not allowed" }, 405));
    db = createServiceClient();
    const user = await verifyBearerUser(req, db);
    const body = parseBody((await req.json()) as RequestBody);
    generationIdForRefund = body.generationId;

    const { data: generation, error: generationError } = await db
      .from("ai_course_generations")
      .select("id,user_id,mode,status,model_used")
      .eq("id", body.generationId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: number; user_id: string; mode: Mode; status: string; model_used: string }>();
    if (generationError) throw new Error(generationError.message);
    if (!generation || generation.status !== "pending" || generation.mode !== body.mode) {
      throw new Error("Generation reservation is invalid or already used");
    }

    const videos =
      body.mode === "youtube_playlist"
        ? await fetchPlaylistVideos(body.playlistUrl!, body.maxVideos)
        : body.mode === "youtube_video_list"
          ? await fetchYoutubeVideos(body.videoUrls.map((url) => youtubeVideoId(url)).filter((id): id is string => Boolean(id)))
          : [];

    const prompt = buildPrompt({ ...body, videos });
    const result = await generateWithOpenAi(prompt, generation.model_used);
    await settle(db, body.generationId, "succeeded", {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    return withCors(req, json({
      course: result.course,
      usage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        model: generation.model_used,
      },
    }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "generate_course_failed";
    if (db && generationIdForRefund) {
      await settle(db, generationIdForRefund, "failed", { error: message });
    }
    return withCors(req, json({ message }, 400));
  }
});
