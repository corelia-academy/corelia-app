import type { SupabaseClient } from "../lib/supabase.ts";
import type { CatalogResearch } from "./catalog.ts";

export const CATALOG_RESEARCH_METRIC_MAX_CHARS = 400;

const SHARED_ORDER = ["trend", "demand", "ai_feasibility", "maintainability"] as const;
const GROUP_ORDER = ["skill", "role", "ecosystem"] as const;
const GROUP_CRITERION_ORDER = ["corelia_fit", "catalog_gap"] as const;

export interface BriefCatalogCriterion {
  criterion: string;
  level: number | null;
  confidence: string;
  conflicts: string;
  sources: { url: string; metric: string; period: string }[];
}

export interface BriefCatalogResearch {
  shared: BriefCatalogCriterion[];
  by_group: { group_kind: string; criteria: BriefCatalogCriterion[] }[];
}

function boundedMetric(metric: string): string {
  const value = metric.trim();
  if (value.length <= CATALOG_RESEARCH_METRIC_MAX_CHARS) return value;
  return `${value.slice(0, CATALOG_RESEARCH_METRIC_MAX_CHARS - 1)}…`;
}

/** Project only A1 evidence relevant to this run's paths; evidence ids and input evidence stay private. */
export function projectCatalogResearchForBrief(output: unknown, groupKinds: readonly string[]): BriefCatalogResearch {
  if (typeof output !== "object" || output === null) throw new Error("invalid completed A1 output");
  const research = output as CatalogResearch;
  if (!Array.isArray(research.shared) || !Array.isArray(research.by_group) || !Array.isArray(research.web_evidence)) {
    throw new Error("invalid completed A1 output");
  }

  const webEvidence = new Map(research.web_evidence.map((e) => [e.evidence_id, e]));
  const projectCriterion = (item: CatalogResearch["shared"][number]): BriefCatalogCriterion => ({
    criterion: item.criterion,
    level: item.level,
    confidence: item.confidence,
    conflicts: item.conflicts,
    sources: [...new Set(item.evidence_ids)]
      .sort((a, b) => a.localeCompare(b))
      .flatMap((id) => {
        const source = webEvidence.get(id);
        return source ? [{ url: source.url, metric: boundedMetric(source.metric), period: source.period }] : [];
      }),
  });

  const wantedGroups = new Set(groupKinds);
  const byGroup = GROUP_ORDER.flatMap((groupKind) => {
    if (!wantedGroups.has(groupKind)) return [];
    const group = research.by_group.find((item) => item.group_kind === groupKind);
    if (!group) return [];
    return [{
      group_kind: groupKind,
      criteria: GROUP_CRITERION_ORDER.flatMap((name) => {
        const item = group.criteria.find((entry) => entry.criterion === name);
        return item ? [projectCriterion(item)] : [];
      }),
    }];
  });

  return {
    shared: SHARED_ORDER.flatMap((name) => {
      const item = research.shared.find((entry) => entry.criterion === name);
      return item ? [projectCriterion(item)] : [];
    }),
    by_group: byGroup,
  };
}

/** A run pins its A1 job id, so each brief retry reads that job's latest completed attempt. */
export async function loadCatalogResearchForBrief(
  db: SupabaseClient,
  catalogJobId: string,
  groupKinds: readonly string[],
): Promise<BriefCatalogResearch> {
  const { data, error } = await db
    .from("studio_generations")
    .select("attempt,output")
    .eq("catalog_job_id", catalogJobId)
    .eq("status", "completed")
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`completed A1 output missing for catalog job ${catalogJobId}`);
  return projectCatalogResearchForBrief(data.output, groupKinds);
}
