import { supabase } from "@/lib/supabase";
import { makeTTLCache, removeUndefinedFields } from "@/lib/utils";
import { normalizeContentLocale, pickContentLocale } from "@/lib/entityLocales";
import { getPublishedCourses } from "@/lib/courses";
import { listContests } from "@/lib/hackathons";
import type { ContestLinkedShowcaseProject, Project, ProjectSourceType } from "@/types/projects";
import type { Locale } from "@/types/database";
import type { EntityI18nConfig } from "@/types/entityLocales";
import type { MyProjectEntry } from "@/lib/projectCollaboration";
import type { Course } from "@/types/courses";
import type { Contest } from "@/types/hackathons";

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
    .in("source_type", ["contest", "hackathon"])
    .eq("source_id", contestId)
    .in("visibility", ["public", "unlisted"])
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContestLinkedShowcaseProject[];
}

/** Canonical name for new code. The legacy export remains for compatibility. */
export const listHackathonShowcaseProjects = listContestShowcaseProjects;

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

export type PublicProjectSourceFilter = "all" | "hackathon" | "course" | "standalone";
export type PublicProjectSort = "newest" | "most_liked" | "most_commented";

export type ListPublicProjectsOptions = {
  locale?: string | null;
  source?: PublicProjectSourceFilter | "contest" | null;
  sort?: PublicProjectSort | null;
  limit?: number;
  cursor?: string | null;
};

