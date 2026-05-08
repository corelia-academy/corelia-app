import { supabase } from "@/lib/supabase";
import type { Project } from "@/types/projects";

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

export async function listPublicProjects(): Promise<PublicProjectEntry[]> {
  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,visibility,source_type,source_id,source_submission_id,created_at,updated_at" as const;

  const { data, error } = await supabase
    .from("projects")
    .select(select)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const projects = (data ?? []) as Project[];
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

export async function listMyProjects(): Promise<Project[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("Chưa đăng nhập");

  const select =
    "id,owner_id,title,summary,demo_url,repo_url,slide_url,visibility,source_type,source_id,source_submission_id,created_at,updated_at" as const;

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

  const merged = [...((owned ?? []) as Project[]), ...collaboratorProjects];
  const byId = new Map<string, Project>();
  for (const item of merged) byId.set(item.id, item);
  return Array.from(byId.values()).sort(
    (a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
  );
}

