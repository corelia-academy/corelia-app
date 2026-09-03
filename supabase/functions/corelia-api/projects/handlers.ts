import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient, type User } from "../lib/supabase.ts";
import {
  moderateProjectImage,
  moderateProjectText,
  ProjectAiError,
  verifyPublicProjectLinks,
} from "./openai.ts";
import {
  detectImageMime,
  isOwnedProjectMediaPath,
  isUuid,
  normalizeHttpsUrl,
  normalizeProjectSlug,
  PROJECT_LOGO_MAX_BYTES,
  PROJECT_MEDIA_BUCKET,
  PROJECT_SCREENSHOT_LIMIT,
  PROJECT_SCREENSHOT_MAX_BYTES,
  projectMediaPath,
  type ProjectMediaKind,
  validateProjectLinks,
} from "./validation.ts";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "internal_error";
  if (error instanceof ProjectAiError) return json({ message: error.code }, error.status);
  if (message.startsWith("invalid_input:") || message.startsWith("invalid_url:")) {
    return json({ message }, 400);
  }
  if (["Missing Authorization header", "Invalid Authorization header", "Invalid or expired session"].includes(message)) {
    return json({ message: "unauthenticated" }, 401);
  }
  if (message.startsWith("forbidden:")) return json({ message }, 403);
  if (message.startsWith("not_found:")) return json({ message }, 404);
  if (message.startsWith("conflict:")) return json({ message }, 409);
  console.error("[corelia-api] projects", error);
  return json({ message: "project_operation_failed" }, 500);
}