export type PublicProjectListResult = {
  items: PublicProjectEntry[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type PublicDirectoryItemKind = "hackathon" | "course" | "showcase";

export type PublicDirectoryItem = {
  id: string;
  kind: PublicDirectoryItemKind;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  href: string;
  updated_at: string;
  source: Contest | Course | Project;
  projectOwner: ProjectOwnerPublicProfile | null;
};

export type PublicDirectoryListResult = {
  items: PublicDirectoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

function normalizePublicProjectSource(
  source: ListPublicProjectsOptions["source"],
): ProjectSourceType[] | null {
  if (!source || source === "all") return null;
  if (source === "hackathon" || source === "contest") return ["contest", "hackathon"];
  return [source];
}

function normalizeProjectListSort(sort: ListPublicProjectsOptions["sort"]): PublicProjectSort {
  if (sort === "most_liked" || sort === "most_commented") return sort;
  return "newest";
}

function parseProjectCursor(cursor: string | null | undefined): number {
  const value = Number.parseInt(cursor ?? "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeProjectLimit(limit: number | null | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) return 12;
  return Math.min(Math.max(Math.trunc(limit ?? 12), 1), 48);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function getProjectCommentCounts(projectIds: string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean)));
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  if (ids.length === 0) return counts;

  const { data, error } = await supabase
    .from("project_comments")
    .select("project_id")
    .in("project_id", ids)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const projectId = String(row.project_id ?? "");
    if (!projectId) continue;
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
  }
  return counts;
}

async function attachOwners(projects: Project[]): Promise<PublicProjectEntry[]> {
  const ownerIds = Array.from(new Set(projects.map((p) => p.owner_id).filter(Boolean)));
  if (ownerIds.length === 0) return projects.map((project) => ({ project, owner: null }));

  const { data: owners, error: ownerErr } = await supabase
    .from("public_profiles")
    .select("id,username,ocid,full_name,avatar_url")
    .in("id", ownerIds);
  if (ownerErr) throw new Error(ownerErr.message);

  const ownerMap = new Map<string, ProjectOwnerPublicProfile>();
  for (const row of (owners ?? []) as ProjectOwnerPublicProfile[]) {
    ownerMap.set(row.id, row);
  }

  return projects.map((project) => ({
    project,
    owner: ownerMap.get(project.owner_id) ?? null,
  }));
}

async function localizeProjects(projects: Project[], uiLocale?: string | null): Promise<Project[]> {
  const normalizedUiLocale = normalizeContentLocale(uiLocale);

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

  return projects.map((p) => {
    const desired = pickContentLocale(p.i18n ?? null, normalizedUiLocale);
    const localized = localeMaps.get(desired)?.get(p.id) ?? null;
    return applyProjectLocaleContent(p, localized);
  });
}

export async function listPublicProjects(
  options: ListPublicProjectsOptions = {},
): Promise<PublicProjectListResult> {
  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;
  const limit = normalizeProjectLimit(options.limit);
  const offset = parseProjectCursor(options.cursor);
  const sourceType = normalizePublicProjectSource(options.source);
  const sort = normalizeProjectListSort(options.sort);

  let query = supabase
    .from("projects")
    .select(select)
    .eq("visibility", "public");

  if (sourceType) query = query.in("source_type", sourceType);

  if (sort === "most_liked") {
    query = query.order("like_count", { ascending: false }).order("updated_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const rangeStart = sort === "most_commented" ? 0 : offset;
  const rangeSize = sort === "most_commented" ? offset + limit : limit;
  const { data, error } = await query.range(rangeStart, rangeStart + rangeSize);
  if (error) throw new Error(error.message);

  const fetchedProjects = (data ?? []) as Project[];
  const hasMore = fetchedProjects.length > rangeSize;
  const candidates =
    sort === "most_commented"
      ? fetchedProjects.slice(0, offset + limit)
      : fetchedProjects.slice(0, limit);
  const commentCounts = await getProjectCommentCounts(candidates.map((p) => p.id));
  let projects = candidates.map((project) => ({
    ...project,
    comment_count: commentCounts.get(project.id) ?? 0,
  }));

  if (sort === "most_commented") {
    projects = projects
      .sort((a, b) => {
        const countDiff = Number(b.comment_count ?? 0) - Number(a.comment_count ?? 0);
        if (countDiff !== 0) return countDiff;
        return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
      })
      .slice(offset, offset + limit);
  }

  const localizedProjects = await localizeProjects(projects, options.locale);
  return {
    items: await attachOwners(localizedProjects),
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
}

async function listDirectoryProjectEntries(
  uiLocale?: string | null,
): Promise<PublicProjectEntry[]> {
  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;

  const { data, error } = await supabase
    .from("projects")
    .select(select)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const baseProjects = (data ?? []) as Project[];
  const commentCounts = await getProjectCommentCounts(baseProjects.map((p) => p.id));
  const projects = baseProjects.map((project) => ({
    ...project,
    comment_count: commentCounts.get(project.id) ?? 0,
  }));
  const localizedProjects = await localizeProjects(projects, uiLocale);
  return attachOwners(localizedProjects);
}

function publicDirectorySourceFlags(source: ListPublicProjectsOptions["source"]): {
  includeHackathons: boolean;
  includeCourses: boolean;
  includeShowcases: boolean;
} {
  if (!source || source === "all") {
    return { includeHackathons: true, includeCourses: true, includeShowcases: true };
  }
  if (source === "hackathon" || source === "contest") {
    return { includeHackathons: true, includeCourses: false, includeShowcases: false };
  }
  if (source === "course") {
    return { includeHackathons: false, includeCourses: true, includeShowcases: false };
  }
  return { includeHackathons: false, includeCourses: false, includeShowcases: true };
}

function directoryItemTime(item: PublicDirectoryItem): string {
  return item.updated_at || "";
}

function directoryProjectMetric(item: PublicDirectoryItem, metric: "like_count" | "comment_count"): number {
  if (item.kind !== "showcase") return 0;
  const project = item.source as Project;
  return Number(project[metric] ?? 0);
}

function courseSummary(course: Course): string | null {
  return course.short_description?.trim() || course.description?.trim() || null;
}

function contestSummary(contest: Contest): string | null {
  return contest.tagline?.trim() || contest.description?.trim() || null;
}

export async function listPublicDirectoryItems(
  options: ListPublicProjectsOptions = {},
): Promise<PublicDirectoryListResult> {
  const limit = normalizeProjectLimit(options.limit);
  const offset = parseProjectCursor(options.cursor);
  const sort = normalizeProjectListSort(options.sort);
  const { includeHackathons, includeCourses, includeShowcases } = publicDirectorySourceFlags(
    options.source,
  );

  const [projectRows, hackathons, courses] = await Promise.all([
    includeShowcases ? listDirectoryProjectEntries(options.locale) : Promise.resolve<PublicProjectEntry[]>([]),
    includeHackathons ? listContests(null, options.locale ?? null) : Promise.resolve<Contest[]>([]),
    includeCourses ? getPublishedCourses() : Promise.resolve<Course[]>([]),
  ]);

  const projectItems: PublicDirectoryItem[] = projectRows.map(({ project, owner }) => ({
    id: `showcase:${project.id}`,
    kind: "showcase",
    title: project.title,
    summary: project.summary ?? null,
    imageUrl: getProjectCoverImageUrl(project),
    href: `/projects/${project.id}`,
    updated_at: project.updated_at,
    source: project,
    projectOwner: owner,
  }));

  const hackathonItems: PublicDirectoryItem[] = hackathons.map((contest) => ({
    id: `hackathon:${contest.id}`,
    kind: "hackathon",
    title: contest.title,
    summary: contestSummary(contest),
    imageUrl: contest.thumbnail_url || contest.cover_image_url || null,
    href: `/hackathons/${contest.slug || contest.id}`,
    updated_at: contest.updated_at,
    source: contest,
    projectOwner: null,
  }));

  const courseItems: PublicDirectoryItem[] = courses.map((course) => ({
    id: `course:${course.id}`,
    kind: "course",
    title: course.title,
    summary: courseSummary(course),
    imageUrl: course.thumbnail_url || null,
    href: `/courses/${course.id}`,
    updated_at: course.updated_at,
    source: course,
    projectOwner: null,
  }));

  let items = [...projectItems, ...hackathonItems, ...courseItems];

  if (sort === "most_liked" || sort === "most_commented") {
    const metric = sort === "most_liked" ? "like_count" : "comment_count";
    items = items.sort((a, b) => {
      const metricDiff = directoryProjectMetric(b, metric) - directoryProjectMetric(a, metric);
      if (metricDiff !== 0) return metricDiff;
      return directoryItemTime(b).localeCompare(directoryItemTime(a));
    });
  } else {
    items = items.sort((a, b) => directoryItemTime(b).localeCompare(directoryItemTime(a)));
  }

  const page = items.slice(offset, offset + limit);
  return {
    items: page,
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
    hasMore: offset + limit < items.length,
  };
}

export async function getProjectById(
  id: string,
  uiLocale?: string | null,
): Promise<PublicProjectEntry | null> {
  const trimmedId = id.trim();
  if (!trimmedId) return null;
  if (!isUuidLike(trimmedId)) return null;

  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,screenshot_url,cover_image_url,video_url,visibility,source_type,source_id,source_submission_id,i18n,created_at,updated_at,like_count" as const;

  const { data, error } = await supabase
    .from("projects")
    .select(select)
    .eq("id", trimmedId)
    .eq("visibility", "public")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const project = data as Project;
  const commentCounts = await getProjectCommentCounts([project.id]);
  const [localizedProject] = await localizeProjects(
    [{ ...project, comment_count: commentCounts.get(project.id) ?? 0 }],
    uiLocale,
  );
  const [entry] = await attachOwners([localizedProject]);
  return entry ?? null;
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
