import { supabase } from "@/lib/supabase";
import { isHackathonProjectSource } from "@/lib/projectSource";

export type ProjectInviteDisplayContext = {
  projectTitle: string | null;
  hackathonTitle: string | null;
  hackathonHref: string | null;
};

/** Loads labels for project-invite notifications (invitees can read public hackathon-linked projects). */
export async function fetchProjectInviteDisplayContextByProjectIds(
  projectIds: string[],
): Promise<Record<string, ProjectInviteDisplayContext>> {
  const uniq = Array.from(new Set(projectIds.filter(Boolean)));
  if (uniq.length === 0) return {};

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,title,source_type,source_id")
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
      hackathonTitle,
      hackathonHref,
    };
  }

  return out;
}