async function actorCanManageProject(db: SupabaseClient, user: User, projectId: string): Promise<{
  allowed: boolean;
  ownerId: string;
}> {
  const [{ data: project, error: projectError }, { data: profile, error: profileError }] = await Promise.all([
    db.from("projects").select("owner_id").eq("id", projectId).maybeSingle(),
    db.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (projectError) throw new Error(projectError.message);
  if (profileError) throw new Error(profileError.message);
  if (!project) return { allowed: true, ownerId: user.id };
  const staff = profile?.role === "admin" || profile?.role === "support_staff";
  return { allowed: project.owner_id === user.id || staff, ownerId: String(project.owner_id) };
}

export async function handleProjectMediaUpload(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    await cleanupExpiredProjectMedia(db);
    const form = await req.formData();
    const projectId = String(form.get("project_id") ?? "").trim();
    const kind = String(form.get("kind") ?? "") as ProjectMediaKind;
    const file = form.get("file");
    if (!isUuid(projectId) || !["logo", "screenshot"].includes(kind) || !(file instanceof File)) {
      return json({ message: "invalid_input:project_media" }, 400);
    }

    const access = await actorCanManageProject(db, user, projectId);
    if (!access.allowed) return json({ message: "forbidden:project_media" }, 403);
    const maxBytes = kind === "logo" ? PROJECT_LOGO_MAX_BYTES : PROJECT_SCREENSHOT_MAX_BYTES;
    if (file.size <= 0 || file.size > maxBytes) {
      return json({ message: `invalid_input:${kind}_size` }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectImageMime(bytes);
    if (!mime || file.type !== mime) return json({ message: "invalid_input:image_type" }, 400);

    try {
      await moderateProjectImage(bytes, mime);
    } catch (error) {
      if (error instanceof ProjectAiError && error.code === "moderation_blocked:image") {
        throw new ProjectAiError(`moderation_blocked:${kind}`);
      }
      throw error;
    }
    const path = projectMediaPath({
      ownerId: access.ownerId,
      projectId,
      kind,
      objectId: crypto.randomUUID(),
      mime,
    });
    const { error: uploadError } = await db.storage.from(PROJECT_MEDIA_BUCKET).upload(path, bytes, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { data: signed, error: signError } = await db.storage
      .from(PROJECT_MEDIA_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signError || !signed?.signedUrl) {
      await db.storage.from(PROJECT_MEDIA_BUCKET).remove([path]);
      throw new Error(signError?.message ?? "project_media_sign_failed");
    }
    const { error: registryError } = await db.from("project_media_uploads").insert({
      path,
      owner_id: access.ownerId,
      project_id: projectId,
    });
    if (registryError) {
      await db.storage.from(PROJECT_MEDIA_BUCKET).remove([path]);
      throw new Error(registryError.message);
    }
    return json({ path, signed_url: signed.signedUrl });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleProjectMediaDelete(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const projectId = String(body.project_id ?? "").trim();
    const path = String(body.path ?? "").trim();
    if (!isUuid(projectId) || !path) return json({ message: "invalid_input:project_media" }, 400);
    const access = await actorCanManageProject(db, user, projectId);
    if (!access.allowed || !isOwnedProjectMediaPath(path, access.ownerId, projectId)) {
      return json({ message: "forbidden:project_media" }, 403);
    }
    const { data: upload, error: uploadError } = await db
      .from("project_media_uploads")
      .select("path")
      .eq("path", path)
      .eq("owner_id", access.ownerId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (uploadError) throw new Error(uploadError.message);
    if (!upload) return json({ message: "forbidden:project_media" }, 403);
    const { error } = await db.storage.from(PROJECT_MEDIA_BUCKET).remove([path]);
    if (error) throw new Error(error.message);
    const { error: registryError } = await db.from("project_media_uploads").delete().eq("path", path);
    if (registryError) console.warn("[projects.media] registry delete failed", registryError.message);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeProjectI18n(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_input:project_i18n");
  const raw = value as Record<string, unknown>;
  const supported = stringList(raw.supported_locales);
  if (supported.some((locale) => !["vi", "en"].includes(locale))) {
    throw new Error("invalid_input:project_i18n");
  }
  const primary = String(raw.primary_content_locale ?? "").trim();
  if (primary && !["vi", "en"].includes(primary)) throw new Error("invalid_input:project_i18n");
  if (primary && supported.length && !supported.includes(primary)) {
    throw new Error("invalid_input:project_i18n");
  }
  return {
    ...(supported.length ? { supported_locales: supported } : {}),
    ...(primary ? { primary_content_locale: primary } : {}),
  };
}

async function cleanupExpiredProjectMedia(db: SupabaseClient): Promise<void> {
  const { data, error } = await db
    .from("project_media_uploads")
    .select("path,project_id")
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (error) {
    console.warn("[projects.media] expired upload lookup failed", error.message);
    return;
  }
  const rows = (data ?? []).map((row) => ({
    path: String(row.path),
    projectId: String(row.project_id),
  })).filter((row) => row.path && row.projectId);
  const paths = rows.map((row) => row.path);
  if (!paths.length) return;
  const projectIds = Array.from(new Set(rows.map((row) => row.projectId)));
  const { data: projects, error: projectsError } = await db
    .from("projects")
    .select("id,logo_path,screenshot_paths")
    .in("id", projectIds);
  if (projectsError) {
    console.warn("[projects.media] committed media lookup failed", projectsError.message);
    return;
  }
  const referenced = new Set<string>();
  for (const project of projects ?? []) {
    if (project.logo_path) referenced.add(String(project.logo_path));
    for (const path of Array.isArray(project.screenshot_paths) ? project.screenshot_paths : []) {
      referenced.add(String(path));
    }
  }
  const stalePaths = paths.filter((path) => !referenced.has(path));
  const { error: removeError } = stalePaths.length
    ? await db.storage.from(PROJECT_MEDIA_BUCKET).remove(stalePaths)
    : { error: null };
  if (removeError) {
    console.warn("[projects.media] expired object cleanup failed", removeError.message);
    return;
  }
  const { error: registryError } = await db.from("project_media_uploads").delete().in("path", paths);
  if (registryError) console.warn("[projects.media] expired registry cleanup failed", registryError.message);
}

export async function handleProjectSave(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    await cleanupExpiredProjectMedia(db);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mode = String(body.mode ?? "project");
    const projectId = String(body.project_id ?? "").trim();
    if (!isUuid(projectId)) return json({ message: "invalid_input:project_id" }, 400);

    if (mode === "locale") {
      const locale = String(body.locale ?? "").trim();
      const data = typeof body.data === "object" && body.data !== null
        ? body.data as Record<string, unknown>
        : {};
      const localeTitle = String(data.title ?? "");
      const localeSummary = String(data.summary ?? "");
      if (localeTitle.length > 160 || localeSummary.length > 1_000) {
        return json({ message: "invalid_input:project_content" }, 400);
      }
      await moderateProjectText([
        { field: "locale.title", text: localeTitle },
        { field: "locale.summary", text: localeSummary },
      ]);
      const { error } = await db.rpc("save_ai_gated_project_locale", {
        p_actor_id: user.id,
        p_project_id: projectId,
        p_locale: locale,
        p_data: data,
      });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (mode === "i18n") {
      const i18n = normalizeProjectI18n(body.i18n ?? null);
      const { error } = await db.rpc("update_ai_gated_project_i18n", {
        p_actor_id: user.id,
        p_project_id: projectId,
        p_i18n: i18n,
      });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    const title = String(body.title ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const slug = normalizeProjectSlug(body.slug);
    if (!title || title.length > 160 || summary.length > 1_000) {
      return json({ message: "invalid_input:project_content" }, 400);
    }
    const links = validateProjectLinks(body);
    const videoUrl = normalizeHttpsUrl("video_url", body.video_url);
    const screenshotPaths = stringList(body.screenshot_paths);
    if (screenshotPaths.length > PROJECT_SCREENSHOT_LIMIT) {
      return json({ message: "invalid_input:project_screenshot_limit" }, 400);
    }

    await moderateProjectText([
      { field: "title", text: title },
      { field: "summary", text: summary },
    ]);
    await verifyPublicProjectLinks(links);

    const params = {
      p_actor_id: user.id,
      p_project_id: projectId,
      p_slug: slug,
      p_title: title,
      p_summary: summary || null,
      p_demo_url: links.find((link) => link.field === "demo_url")?.url ?? null,
      p_repo_url: links.find((link) => link.field === "repo_url")?.url ?? null,
      p_slide_url: links.find((link) => link.field === "slide_url")?.url ?? null,
      // Intentionally excluded from every AI request.
      p_video_url: videoUrl,
      p_logo_path: String(body.logo_path ?? "").trim() || null,
      p_screenshot_paths: screenshotPaths,
      p_visibility: String(body.visibility ?? "public"),
      p_source_type: String(body.source_type ?? "standalone"),
      p_source_id: String(body.source_id ?? "").trim() || null,
      p_track_ids: stringList(body.track_ids),
      p_sector_ids: stringList(body.sector_ids),
      p_tech_stack_ids: stringList(body.tech_stack_ids),
    };
    const { data, error } = await db.rpc("save_ai_gated_project", params);
    if (error) throw new Error(error.message);
    const committedPaths = [params.p_logo_path, ...params.p_screenshot_paths]
      .filter((path): path is string => Boolean(path));
    if (committedPaths.length) {
      const { error: registryError } = await db
        .from("project_media_uploads")
        .delete()
        .eq("project_id", projectId)
        .in("path", committedPaths);
      if (registryError) console.warn("[projects.media] commit registry cleanup failed", registryError.message);
    }
    const removedPaths = stringList(body.removed_media_paths);
    if (removedPaths.length) {
      const access = await actorCanManageProject(db, user, projectId);
      const committedPathSet = new Set(committedPaths);
      const safePaths = removedPaths.filter((path) => (
        !committedPathSet.has(path) && isOwnedProjectMediaPath(path, access.ownerId, projectId)
      ));
      if (safePaths.length) {
        const { error: removeError } = await db.storage.from(PROJECT_MEDIA_BUCKET).remove(safePaths);
        if (removeError) console.warn("[projects.media] stale object cleanup failed", removeError.message);
        const { error: registryError } = await db.from("project_media_uploads").delete().in("path", safePaths);
        if (registryError) console.warn("[projects.media] stale registry cleanup failed", registryError.message);
      }
    }
    const saved = Array.isArray(data) ? data[0] : data;
    return json({ ok: true, project: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
