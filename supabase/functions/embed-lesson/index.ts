import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Locale = "vi" | "en";

type RequestBody = {
  courseId?: unknown;
  lessonId?: unknown;
  force?: unknown;
};

type LessonRow = {
  id: string;
  course_id: string;
  section_id: string | null;
  data: Record<string, unknown> | null;
};

type CourseRow = {
  id: string;
  data: Record<string, unknown> | null;
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

async function assertCanManageCourse(
  db: SupabaseClient,
  courseId: string,
  userId: string,
): Promise<void> {
  // Mirror private.can_manage_course: course owner OR admin/support.
  const { data: course, error } = await db
    .from("courses")
    .select("id,instructor_id")
    .eq("id", courseId)
    .maybeSingle<{ id: string; instructor_id: string | null }>();
  if (error) throw new Error(error.message);
  if (!course) throw new Error("Không tìm thấy course.");
  if (course.instructor_id === userId) return;

  const { data: profile, error: profileError } = await db
    .from("public_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string | null }>();
  if (profileError) throw new Error(profileError.message);
  const role = (profile?.role ?? "").toLowerCase();
  if (role === "admin" || role === "support") return;
  throw new Error("Forbidden");
}

function parseBody(body: RequestBody): { courseId: string; lessonId: string | null; force: boolean } {
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const lessonId =
    typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
  const force = body.force === true;
  if (!courseId) throw new Error("Thiếu courseId.");
  return { courseId, lessonId, force };
}

function detectLocaleFromContent(text: string): Locale {
  return /[à-ỹđ]/i.test(text) ? "vi" : "en";
}

// — Chunking —
const MIN_CHUNK_LEN = 80;
const MAX_CHUNK_LEN = 1800;

function chunkMarkdown(markdown: string): string[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  // Split by H2 headings; keep heading line with its body.
  const parts: string[] = [];
  const lines = trimmed.split(/\n/);
  let current: string[] = [];
  for (const line of lines) {
    if (/^##\s+/.test(line) && current.length > 0) {
      parts.push(current.join("\n").trim());
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) parts.push(current.join("\n").trim());

  // For any oversized part, split by blank lines into smaller chunks.
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= MAX_CHUNK_LEN) {
      if (part.length >= MIN_CHUNK_LEN) out.push(part);
      else if (out.length > 0) out[out.length - 1] += "\n\n" + part;
      else out.push(part);
      continue;
    }
    const paras = part.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buf = "";
    for (const p of paras) {
      if ((buf + "\n\n" + p).length > MAX_CHUNK_LEN && buf.length >= MIN_CHUNK_LEN) {
        out.push(buf);
        buf = p;
      } else {
        buf = buf ? buf + "\n\n" + p : p;
      }
    }
    if (buf) out.push(buf);
  }
  return out.filter((c) => c.length >= MIN_CHUNK_LEN);
}

type ChunkSpec = {
  index: number;
  kind: "summary" | "section";
  content: string;
};

function buildChunkSpecs(
  lessonTitle: string,
  shortDescription: string,
  markdown: string,
): ChunkSpec[] {
  const specs: ChunkSpec[] = [];
  const summaryParts = [lessonTitle, shortDescription].filter(Boolean).join(" — ").trim();
  if (summaryParts) {
    specs.push({ index: 0, kind: "summary", content: summaryParts.slice(0, MAX_CHUNK_LEN) });
  }
  const sections = chunkMarkdown(markdown);
  for (const content of sections) {
    specs.push({ index: specs.length, kind: "section", content });
  }
  return specs;
}

// — Checksum —
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// — OpenAI embed (batched) —
async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) throw new Error("Missing env: OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${response.status}: ${text.slice(0, 400)}`);
  }
  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const embeddings = (payload.data ?? []).map((d) => d.embedding ?? []);
  if (embeddings.length !== texts.length) {
    throw new Error("Embedding count mismatch.");
  }
  return embeddings;
}

type EmbedReport = { embedded: number; skipped: number; deleted: number };

