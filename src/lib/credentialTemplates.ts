import { supabase } from "@/lib/supabase";

export type CourseCredentialTriggerRule = {
  completion_pct: number;
  require_assignment_pass: boolean;
  min_assignment_score: number;
};

export type CredentialTemplateRow = {
  id: string;
  scope_type: string;
  course_id: string | null;
  hackathon_id: string | null;
  hackathon_role: string | null;
  name: string;
  description: string;
  image_url: string;
  achievement_type: string;
  identifier_prefix: string;
  collection_symbol: string;
  custom_metadata: Record<string, unknown>;
  trigger_type: string;
  trigger_rule: CourseCredentialTriggerRule | Record<string, unknown> | null;
  network_override: string | null;
  is_active: boolean;
  updated_at: string;
};

export async function getLatestCourseCredentialTemplate(
  courseId: string,
): Promise<CredentialTemplateRow | null> {
  const { data, error } = await supabase
    .from("credential_templates")
    .select("*")
    .eq("scope_type", "course")
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CredentialTemplateRow | null;
}

export async function saveCourseCredentialTemplate(params: {
  courseId: string;
  courseSlug: string;
  templateId: string | null;
  isActive: boolean;
  name: string;
  description: string;
  imageUrl: string;
  identifierPrefix: string;
  triggerRule: CourseCredentialTriggerRule;
}): Promise<{ id: string }> {
  const prefix = params.identifierPrefix.trim() || `corelia:${params.courseSlug}`.slice(0, 40);

  const row = {
    scope_type: "course" as const,
    course_id: params.courseId,
    hackathon_id: null,
    hackathon_role: null,
    name: params.name.trim(),
    description: params.description.trim(),
    image_url: params.imageUrl.trim(),
    achievement_type: "Badge" as const,
    identifier_prefix: prefix,
    collection_symbol: "corelia-courses" as const,
    custom_metadata: {} as Record<string, unknown>,
    trigger_type: "auto" as const,
    trigger_rule: params.triggerRule as unknown as Record<string, unknown>,
    network_override: null as string | null,
    is_active: params.isActive,
  };

  const deactivateOthers = async (keepId: string) => {
    await supabase
      .from("credential_templates")
      .update({ is_active: false })
      .eq("course_id", params.courseId)
      .eq("scope_type", "course")
      .neq("id", keepId);
  };

  if (params.templateId) {
    const { error } = await supabase.from("credential_templates").update(row).eq("id", params.templateId);
    if (error) throw new Error(error.message);
    if (params.isActive) {
      await deactivateOthers(params.templateId);
      await supabase.from("credential_templates").update({ is_active: true }).eq("id", params.templateId);
    }
    return { id: params.templateId };
  }

  const { data, error } = await supabase.from("credential_templates").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  const id = data?.id != null ? String(data.id) : "";
  if (!id) throw new Error("Không lưu được template.");
  if (params.isActive) {
    await deactivateOthers(id);
    await supabase.from("credential_templates").update({ is_active: true }).eq("id", id);
  }
  return { id };
}

export async function listHackathonCredentialTemplates(
  hackathonId: string,
): Promise<CredentialTemplateRow[]> {
  const { data, error } = await supabase
    .from("credential_templates")
    .select("*")
    .eq("scope_type", "hackathon")
    .eq("hackathon_id", hackathonId)
    .order("hackathon_role", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CredentialTemplateRow[];
}

export async function saveHackathonCredentialTemplate(params: {
  hackathonId: string;
  hackathonSlug: string;
  templateId: string | null;
  hackathonRole: string;
  isActive: boolean;
  name: string;
  description: string;
  imageUrl: string;
  identifierPrefix: string;
}): Promise<{ id: string }> {
  const slug = params.hackathonSlug.trim() || "hackathon";
  const defaultPrefix = `corelia:${slug}:${params.hackathonRole}`.replace(/[^a-z0-9:.-]/gi, "-").slice(0, 40);
  const prefix = params.identifierPrefix.trim() || defaultPrefix;

  const row = {
    scope_type: "hackathon" as const,
    course_id: null,
    hackathon_id: params.hackathonId,
    hackathon_role: params.hackathonRole.trim(),
    name: params.name.trim(),
    description: params.description.trim(),
    image_url: params.imageUrl.trim(),
    achievement_type: "Award" as const,
    identifier_prefix: prefix,
    collection_symbol: "corelia-hackathons" as const,
    custom_metadata: {} as Record<string, unknown>,
    trigger_type: "manual" as const,
    trigger_rule: null as null,
    network_override: null as string | null,
    is_active: params.isActive,
  };

  if (params.templateId) {
    const { error } = await supabase.from("credential_templates").update(row).eq("id", params.templateId);
    if (error) throw new Error(error.message);
    return { id: params.templateId };
  }

  const { data, error } = await supabase.from("credential_templates").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  const id = data?.id != null ? String(data.id) : "";
  if (!id) throw new Error("Không lưu được template.");
  return { id };
}

export async function countIssuancesForTemplate(templateId: string): Promise<number> {
  const { count, error } = await supabase
    .from("credential_issuances")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listActivityMilestoneTemplates(): Promise<CredentialTemplateRow[]> {
  const { data, error } = await supabase
    .from("credential_templates")
    .select("*")
    .eq("scope_type", "activity_milestone")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CredentialTemplateRow[];
}

export async function saveActivityMilestoneTemplate(params: {
  templateId: string | null;
  isActive: boolean;
  name: string;
  description: string;
  imageUrl: string;
  identifierPrefix: string;
  triggerType: "auto" | "manual";
  triggerRule: Record<string, unknown> | null;
}): Promise<{ id: string }> {
  const row = {
    scope_type: "activity_milestone" as const,
    course_id: null,
    hackathon_id: null,
    hackathon_role: null,
    name: params.name.trim(),
    description: params.description.trim(),
    image_url: params.imageUrl.trim(),
    achievement_type: "Badge" as const,
    identifier_prefix: params.identifierPrefix.trim(),
    collection_symbol: "corelia-achievements" as const,
    custom_metadata: {} as Record<string, unknown>,
    trigger_type: params.triggerType,
    trigger_rule: params.triggerRule as Record<string, unknown> | null,
    network_override: null as string | null,
    is_active: params.isActive,
  };

  if (params.templateId) {
    const { error } = await supabase.from("credential_templates").update(row).eq("id", params.templateId);
    if (error) throw new Error(error.message);
    return { id: params.templateId };
  }

  const { data, error } = await supabase.from("credential_templates").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  const id = data?.id != null ? String(data.id) : "";
  if (!id) throw new Error("Không lưu được milestone.");
  return { id };
}
