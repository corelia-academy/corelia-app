import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CalendarDays, Coins, FolderOpen, Package, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useOutletContext, useSearchParams } from "react-router";

import { Markdown } from "@/components/markdown/Markdown";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { Button } from "@/components/ui/button";
import { publicProjectDirectoryQueryOptions } from "@/features/projects/projectQueries";
import { cn } from "@/lib/utils";
import type { ContestTrack, HackathonTaxonomyOption } from "@/types/hackathons";
import type { HackathonOutletContext } from "./ContestPublicLayout";

function EmptyTab({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-base p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised text-foreground-subtle">{icon}</div>
      <p className="mt-3 text-sm text-foreground-muted">{title}</p>
    </div>
  );
}

export function HackathonOverviewTab() {
  const { contest, registration } = useOutletContext<HackathonOutletContext>();
  const { t } = useTranslation("contests");
  const content = contest.description_markdown || contest.description || "";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <section className="rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">{t("public.overview.description")}</h2>
        {content ? <div className="mt-4"><Markdown content={content} /></div> : <p className="mt-4 text-sm text-foreground-muted">{t("public.empty.overview")}</p>}
      </section>
      <aside className="rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card lg:self-start">
        <h2 className="font-semibold text-foreground">{t("public.overview.summary")}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-foreground-muted">{t("public.overview.mode")}</dt><dd className="font-medium">{t(`public.mode.${contest.mode ?? contest.location}`)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-foreground-muted">{t("public.participants")}</dt><dd className="font-medium">{contest.participants_count ?? 0}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-foreground-muted">{t("public.overview.registration")}</dt><dd className="font-medium">{registration ? t("public.overview.registered") : t("public.overview.notRegistered")}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

export function HackathonPrizesTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t } = useTranslation("contests");
  const pool = contest.prize_pool;
  const tracks = [...(contest.tracks ?? [])].filter((track) => track.active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (!pool && tracks.length === 0) return <EmptyTab icon={<Coins className="size-6" />} title={t("public.empty.prizes")} />;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-subtle bg-surface-base p-6 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("public.prizes.total")}</div>
        <div className="mt-2 text-3xl font-bold text-foreground">{pool?.amount || "0"} <span className="text-lg text-foreground-muted">{pool?.currency}</span></div>
        {pool?.description_markdown ? <div className="mt-4"><Markdown content={pool.description_markdown} /></div> : null}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <article key={track.id} className="rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card">
            <div className="flex items-start justify-between gap-4"><h2 className="font-semibold text-foreground">{track.name}</h2>{track.prize_amount ? <span className="shrink-0 font-semibold text-primary">{track.prize_amount} {pool?.currency}</span> : null}</div>
            {track.description ? <p className="mt-2 text-sm leading-6 text-foreground-muted">{track.description}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

export function HackathonTimelineTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t, i18n } = useTranslation("contests");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const timeline = [...(contest.timeline ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.starts_at.localeCompare(b.starts_at));
  if (timeline.length === 0) return <EmptyTab icon={<CalendarDays className="size-6" />} title={t("public.empty.timeline")} />;
  return (
    <ol className="relative ml-3 border-l border-border pl-7">
      {timeline.map((item) => (
        <li key={item.id} className="relative pb-8 last:pb-0">
          <span className="absolute -left-[2.15rem] top-1 size-3 rounded-full border-2 border-background bg-primary" />
          <div className="rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card">
            <h2 className="font-semibold text-foreground">{item.title}</h2>
            <time className="mt-1 block text-xs text-foreground-muted">{new Date(item.starts_at).toLocaleString(locale)}{item.ends_at ? ` — ${new Date(item.ends_at).toLocaleString(locale)}` : ""}</time>
            {item.description_markdown ? <div className="mt-3"><Markdown content={item.description_markdown} compact /></div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HackathonResourcesTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t } = useTranslation("contests");
  if (!contest.resources_markdown?.trim()) return <EmptyTab icon={<FolderOpen className="size-6" />} title={t("public.empty.resources")} />;
  return <section className="rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card sm:p-7"><Markdown content={contest.resources_markdown} /></section>;
}

type FilterOption = Pick<HackathonTaxonomyOption, "id" | "name"> & { active?: boolean };

function FilterGroup({ label, options, selected, toggle }: { label: string; options: FilterOption[]; selected: string[]; toggle: (id: string) => void }) {
  const visible = options.filter((option) => option.active !== false);
  if (!visible.length) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">{visible.map((option) => <button key={option.id} type="button" aria-pressed={selected.includes(option.id)} className={cn("min-h-11 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", selected.includes(option.id) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-surface-raised")} onClick={() => toggle(option.id)}>{option.name}</button>)}</div>
    </fieldset>
  );
}

