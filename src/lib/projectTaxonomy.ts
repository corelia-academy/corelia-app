import { supabase } from "@/lib/supabase";

export type ProjectTaxonomyKind = "sector" | "technology";

export type ProjectTaxonomyOption = {
  id: string;
  kind: ProjectTaxonomyKind;
  name: string;
  sort_order: number;
};

export async function listProjectTaxonomyOptions(locale: string): Promise<ProjectTaxonomyOption[]> {
  const { data, error } = await supabase
    .from("project_taxonomy_options")
    .select("id,kind,name_vi,name_en,sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("id");
  if (error) throw new Error(error.message);
  const english = locale.toLowerCase().startsWith("en");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    kind: row.kind as ProjectTaxonomyKind,
    name: String(english ? row.name_en : row.name_vi),
    sort_order: Number(row.sort_order),
  }));
}

export function normalizeTaxonomySearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function projectTaxonomyNames(
  ids: string[],
  customNames: string[],
  system: ProjectTaxonomyOption[],
  legacy: Array<{ id: string; name: string }> = [],
): string[] {
  const names = new Map([...legacy, ...system].map((option) => [option.id, option.name]));
  return [...ids.map((id) => names.get(id)).filter((name): name is string => Boolean(name)), ...customNames];
}
