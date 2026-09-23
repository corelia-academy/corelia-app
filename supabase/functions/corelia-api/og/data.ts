import type { SupabaseClient } from "../lib/supabase.ts";
import { contentRevision, dateLabel, plainText, safeId } from "./text.ts";
import type { OgCard, OgEntity, OgPublicMeta } from "./types.ts";

const EVENT_STATUSES = ["published", "running", "ended"];

function required(value: unknown, limit: number): string | null {
  return plainText(value, limit);
}

function canonicalOrigin(): string {
  const value = Deno.env.get("CORELIA_APP_ORIGIN")?.trim();
  if (!value) throw new Error("Missing CORELIA_APP_ORIGIN");
  const url = new URL(value);
  if (!(["https:", "http:"].includes(url.protocol)) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Invalid CORELIA_APP_ORIGIN");
  }
  return url.origin;
}

function mediaPath(value: unknown, prefix: string): string | null {
  return typeof value === "string" && value.startsWith(prefix) && !value.includes("..")
    ? value : null;
}

async function projectCard(db: SupabaseClient, id: string): Promise<Omit<OgCard, "revision"> | null> {
  const { data: row, error } = await db.from("projects")
    .select("id,slug,owner_id,title,summary,logo_path,hackathon_sector_ids,hackathon_tech_stack_ids,custom_sector_names,custom_tech_stack_names,updated_at")
    .eq("slug", id).eq("visibility", "public").eq("blocked", false).maybeSingle();
  if (error) throw error;
  if (!row?.slug || !required(row.title, 96)) return null;
  const ids = [...(row.hackathon_tech_stack_ids ?? []), ...(row.hackathon_sector_ids ?? [])] as string[];
  const [{ data: owner, error: ownerError }, { data: options, error: optionsError }] = await Promise.all([
    db.from("public_profiles").select("full_name,username,ocid").eq("id", row.owner_id).maybeSingle(),
    ids.length ? db.from("project_taxonomy_options").select("id,name_vi").eq("active", true).in("id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ownerError || optionsError) throw ownerError ?? optionsError;
  const byId = new Map((options ?? []).map(item => [item.id, item.name_vi]));
  const tags = [...ids.map(item => byId.get(item)), ...(row.custom_tech_stack_names ?? []), ...(row.custom_sector_names ?? [])]
    .map(item => plainText(item, 32)).filter((item): item is string => Boolean(item));
  const uniqueTags = Array.from(new Map(tags.map(item => [item.toLocaleLowerCase(), item])).values()).slice(0, 3);
  return {
    entity: "project", id: row.id, canonicalId: row.slug,
    title: required(row.title, 96)!, description: plainText(row.summary, 180),
    subtitle: plainText(owner?.full_name ?? owner?.username ?? owner?.ocid, 48),
    tags: uniqueTags,
    imagePath: mediaPath(row.logo_path, `project-media/${row.owner_id}/${row.id}/logo/`),
    dateLabel: null,
    updatedAt: row.updated_at, canonicalUrl: `${canonicalOrigin()}/projects/${encodeURIComponent(row.slug)}`,
  };
}

async function courseCard(db: SupabaseClient, id: string): Promise<Omit<OgCard, "revision"> | null> {
  let query = db.from("courses").select("id,slug,instructor_id,data,updated_at")
    .eq("published", true).is("archived_at", null).eq("slug", id);
  let { data: row, error } = await query.maybeSingle();
  if (error) throw error;
  if (!row) {
    query = db.from("courses").select("id,slug,instructor_id,data,updated_at")
      .eq("published", true).is("archived_at", null).eq("id", id);
    ({ data: row, error } = await query.maybeSingle());
    if (error) throw error;
  }
  if (!row?.slug) return null;
  const body = row.data as Record<string, unknown> | null;
  const title = required(body?.title, 96);
  if (!title) return null;
  const path = mediaPath(body?.thumbnail_path, `course-thumbnails/${row.id}/`);
  return {
    entity: "course", id: row.id, canonicalId: row.slug,
    title, description: plainText(body?.short_description ?? body?.description, 180),
    subtitle: plainText(body?.instructor_name, 48), tags: [], imagePath: path, dateLabel: null,
    updatedAt: row.updated_at, canonicalUrl: `${canonicalOrigin()}/courses/${encodeURIComponent(row.slug)}`,
  };
}

async function eventCard(db: SupabaseClient, id: string): Promise<Omit<OgCard, "revision"> | null> {
  const { data: row, error } = await db.from("hackathons")
    .select("id,status,document,updated_at").eq("document->>slug", id).in("status", EVENT_STATUSES).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const body = row.document as Record<string, unknown> | null;
  const slug = safeId(String(body?.slug ?? ""));
  const title = required(body?.title, 96);
  if (!slug || !title) return null;
  const host = body?.host as Record<string, unknown> | null;
  const start = dateLabel(body?.starts_at);
  const end = dateLabel(body?.ends_at);
  return {
    entity: "hackathon", id: row.id, canonicalId: slug, title,
    description: plainText(body?.short_description ?? body?.tagline, 180),
    subtitle: plainText(host?.name, 48), tags: [],
    imagePath: mediaPath(body?.cover_image_path, `contest-banners/${row.id}/`),
    dateLabel: start ? end && end !== start ? `${start} – ${end}` : start : null,
    updatedAt: row.updated_at, canonicalUrl: `${canonicalOrigin()}/hackathons/${encodeURIComponent(slug)}`,
  };
}

function internalAvatarPath(value: unknown, profileId: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const supabaseOrigin = new URL(Deno.env.get("SUPABASE_URL") ?? "http://localhost").origin;
    if (url.origin !== supabaseOrigin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/app\/(avatars\/[^/]+\/[^/]+)$/);
    return match?.[1]?.startsWith(`avatars/${profileId}/`) ? match[1] : null;
  } catch { return null; }
}

async function profileCard(db: SupabaseClient, id: string): Promise<Omit<OgCard, "revision"> | null> {
  const handle = id.replace(/^@/, "");
  const escapedHandle = handle.replace(/[\\%_]/g, character => `\\${character}`);
  let { data: row, error } = await db.from("public_profiles")
    .select("id,username,ocid,full_name,bio,avatar_url,updated_at")
    .eq("profile_public", true).ilike("username", escapedHandle).maybeSingle();
  if (error) throw error;
  if (!row) {
    ({ data: row, error } = await db.from("public_profiles")
      .select("id,username,ocid,full_name,bio,avatar_url,updated_at")
      .eq("profile_public", true).ilike("ocid", escapedHandle).maybeSingle());
    if (error) throw error;
  }
  if (!row) return null;
  const canonicalId = safeId(String(row.username ?? row.ocid ?? ""));
  if (!canonicalId) return null;
  const { data: skills, error: skillError } = await db.rpc("list_profile_course_skills", { p_profile_id: row.id });
  if (skillError) throw skillError;
  return {
    entity: "profile", id: row.id, canonicalId,
    title: required(row.full_name ?? row.username ?? row.ocid, 96) ?? canonicalId,
    description: plainText(row.bio, 180), subtitle: `@${canonicalId}`,
    tags: (skills ?? []).map((item: { skill: string }) => plainText(item.skill, 32))
      .filter((item: string | null): item is string => Boolean(item)).slice(0, 3),
    imagePath: internalAvatarPath(row.avatar_url, row.id),
    dateLabel: null,
    updatedAt: row.updated_at, canonicalUrl: `${canonicalOrigin()}/@${encodeURIComponent(canonicalId)}`,
  };
}

export async function loadOgCard(db: SupabaseClient, entity: OgEntity, rawId: string): Promise<OgCard | null> {
  const id = safeId(rawId);
  if (!id) return null;
  const card = entity === "project" ? await projectCard(db, id)
    : entity === "course" ? await courseCard(db, id)
    : entity === "hackathon" ? await eventCard(db, id)
    : await profileCard(db, id);
  if (!card) return null;
  const revision = await contentRevision([
    card.entity, card.canonicalId, card.title, card.description, card.subtitle,
    card.tags, card.imagePath, card.dateLabel, card.canonicalUrl,
  ]);
  return { ...card, revision };
}

export function publicOgMeta(card: OgCard): OgPublicMeta {
  const origin = new URL(card.canonicalUrl).origin;
  return {
    canonicalUrl: card.canonicalUrl,
    imageUrl: `${origin}/api/og/${card.entity}/${encodeURIComponent(card.canonicalId)}?v=${card.revision}`,
    updatedAt: card.updatedAt,
    revision: card.revision,
    title: `${card.title} | Corelia`,
    description: card.description ?? `${card.title} trên Corelia Academy`,
    imageAlt: `${card.entity}: ${card.title}`,
  };
}
