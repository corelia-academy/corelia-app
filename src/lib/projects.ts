import { supabase } from "@/lib/supabase";
import { makeTTLCache, removeUndefinedFields } from "@/lib/utils";
import { normalizeContentLocale, pickContentLocale } from "@/lib/entityLocales";
import type { ContestLinkedShowcaseProject, Project } from "@/types/projects";
import type { Locale } from "@/types/database";
import type { EntityI18nConfig } from "@/types/entityLocales";
import type { MyProjectEntry } from "@/lib/projectCollaboration";

export type ProjectI18nContent = {
  title?: string;
  summary?: string | null;
  updated_at?: string;
};

export function getProjectCoverImageUrl(
  project: Pick<Project, "cover_image_url" | "screenshot_url">,
): string | null {
  return project.cover_image_url || project.screenshot_url || null;
}

const LOCALE_CACHE_TTL = 5 * 60 * 1000;
const projectLocaleCache = makeTTLCache<ProjectI18nContent | null>(LOCALE_CACHE_TTL);

export function applyProjectLocaleContent(project: Project, localized: ProjectI18nContent | null): Project {
  if (!localized) return project;
  return {
    ...project,
    title: localized.title ?? project.title,
    summary: localized.summary ?? project.summary,
  };
}

export async function getProjectLocaleContent(
  projectId: string,
  locale: Locale,
): Promise<ProjectI18nContent | null> {
  const normalized = normalizeContentLocale(locale);
  const key = `${projectId}:${normalized}`;
  const existing = projectLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("project_locales")
      .select("data")
      .eq("project_id", projectId)
      .eq("locale", normalized)
      .maybeSingle();
    if (error || !data?.data) return null;
    return data.data as ProjectI18nContent;
  })();
  projectLocaleCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    projectLocaleCache.delete(key);
    throw e;
  }
}

export async function getBatchProjectLocaleContent(
  projectIds: string[],
  locale: Locale,
): Promise<Map<string, ProjectI18nContent>> {
  const normalized = normalizeContentLocale(locale);
  const result = new Map<string, ProjectI18nContent>();
  const ids = Array.from(new Set(projectIds.map((v) => v.trim()).filter(Boolean)));
  if (ids.length === 0) return result;

  const uncachedIds: string[] = [];
  for (const id of ids) {
    const cached = projectLocaleCache.get(`${id}:${normalized}`);
    if (cached) {
      const content = await cached;
      if (content) result.set(id, content);
    } else {
      uncachedIds.push(id);
    }
  }
  if (uncachedIds.length === 0) return result;

  const { data, error } = await supabase
    .from("project_locales")
    .select("project_id,data")
    .in("project_id", uncachedIds)
    .eq("locale", normalized);

  if (!error && data) {
    for (const row of data as Array<{ project_id: string; data: unknown }>) {
      if (!row.data) continue;
      const content = row.data as ProjectI18nContent;
      projectLocaleCache.set(`${row.project_id}:${normalized}`, Promise.resolve(content));
      result.set(row.project_id, content);
    }
  }

  return result;
}

export async function setProjectLocaleContent(
  projectId: string,
  locale: Locale,
  data: Partial<ProjectI18nContent>,
): Promise<void> {
  const normalized = normalizeContentLocale(locale);
  const payload = removeUndefinedFields({
    ...data,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>;
  const { error } = await supabase.from("project_locales").upsert(
    { project_id: projectId, locale: normalized, data: payload },
    { onConflict: "project_id,locale" },
  );
  if (error) throw new Error(error.message);
  projectLocaleCache.delete(`${projectId}:${normalized}`);
}

/** Public/unlisted project cards linked to a hackathon (synced from submissions). */
export async function listContestShowcaseProjects(
  contestId: string,
): Promise<ContestLinkedShowcaseProject[]> {
  const select =
    "id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,owner_id,source_submission_id,updated_at,like_count" as const;

  const { data, error } = await supabase
    .from("projects")
    .select(select)
    .eq("source_type", "contest")
    .eq("source_id", contestId)
    .in("visibility", ["public", "unlisted"])
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContestLinkedShowcaseProject[];
}

export async function updateProjectI18n(
  projectId: string,
  i18n: EntityI18nConfig | null,
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ i18n })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
}