export function HackathonProjectsTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t, i18n } = useTranslation("contests");
  const [params, setParams] = useSearchParams();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const read = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const tracks = read("tracks");
  const sectors = read("sectors");
  const tech = read("tech");
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
  const query = useInfiniteQuery(publicProjectDirectoryQueryOptions(locale, "hackathon", sort, { hackathonId: contest.id, trackIds: tracks, sectorIds: sectors, techStackIds: tech, winnerProjectIds: (contest.winner_awards ?? []).map((award) => award.project_id) }));
  const winnerOrder = useMemo(() => new Map((contest.winner_awards ?? []).map((award) => [award.project_id, award.sort_order])), [contest.winner_awards]);
  const awards = useMemo(() => new Map((contest.winner_awards ?? []).map((award) => [award.project_id, award.label])), [contest.winner_awards]);
  const projects = useMemo(() => [...(query.data?.pages.flatMap((page) => page.items) ?? [])].sort((a, b) => (winnerOrder.get(a.project.id) ?? Number.MAX_SAFE_INTEGER) - (winnerOrder.get(b.project.id) ?? Number.MAX_SAFE_INTEGER)), [query.data?.pages, winnerOrder]);
  const toggle = (key: string, id: string) => {
    const next = new URLSearchParams(params);
    const values = read(key);
    const updated = values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
    if (updated.length) next.set(key, updated.join(",")); else next.delete(key);
    setParams(next);
  };
  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-semibold text-foreground">{t("public.projects.filters")}</h2>
          <label className="text-sm text-foreground-muted">{t("public.projects.sort")}<select className="ml-2 min-h-11 rounded-md border border-border bg-background px-3 text-foreground" value={sort} onChange={(event) => { const next = new URLSearchParams(params); next.set("sort", event.target.value); setParams(next); }}><option value="newest">{t("public.projects.newest")}</option><option value="oldest">{t("public.projects.oldest")}</option></select></label>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <FilterGroup label={t("public.projects.tracks")} options={(contest.tracks ?? []) as ContestTrack[]} selected={tracks} toggle={(id) => toggle("tracks", id)} />
          <FilterGroup label={t("public.projects.sectors")} options={contest.sectors ?? []} selected={sectors} toggle={(id) => toggle("sectors", id)} />
          <FilterGroup label={t("public.projects.techStacks")} options={contest.tech_stacks ?? []} selected={tech} toggle={(id) => toggle("tech", id)} />
        </div>
      </section>

      {query.isPending ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <ProjectCardSkeleton key={index} />)}</div> : projects.length === 0 ? <EmptyTab icon={<Package className="size-6" />} title={t("public.empty.projects")} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.map(({ project, owner }) => <div key={project.id} className="relative">{awards.has(project.id) ? <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow"><Sparkles className="size-3" />{awards.get(project.id)}</div> : null}<ProjectCard project={project} ownerLabel={owner?.full_name ?? owner?.username} ownerHandle={owner?.username ?? owner?.ocid} /></div>)}</div>
          {query.hasNextPage ? <div className="flex justify-center"><Button type="button" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t("public.projects.loading") : t("public.projects.loadMore")}</Button></div> : null}
        </>
      )}
      <div className="text-center"><Button render={<NavLink to={`/projects?hackathon=${encodeURIComponent(contest.slug ?? "")}`} />} nativeButton={false} variant="ghost">{t("public.projects.openCatalog")}</Button></div>
    </div>
  );
}
