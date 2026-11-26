import { supabase } from "@/lib/supabase";
import { isHackathonProjectSource } from "@/lib/projectSource";

export type ProjectInviteDisplayContext = {
  projectTitle: string | null;
  projectSlug: string | null;
  logoUrl: string | null;
  hackathonTitle: string | null;
  hackathonHref: string | null;
};

export type CourseInviteDisplayContext = {
  title: string | null;
  thumbnailUrl: string | null;
};

/** Loads labels for project-invite notifications (invitees can read public hackathon-linked projects). */
export async function fetchProjectInviteDisplayContextByProjectIds(
  projectIds: string[],
): Promise<Record<string, ProjectInviteDisplayContext>> {
  const uniq = Array.from(new Set(projectIds.filter(Boolean)));
  if (uniq.length === 0) return {};

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,title,slug,logo_path,source_type,source_id")
    .in("id", uniq);
  if (error || !projects?.length) return {};

  const hackathonIds = Array.from(
    new Set(
      projects
        .filter((p) => isHackathonProjectSource(p.source_type) && p.source_id)
        .map((p) => p.source_id as string),
    ),
  );

  let hackathonRows: { id: string; document: unknown }[] = [];
  if (hackathonIds.length > 0) {
    const { data } = await supabase.from("hackathons").select("id,document").in("id", hackathonIds);
    hackathonRows = data ?? [];
  }

  const docByHackathonId = new Map(
    hackathonRows.map((h) => [h.id, (h.document ?? {}) as Record<string, unknown>]),
  );

  // Logos live in a private bucket; invitees can only sign URLs for projects they may read, so missing ones stay null.
  const logoPaths = Array.from(new Set(projects.map((p) => p.logo_path).filter((path): path is string => Boolean(path))));
  const logoUrlByPath = new Map<string, string>();
  if (logoPaths.length > 0) {
    const { data: signed } = await supabase.storage.from("app").createSignedUrls(logoPaths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) logoUrlByPath.set(item.path, item.signedUrl);
    }
  }

  const out: Record<string, ProjectInviteDisplayContext> = {};
  for (const p of projects) {
    let hackathonTitle: string | null = null;
    let hackathonHref: string | null = null;

    if (isHackathonProjectSource(p.source_type) && p.source_id) {
      const doc = docByHackathonId.get(p.source_id) ?? {};
      const rawTitle = doc.title;
      hackathonTitle =
        typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : null;
      const slug =
        typeof doc.slug === "string" && doc.slug.trim() ? doc.slug.trim() : null;
      hackathonHref = slug
        ? `/hackathons/${slug}/overview`
        : `/hackathons/${p.source_id}/overview`;
    }

    out[p.id] = {
      projectTitle: typeof p.title === "string" ? p.title : null,
      projectSlug: typeof p.slug === "string" && p.slug ? p.slug : null,
      logoUrl: p.logo_path ? logoUrlByPath.get(p.logo_path) ?? null : null,
      hackathonTitle,
      hackathonHref,
    };
  }

  return out;
}

/** Loads the name and cover of the courses named by co-instructor invites (published courses are readable by signed-in users). */
export async function fetchCourseInviteDisplayContextByCourseIds(
  courseIds: string[],
): Promise<Record<string, CourseInviteDisplayContext>> {
  const uniq = Array.from(new Set(courseIds.filter(Boolean)));
  if (uniq.length === 0) return {};

  const { data, error } = await supabase
    .from("courses")
    .select("id,title:data->>title,thumbnail_url:data->>thumbnail_url")
    .in("id", uniq);
  if (error || !data?.length) return {};

  const out: Record<string, CourseInviteDisplayContext> = {};
  for (const row of data as unknown as { id: string; title: string | null; thumbnail_url: string | null }[]) {
    out[row.id] = { title: row.title || null, thumbnailUrl: row.thumbnail_url || null };
  }
  return out;
}