export type ProjectOwnerPublicProfile = {
  id: string;
  username: string | null;
  ocid: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type PublicProjectEntry = {
  project: Project;
  owner: ProjectOwnerPublicProfile | null;
};

export async function listPublicProjects(uiLocale?: string | null): Promise<PublicProjectEntry[]> {
  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;

  const { data, error } = await supabase
    .from("projects")
    .select(select)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const normalizedUiLocale = normalizeContentLocale(uiLocale);

  const projects = (data ?? []) as Project[];
  const idsByLocale = new Map<Locale, string[]>();
  for (const p of projects) {
    const desired = pickContentLocale(p.i18n ?? null, normalizedUiLocale);
    const list = idsByLocale.get(desired) ?? [];
    list.push(p.id);
    idsByLocale.set(desired, list);
  }
  const localeMaps = new Map<Locale, Map<string, ProjectI18nContent>>();
  await Promise.all(
    Array.from(idsByLocale.entries()).map(async ([locale, ids]) => {
      localeMaps.set(locale, await getBatchProjectLocaleContent(ids, locale));
    }),
  );
  const localizedProjects = projects.map((p) => {
    const desired = pickContentLocale(p.i18n ?? null, normalizedUiLocale);
    const localized = localeMaps.get(desired)?.get(p.id) ?? null;
    return applyProjectLocaleContent(p, localized);
  });

  const ownerIds = Array.from(new Set(localizedProjects.map((p) => p.owner_id).filter(Boolean)));
  if (ownerIds.length === 0) return localizedProjects.map((project) => ({ project, owner: null }));

  const { data: owners, error: ownerErr } = await supabase
    .from("public_profiles")
    .select("id,username,ocid,full_name,avatar_url")
    .in("id", ownerIds);
  if (ownerErr) throw new Error(ownerErr.message);

  const ownerMap = new Map<string, ProjectOwnerPublicProfile>();
  for (const row of (owners ?? []) as ProjectOwnerPublicProfile[]) {
    ownerMap.set(row.id, row);
  }

  return localizedProjects.map((project) => ({
    project,
    owner: ownerMap.get(project.owner_id) ?? null,
  }));
}

export async function listMyProjects(uiLocale?: string | null): Promise<Project[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("Chưa đăng nhập");

  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;

  const [{ data: owned, error: ownedErr }, { data: collaboratorRows, error: collabErr }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(select)
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("show_in_portfolio", true),
    ]);

  if (ownedErr) throw new Error(ownedErr.message);
  if (collabErr) throw new Error(collabErr.message);

  const collaboratorProjectIds = Array.from(
    new Set((collaboratorRows ?? []).map((row) => row.project_id).filter(Boolean)),
  ) as string[];

  let collaboratorProjects: Project[] = [];
  if (collaboratorProjectIds.length > 0) {
    const { data, error } = await supabase
      .from("projects")
      .select(select)
      .in("id", collaboratorProjectIds)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    collaboratorProjects = (data ?? []) as Project[];
  }

  const normalizedUiLocale = normalizeContentLocale(uiLocale);

  const merged = [...((owned ?? []) as Project[]), ...collaboratorProjects];
  const byId = new Map<string, Project>();
  for (const item of merged) byId.set(item.id, item);
  const list = Array.from(byId.values()).sort(
    (a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
  );

  const idsByLocale = new Map<Locale, string[]>();
  for (const p of list) {
    const desired = pickContentLocale(p.i18n ?? null, normalizedUiLocale);
    const ids = idsByLocale.get(desired) ?? [];
    ids.push(p.id);
    idsByLocale.set(desired, ids);
  }
  const localeMaps = new Map<Locale, Map<string, ProjectI18nContent>>();
  await Promise.all(
    Array.from(idsByLocale.entries()).map(async ([locale, ids]) => {
      localeMaps.set(locale, await getBatchProjectLocaleContent(ids, locale));
    }),
  );

  return list.map((p) => {
    const desired = pickContentLocale(p.i18n ?? null, normalizedUiLocale);
    const localized = localeMaps.get(desired)?.get(p.id) ?? null;
    return applyProjectLocaleContent(p, localized);
  });
}

export async function listMyProjectsForAccount(uiLocale?: string | null): Promise<MyProjectEntry[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("Chưa đăng nhập");

  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;

  const [{ data: owned, error: ownedErr }, { data: collaboratorRows, error: collabErr }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(select)
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("project_collaborators")
        .select("project_id,role,show_in_portfolio")
        .eq("user_id", user.id),
    ]);

  if (ownedErr) throw new Error(ownedErr.message);
  if (collabErr) throw new Error(collabErr.message);

  const ownedProjects = ((owned ?? []) as Project[]).map((project) => ({
    project,
    access: {
      is_owner: true,
      collaborator_role: null,
      show_in_portfolio: null,
    },
  }));

  const collaboratorProjectIds = Array.from(
    new Set((collaboratorRows ?? []).map((row) => row.project_id).filter(Boolean)),
  ) as string[];
  const collabByProjectId = new Map<
    string,
    { role: string | null; show_in_portfolio: boolean | null }
  >(
    (collaboratorRows ?? []).map((row) => [
      String(row.project_id),
      {
        role: typeof row.role === "string" ? row.role : null,
        show_in_portfolio:
          typeof row.show_in_portfolio === "boolean" ? row.show_in_portfolio : null,
      },
    ]),
  );

  let collaboratorProjects: MyProjectEntry[] = [];
  if (collaboratorProjectIds.length > 0) {
    const { data, error } = await supabase
      .from("projects")
      .select(select)
      .in("id", collaboratorProjectIds)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    collaboratorProjects = ((data ?? []) as Project[]).map((project) => {
      const access = collabByProjectId.get(project.id);
      return {
        project,
        access: {
          is_owner: false,
          collaborator_role: access?.role ?? null,
          show_in_portfolio: access?.show_in_portfolio ?? null,
        },
      };
    });
  }

  const normalizedUiLocale = normalizeContentLocale(uiLocale);
  const merged = [...ownedProjects, ...collaboratorProjects];
  const byId = new Map<string, MyProjectEntry>();
  for (const item of merged) byId.set(item.project.id, item);
  const list = Array.from(byId.values()).sort((a, b) =>
    String(b.project.updated_at ?? "").localeCompare(String(a.project.updated_at ?? "")),
  );

  const idsByLocale = new Map<Locale, string[]>();
  for (const item of list) {
    const desired = pickContentLocale(item.project.i18n ?? null, normalizedUiLocale);
    const ids = idsByLocale.get(desired) ?? [];
    ids.push(item.project.id);
    idsByLocale.set(desired, ids);
  }
  const localeMaps = new Map<Locale, Map<string, ProjectI18nContent>>();
  await Promise.all(
    Array.from(idsByLocale.entries()).map(async ([locale, ids]) => {
      localeMaps.set(locale, await getBatchProjectLocaleContent(ids, locale));
    }),
  );

  return list.map((item) => {
    const desired = pickContentLocale(item.project.i18n ?? null, normalizedUiLocale);
    const localized = localeMaps.get(desired)?.get(item.project.id) ?? null;
    return {
      ...item,
      project: applyProjectLocaleContent(item.project, localized),
    };
  });
}
