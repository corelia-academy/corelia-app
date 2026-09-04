import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Package, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { Button } from "@/components/ui/button";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import { publicProjectDirectoryQueryOptions } from "@/features/projects/projectQueries";
import type { PublicProjectEntry, PublicProjectSort } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { HackathonTaxonomyOption, HackathonWinnerAward } from "@/types/hackathons";

type FilterOption = Pick<HackathonTaxonomyOption, "id" | "name"> & { active?: boolean };

function csv(value: string | null): string[] {
  return Array.from(new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean)));
}

function sortParam(value: string | null): PublicProjectSort {
  return value === "oldest" ? "oldest" : "newest";
}

function TaxonomyFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const activeOptions = options.filter((option) => option.active !== false);
  if (activeOptions.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {activeOptions.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={checked}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface-base text-foreground hover:bg-surface-raised",
              )}
              onClick={() =>
                onChange(
                  checked ? selected.filter((id) => id !== option.id) : [...selected, option.id],
                )
              }
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function winnerFirst(items: PublicProjectEntry[], awards: HackathonWinnerAward[]): PublicProjectEntry[] {
  const order = new Map(
    awards.map((award) => [award.project_id, award.sort_order]),
  );
  return [...items].sort((a, b) => {
    const aOrder = order.get(a.project.id);
    const bOrder = order.get(b.project.id);
    if (aOrder == null && bOrder == null) return 0;
    if (aOrder == null) return 1;
    if (bOrder == null) return -1;
    return aOrder - bOrder;
  });
}

export default function ProjectsPage() {
  const { t, i18n } = useTranslation("common");
  const [params, setParams] = useSearchParams();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const hackathonSlug = params.get("hackathon") ?? "";
  const trackIds = csv(params.get("tracks"));
  const sectorIds = csv(params.get("sectors"));
  const techStackIds = csv(params.get("tech"));
  const sort = sortParam(params.get("sort"));

  const hackathonsQuery = useQuery(publicHackathonCatalogQueryOptions(locale));
  const hackathons = hackathonsQuery.data ?? [];
  const selectedHackathon = hackathons.find((item) => item.slug === hackathonSlug) ?? null;

  const allWinnerAwards = useMemo(() => {
    if (selectedHackathon) {
      return selectedHackathon.winner_awards ?? [];
    }
    return hackathons.flatMap((h) => h.winner_awards ?? []);
  }, [selectedHackathon, hackathons]);

  const awardsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const award of allWinnerAwards) {
      map.set(award.project_id, award.label);
    }
    return map;
  }, [allWinnerAwards]);

  const projectsQuery = useInfiniteQuery(
    publicProjectDirectoryQueryOptions(locale, "all", sort, {
      hackathonId: selectedHackathon?.id ?? null,
      trackIds,
      sectorIds,
      techStackIds,
      winnerProjectIds: allWinnerAwards.map((award) => award.project_id),
    }),
  );
  const items = useMemo(
    () => winnerFirst(projectsQuery.data?.pages.flatMap((page) => page.items) ?? [], allWinnerAwards),
    [projectsQuery.data?.pages, allWinnerAwards],
  );

  const update = useCallback((key: string, value: string | string[]) => {
    const next = new URLSearchParams(params);
    const normalized = Array.isArray(value) ? value.join(",") : value;
    if (normalized) next.set(key, normalized);
    else next.delete(key);
    if (key === "hackathon") {
      next.delete("tracks");
      next.delete("sectors");
      next.delete("tech");
    }
    setParams(next);
  }, [params, setParams]);

  const error = projectsQuery.error instanceof Error ? projectsQuery.error.message : null;

  return (
    <div className="container-app py-6 sm:py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{t("projects.title")}</h1>
        </div>
        <p className="mt-1 text-sm text-foreground-muted">{t("projects.description")}</p>
      </header>

      <section className="space-y-5 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-foreground">
            {t("projects.filters.hackathon")}
            <select className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3" value={hackathonSlug} onChange={(event) => update("hackathon", event.target.value)}>
              <option value="">{t("projects.filters.allHackathons")}</option>
              {hackathons.map((hackathon) => <option key={hackathon.id} value={hackathon.slug ?? ""}>{hackathon.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground">
            {t("projects.sort.label")}
            <select className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3" value={sort} onChange={(event) => update("sort", event.target.value)}>
              <option value="newest">{t("projects.sort.newest")}</option>
              <option value="oldest">{t("projects.sort.oldest")}</option>
            </select>
          </label>
        </div>

        {selectedHackathon ? (
          <div className="grid gap-5 border-t border-border-subtle pt-5 lg:grid-cols-3">
            <TaxonomyFilter label={t("projects.filters.tracks")} options={selectedHackathon.tracks ?? []} selected={trackIds} onChange={(ids) => update("tracks", ids)} />
            <TaxonomyFilter label={t("projects.filters.sectors")} options={selectedHackathon.sectors ?? []} selected={sectorIds} onChange={(ids) => update("sectors", ids)} />
            <TaxonomyFilter label={t("projects.filters.techStacks")} options={selectedHackathon.tech_stacks ?? []} selected={techStackIds} onChange={(ids) => update("tech", ids)} />
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        {projectsQuery.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <ProjectCardSkeleton key={index} />)}</div>
        ) : error && items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center" role="alert">
            <ShieldAlert className="size-8 text-foreground-subtle" aria-hidden />
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button type="button" onClick={() => void projectsQuery.refetch()}>{t("projects.retry")}</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border-subtle bg-surface-base px-4 py-14 text-center shadow-card">
            <Package className="mx-auto size-8 text-foreground-subtle" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold text-foreground">{t("projects.emptyTitle")}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{t("projects.emptyDescription")}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ project, owner }) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  ownerLabel={owner?.full_name ?? owner?.username}
                  ownerHandle={owner?.username ?? owner?.ocid}
                  awardLabel={awardsMap.get(project.id)}
                />
              ))}
            </div>
            {projectsQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" disabled={projectsQuery.isFetchingNextPage} onClick={() => void projectsQuery.fetchNextPage()}>
                  {projectsQuery.isFetchingNextPage ? t("projects.loading") : t("projects.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