async function embedLesson(
  db: SupabaseClient,
  course: CourseRow,
  lesson: LessonRow,
  force: boolean,
): Promise<EmbedReport> {
  const lessonData = (lesson.data ?? {}) as Record<string, unknown>;
  const courseData = (course.data ?? {}) as Record<string, unknown>;
  const lessonTitle = String(lessonData.title ?? "").trim() || "Lesson";
  const shortDescription = String(lessonData.short_description ?? "").trim();
  const markdown = String(lessonData.description_markdown ?? "").trim();
  const courseTitle = String(courseData.title ?? "").trim() || "Course";

  const specs = buildChunkSpecs(lessonTitle, shortDescription, markdown);
  if (specs.length === 0) return { embedded: 0, skipped: 0, deleted: 0 };

  const haystack = `${shortDescription}\n${markdown}`;
  const locale: Locale = detectLocaleFromContent(haystack);

  // Load existing chunks for this lesson
  const { data: existing, error: existingError } = await db
    .from("knowledge_chunks")
    .select("id,source_id,chunk_kind,chunk_index,checksum")
    .eq("source_table", "course_lessons")
    .like("source_id", `${lesson.course_id}:${lesson.id}:%`);
  if (existingError) throw new Error(existingError.message);

  const existingByIndex = new Map<number, { id: string; checksum: string | null }>();
  for (const row of existing ?? []) {
    const idx = typeof row.chunk_index === "number" ? row.chunk_index : -1;
    if (idx >= 0) existingByIndex.set(idx, { id: row.id as string, checksum: row.checksum ?? null });
  }

  // Pre-compute checksums; figure out which specs actually need embedding.
  const checksums = await Promise.all(specs.map((s) => sha256(`${locale}|${s.kind}|${s.content}`)));
  const needsEmbedSpecs: ChunkSpec[] = [];
  const needsEmbedIndices: number[] = [];
  specs.forEach((spec, i) => {
    const prev = existingByIndex.get(spec.index);
    if (!force && prev && prev.checksum === checksums[i]) return;
    needsEmbedSpecs.push(spec);
    needsEmbedIndices.push(i);
  });

  let embedded = 0;
  const skipped = specs.length - needsEmbedSpecs.length;
  if (needsEmbedSpecs.length > 0) {
    // Batch 8 at a time to keep payload modest.
    const BATCH = 8;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < needsEmbedSpecs.length; i += BATCH) {
      const slice = needsEmbedSpecs.slice(i, i + BATCH);
      const embeddings = await embedBatch(slice.map((s) => s.content));
      allEmbeddings.push(...embeddings);
    }

    const nowIso = new Date().toISOString();
    const rows = needsEmbedSpecs.map((spec, i) => ({
      source_table: "course_lessons",
      source_id: `${lesson.course_id}:${lesson.id}:${spec.index}`,
      source_updated_at: nowIso,
      locale,
      title: lessonTitle,
      topic: courseTitle,
      subtopic: lessonTitle,
      content: spec.content,
      content_category: "lesson",
      chunk_kind: spec.kind,
      chunk_index: spec.index,
      checksum: checksums[needsEmbedIndices[i]!],
      metadata: {
        lessonId: lesson.id,
        courseId: lesson.course_id,
        sectionId: lesson.section_id,
      },
      embedding: `[${allEmbeddings[i]!.join(",")}]`,
      embedding_model: "text-embedding-3-small",
      embedded_at: nowIso,
    }));

    const { error: upsertError } = await db.from("knowledge_chunks").upsert(rows, {
      onConflict: "source_table,source_id,locale,chunk_kind,chunk_index",
    });
    if (upsertError) throw new Error(upsertError.message);
    embedded = rows.length;
  }

  // Delete orphan chunks (lesson shrunk)
  const validIndices = new Set(specs.map((s) => s.index));
  const orphanIds: string[] = [];
  for (const [idx, row] of existingByIndex.entries()) {
    if (!validIndices.has(idx)) orphanIds.push(row.id);
  }
  let deleted = 0;
  if (orphanIds.length > 0) {
    const { error: delError } = await db
      .from("knowledge_chunks")
      .delete()
      .in("id", orphanIds);
    if (delError) throw new Error(delError.message);
    deleted = orphanIds.length;
  }

  return { embedded, skipped, deleted };
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
    const { courseId, lessonId, force } = parseBody(
      (await req.json().catch(() => ({}))) as RequestBody,
    );

    await assertCanManageCourse(db, courseId, user.id);

    const { data: course, error: courseError } = await db
      .from("courses")
      .select("id,data")
      .eq("id", courseId)
      .maybeSingle<CourseRow>();
    if (courseError) throw new Error(courseError.message);
    if (!course) return withCors(req, json({ message: "Không tìm thấy course." }, 404));

    let lessons: LessonRow[] = [];
    if (lessonId) {
      const { data, error } = await db
        .from("course_lessons")
        .select("id,course_id,section_id,data")
        .eq("course_id", courseId)
        .eq("id", lessonId)
        .maybeSingle<LessonRow>();
      if (error) throw new Error(error.message);
      if (!data) return withCors(req, json({ message: "Không tìm thấy lesson." }, 404));
      lessons = [data];
    } else {
      const { data, error } = await db
        .from("course_lessons")
        .select("id,course_id,section_id,data")
        .eq("course_id", courseId);
      if (error) throw new Error(error.message);
      lessons = (data ?? []) as LessonRow[];
    }

    const totals: EmbedReport = { embedded: 0, skipped: 0, deleted: 0 };
    const results: Array<{ lessonId: string } & EmbedReport> = [];
    for (const lesson of lessons) {
      try {
        const r = await embedLesson(db, course, lesson, force);
        totals.embedded += r.embedded;
        totals.skipped += r.skipped;
        totals.deleted += r.deleted;
        results.push({ lessonId: lesson.id, ...r });
      } catch (err) {
        console.error("[embed-lesson] failed", lesson.id, err);
        results.push({ lessonId: lesson.id, embedded: 0, skipped: 0, deleted: 0 });
      }
      // Small breather to stay friendly to the embeddings endpoint.
      if (lessons.length > 1) await new Promise((r) => setTimeout(r, 150));
    }

    return withCors(req, json({ ok: true, totals, results }));
  } catch (error) {
    console.error("[embed-lesson]", error);
    const message = error instanceof Error ? error.message : "Embed lesson thất bại.";
    const status = /Missing Authorization|Invalid or expired|Email confirmation/.test(message)
      ? 401
      : /Forbidden/.test(message)
        ? 403
        : /Thiếu|Missing|hợp lệ/.test(message)
          ? 400
          : /Không tìm thấy/.test(message)
            ? 404
            : 500;
    return withCors(req, json({ message }, status));
  }
});
