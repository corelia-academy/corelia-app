import type { Contest, ContestI18nContent, ContestTrack, HackathonTaxonomyOption, HackathonTimelineItem, HackathonWinnerAward } from "@/types/hackathons";

export function applyHackathonLocaleContent(contest: Contest, localized: ContestI18nContent | null): Contest {
  if (!localized) return contest;
  const localizedTracks = new Map((localized.tracks ?? []).map((item) => [item.id, item]));
  const localizedSectors = new Map((localized.sectors ?? []).map((item) => [item.id, item]));
  const localizedTechStacks = new Map((localized.tech_stacks ?? []).map((item) => [item.id, item]));
  const localizedTimeline = new Map((localized.timeline ?? []).map((item) => [item.id, item]));
  return {
    ...contest,
    title: localized.title ?? contest.title,
    tagline: localized.tagline ?? contest.tagline,
    short_description: localized.short_description ?? contest.short_description ?? contest.tagline,
    description: localized.description ?? contest.description,
    description_markdown: localized.description_markdown ?? contest.description_markdown ?? contest.description,
    resources_markdown: localized.resources_markdown ?? contest.resources_markdown,
    rules: localized.rules ?? contest.rules,
    prize_pool_summary: localized.prize_pool_summary ?? contest.prize_pool_summary,
    faqs: localized.faqs ?? contest.faqs,
    timeline_milestones: localized.timeline_milestones ?? contest.timeline_milestones,
    organizational_partners: localized.organizational_partners ?? contest.organizational_partners,
    prize_pool: contest.prize_pool ? { ...contest.prize_pool, description_markdown: localized.prize_description_markdown ?? contest.prize_pool.description_markdown } : contest.prize_pool,
    tracks: localized.tracks ? (contest.tracks ?? []).map((item) => ({ ...item, name: localizedTracks.get(item.id)?.name ?? item.name, description: localizedTracks.get(item.id)?.description ?? item.description })) : contest.tracks,
    sectors: localized.sectors ? (contest.sectors ?? []).map((item) => ({ ...item, name: localizedSectors.get(item.id)?.name ?? item.name, description: localizedSectors.get(item.id)?.description ?? item.description })) : contest.sectors,
    tech_stacks: localized.tech_stacks ? (contest.tech_stacks ?? []).map((item) => ({ ...item, name: localizedTechStacks.get(item.id)?.name ?? item.name, description: localizedTechStacks.get(item.id)?.description ?? item.description })) : contest.tech_stacks,
    timeline: localized.timeline ? (contest.timeline ?? []).map((item) => ({ ...item, title: localizedTimeline.get(item.id)?.title ?? item.title, description_markdown: localizedTimeline.get(item.id)?.description_markdown ?? item.description_markdown })) : contest.timeline,
    rounds: localized.rounds ? (localized.rounds as Contest["rounds"]) : contest.rounds,
  };
}

export function sanitizeHackathonTaxonomy(values: HackathonTaxonomyOption[]): HackathonTaxonomyOption[] {
  const seen = new Set<string>();
  return values
    .map((value, index) => ({
      ...value,
      id: value.id.trim(),
      name: value.name.trim(),
      active: value.active !== false,
      sort_order: Number.isFinite(value.sort_order) ? value.sort_order : index,
    }))
    .filter((value) => Boolean(value.id && value.name) && !seen.has(value.id) && Boolean(seen.add(value.id)))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function isPrizeAllocationValid(total: string, tracks: ContestTrack[]): boolean {
  const totalValue = Number(total);
  if (!Number.isFinite(totalValue) || totalValue < 0) return false;
  const allocated = tracks.reduce((sum, track) => sum + Number(track.prize_amount || 0), 0);
  return Number.isFinite(allocated) && allocated >= 0 && allocated <= totalValue;
}

export function areHackathonDeadlinesValid(registration: string | null, submission: string | null): boolean {
  if (!registration || !submission) return true;
  const registrationTime = Date.parse(registration);
  const submissionTime = Date.parse(submission);
  return Number.isFinite(registrationTime) && Number.isFinite(submissionTime) && registrationTime <= submissionTime;
}

export function sortHackathonTimeline(items: HackathonTimelineItem[]): HackathonTimelineItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export function matchesHackathonTaxonomy(
  project: { trackIds: string[]; sectorIds: string[]; techStackIds: string[] },
  filters: { trackIds: string[]; sectorIds: string[]; techStackIds: string[] },
): boolean {
  const matches = (values: string[], selected: string[]) => selected.length === 0 || selected.some((id) => values.includes(id));
  return matches(project.trackIds, filters.trackIds)
    && matches(project.sectorIds, filters.sectorIds)
    && matches(project.techStackIds, filters.techStackIds);
}

export function orderWinnerFirst<T extends { id: string }>(items: T[], awards: HackathonWinnerAward[]): T[] {
  const order = new Map(awards.map((award) => [award.project_id, award.sort_order]));
  return [...items].sort((a, b) => {
    const left = order.get(a.id);
    const right = order.get(b.id);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return left - right;
  });
}

export function generateCanonicalProjectSlug(title: string, suffix = ""): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "project";
  const normalizedSuffix = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return normalizedSuffix ? `${base}-${normalizedSuffix}` : base;
}
