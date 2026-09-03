import type { JobSourceType } from "./types.ts";

const SOURCE_TIER: Record<JobSourceType, number> = {
  greenhouse: 600,
  lever: 600,
  ashby: 600,
  smartrecruiters: 600,
  cryptojobslist: 400,
  web3career: 400,
  himalayas: 400,
  remotive: 400,
  remoteok: 400,
  weworkremotely: 300,
  rss: 300,
};

export type CanonicalSource = {
  source_type: JobSourceType;
  priority: number;
};

/**
 * Source class is authoritative; the configurable priority only orders
 * sources inside the same class. This prevents a syndicated board from
 * replacing an official employer ATS listing by configuration accident.
 */
export function canonicalSourceScore(source: CanonicalSource): number {
  const priority = Number.isFinite(source.priority)
    ? Math.max(0, Math.min(100, Math.trunc(source.priority)))
    : 0;
  return SOURCE_TIER[source.source_type] * 1_000 + priority;
}

export function shouldReplaceCanonical(current: CanonicalSource, incoming: CanonicalSource): boolean {
  return canonicalSourceScore(incoming) > canonicalSourceScore(current);
}

