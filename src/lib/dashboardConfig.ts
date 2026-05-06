import { supabase } from "@/lib/supabase";
import { DOC } from "@/lib/collections";
import { getCurrentProfile } from "@/lib/profile";
import type { DashboardPinnedProgram, HomeDashboardConfig } from "@/types/dashboard";

let dashboardConfigCache: { promise: Promise<HomeDashboardConfig>; ts: number } | null = null;
const DASHBOARD_CONFIG_TTL = 5 * 60 * 1000;

const DASHBOARD_PINNED_PROGRAM_TYPES = new Set([
  "course",
  "contest",
] as const);

function isDashboardPinnedProgramType(value: unknown): value is DashboardPinnedProgram["type"] {
  return (
    typeof value === "string" &&
    DASHBOARD_PINNED_PROGRAM_TYPES.has(value as DashboardPinnedProgram["type"])
  );
}

function emptyHomeDashboardConfig(): HomeDashboardConfig {
  return {
    id: DOC.HOME_DASHBOARD,
    pinned_programs: [],
    updated_at: null,
    updated_by: null,
  };
}

function normalizePinnedProgram(
  item: Partial<DashboardPinnedProgram> | undefined,
  index: number,
): DashboardPinnedProgram | null {
  if (!isDashboardPinnedProgramType(item?.type) || !item?.ref_id) return null;
  return {
    id: item.id ?? `${item.type}_${item.ref_id}`,
    type: item.type,
    ref_id: item.ref_id,
    badge: item.badge ?? null,
    title_override: item.title_override ?? null,
    description_override: item.description_override ?? null,
    cta_label: item.cta_label ?? null,
    active: item.active ?? true,
    order: Number(item.order ?? index),
  };
}

function normalizeHomeDashboardConfig(
  data: Partial<HomeDashboardConfig> | null | undefined,
): HomeDashboardConfig {
  const base = emptyHomeDashboardConfig();
  const pinnedPrograms = (data?.pinned_programs ?? [])
    .map((item, index) => normalizePinnedProgram(item, index))
    .filter((item): item is DashboardPinnedProgram => item != null)
    .sort((a, b) => a.order - b.order);

  return {
    id: data?.id ?? base.id,
    pinned_programs: pinnedPrograms,
    updated_at: data?.updated_at ?? null,
    updated_by: data?.updated_by ?? null,
  };
}

async function requireDashboardConfigManager() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "support_staff")) {
    throw new Error("Bạn không có quyền cấu hình dashboard.");
  }
  return profile;
}

export async function getHomeDashboardConfig(): Promise<HomeDashboardConfig> {
  if (dashboardConfigCache && Date.now() - dashboardConfigCache.ts < DASHBOARD_CONFIG_TTL) {
    return dashboardConfigCache.promise;
  }
  const promise = (async () => {
    const { data, error } = await supabase
      .from("dashboard_configs")
      .select("*")
      .eq("id", DOC.HOME_DASHBOARD)
      .maybeSingle();
    if (error || !data?.data) return emptyHomeDashboardConfig();
    const raw = data.data as Partial<HomeDashboardConfig>;
    return normalizeHomeDashboardConfig({ id: data.id, ...raw });
  })();
  dashboardConfigCache = { promise, ts: Date.now() };
  promise.catch(() => { dashboardConfigCache = null; });
  return promise;
}

export function invalidateDashboardConfigCache() {
  dashboardConfigCache = null;
}

export async function updateHomeDashboardConfig(input: {
  pinned_programs: DashboardPinnedProgram[];
}): Promise<HomeDashboardConfig> {
  const profile = await requireDashboardConfigManager();
  const payload = normalizeHomeDashboardConfig({
    id: DOC.HOME_DASHBOARD,
    pinned_programs: input.pinned_programs,
    updated_at: new Date().toISOString(),
    updated_by: profile.id,
  });

  const { error } = await supabase.from("dashboard_configs").upsert(
    {
      id: DOC.HOME_DASHBOARD,
      data: payload as unknown as Record<string, unknown>,
      updated_at: payload.updated_at,
      updated_by: profile.id,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return payload;
}
