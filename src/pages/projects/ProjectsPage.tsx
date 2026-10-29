import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ShieldAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { FullPageEmptyState } from "@/components/layouts/FullPageEmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { Button } from "@/components/ui/button";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSearch,
  DropdownMenuSelectAll,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import {
  publicProjectCountQueryOptions,
  publicProjectDirectoryQueryOptions,
  publicProjectTeamsQueryOptions,
} from "@/features/projects/projectQueries";
import type { PublicProjectEntry, PublicProjectSort } from "@/lib/projects";
import { projectHeartsQueryOptions } from "@/features/projects/projectSocialQueries";
import { projectSavesQueryOptions } from "@/features/projects/projectSaveQueries";
import { useAuth } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import type { HackathonTaxonomyOption, HackathonWinnerAward } from "@/types/hackathons";
import { listProjectTaxonomyOptions } from "@/lib/projectTaxonomy";
import { winnerProjectOrder } from "@/lib/hackathonContract";

type FilterOption = Pick<HackathonTaxonomyOption, "id" | "name"> & { active?: boolean };

function csv(value: string | null): string[] {
  return Array.from(new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean)));
}

type ProjectDirectoryChoice = PublicProjectSort | "liked";

function sortParam(value: string | null): ProjectDirectoryChoice {
  if (value === "liked" || value === "oldest" || value === "most_liked") return value;
  return "newest";
}

function TaxonomyFilter({
  label,
  options,
  selected,
  onChange,
  searchLabel,
  allLabel,
  noResultsLabel,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchLabel: string;
  allLabel: string;
  noResultsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeOptions = options.filter((option) => option.active !== false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = activeOptions.filter((option) =>
    option.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const selectedVisibleCount = visibleOptions.filter((option) =>
    selected.includes(option.id),
  ).length;
  const allVisibleSelected =
    visibleOptions.length > 0 && selectedVisibleCount === visibleOptions.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  if (activeOptions.length === 0) return null;

  function updateVisibleSelection(checked: boolean) {
    const visibleIds = new Set(visibleOptions.map((option) => option.id));
    onChange(
      checked
        ? Array.from(new Set([...selected, ...visibleIds]))
        : selected.filter((id) => !visibleIds.has(id)),
    );
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DropdownMenuTriggerWithIndicator
        type="button"
        aria-label={label}
        aria-expanded={open}
        trailingContent={selected.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 text-primary" aria-hidden>
            {selected.length}
          </span>
        ) : undefined}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="min-w-0 truncate">{label}</span>
      </DropdownMenuTriggerWithIndicator>
      <DropdownMenuContent
        layout="multiple-list"
        align="start"
        className="max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuSearch>
          <Input
            type="search"
            variant="icon-leading"
            leadingIconClassName="text-dropdown-supporting"
            statusIcon={null}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={searchLabel}
            aria-label={`${searchLabel} ${label}`}
            controlClassName="h-10 gap-sm rounded-lg border-dropdown-input-border bg-dropdown-surface px-md focus-within:ring-dropdown-focus"
            className="text-body-large text-dropdown-title placeholder:text-dropdown-supporting"
          />
        </DropdownMenuSearch>
        <DropdownMenuSelectAll
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected}
          disabled={visibleOptions.length === 0}
          label={allLabel}
          onCheckedChange={(checked) => updateVisibleSelection(checked === true)}
        />
        <DropdownMenuList>
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={selected.includes(option.id)}
                size="compact"
                onCheckedChange={(checked, eventDetails) => {
                  eventDetails.cancel();
                  onChange(
                    checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id),
                  );
                }}
              >
                <DropdownMenuItemContent>{option.name}</DropdownMenuItemContent>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-body-small text-dropdown-supporting">
              {noResultsLabel}
            </p>
          )}
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function winnerFirst(items: PublicProjectEntry[], awards: HackathonWinnerAward[]): PublicProjectEntry[] {
  const order = winnerProjectOrder(awards);
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
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const hackathonParam = params.get("hackathon")?.trim() ?? "";
  const normalizedHackathonSlug = hackathonParam.toLowerCase();
  const trackIds = csv(params.get("tracks"));
  const sectorIds = csv(params.get("sectors"));
  const techStackIds = csv(params.get("tech"));
  const sortChoice = sortParam(params.get("sort"));
  const sort: PublicProjectSort = sortChoice === "liked" ? "newest" : sortChoice;
  const [hackathonDropdownOpen, setHackathonDropdownOpen] = useState(false);
  const [hackathonSearch, setHackathonSearch] = useState("");

  const hackathonsQuery = useQuery(publicHackathonCatalogQueryOptions(locale));
  const taxonomyQuery = useQuery({ queryKey: ["projects", "taxonomy", locale], queryFn: () => listProjectTaxonomyOptions(locale), staleTime: 5 * 60_000 });
  const systemTaxonomy = taxonomyQuery.data ?? [];
  const filterOptions = (kind: "sector" | "technology", legacy: FilterOption[]) => {
    const system = systemTaxonomy.filter((item) => item.kind === kind);
    const known = new Set(system.map((item) => item.id));
    return [...system, ...legacy.filter((item) => !known.has(item.id))];
  };
  const hackathons = useMemo(() => hackathonsQuery.data ?? [], [hackathonsQuery.data]);
  const visibleHackathons = useMemo(() => {
    const normalizedSearch = hackathonSearch.trim().toLocaleLowerCase();
    return normalizedSearch
      ? hackathons.filter((hackathon) =>
          hackathon.title.toLocaleLowerCase().includes(normalizedSearch),
        )
      : hackathons;
  }, [hackathons, hackathonSearch]);
  const selectedHackathon = useMemo(
    () =>
      normalizedHackathonSlug
        ? hackathons.find(
            (item) => (item.slug ?? "").toLowerCase() === normalizedHackathonSlug,
          ) ?? null
        : null,
    [hackathons, normalizedHackathonSlug],
  );

  useEffect(() => {
    if (selectedHackathon?.slug && hackathonParam && hackathonParam !== selectedHackathon.slug) {
      const next = new URLSearchParams(params);
      next.set("hackathon", selectedHackathon.slug);
      setParams(next, { replace: true });
    }
  }, [selectedHackathon?.slug, hackathonParam, params, setParams]);

  const allWinnerAwards = useMemo(() => {
    if (selectedHackathon) {
      return selectedHackathon.winner_awards ?? [];
    }
    return hackathons.flatMap((h) => h.winner_awards ?? []);
  }, [selectedHackathon, hackathons]);

  const likedProjectIdsQuery = useQuery(
    projectHeartsQueryOptions(user?.id, [], sortChoice === "liked"),
  );
  const likedProjectIds = sortChoice === "liked" && likedProjectIdsQuery.data
    ? Array.from(likedProjectIdsQuery.data).sort()
    : undefined;

  const directoryOptions = publicProjectDirectoryQueryOptions(locale, "all", sort, {
    hackathonId: selectedHackathon?.id ?? null,
    trackIds,
    sectorIds,
    techStackIds,
    winnerProjectIds: sortChoice === "liked" || sortChoice === "most_liked"
      ? []
      : allWinnerAwards.map((award) => award.project_id),
    likedProjectIds,
  });
  const projectsQuery = useInfiniteQuery({
    ...directoryOptions,
    enabled:
      (!hackathonParam || Boolean(selectedHackathon)) &&
      (sortChoice !== "liked" || Boolean(user?.id && likedProjectIdsQuery.isSuccess)),
  });
  const projectCountQuery = useQuery(publicProjectCountQueryOptions());
  const items = useMemo(
    () => {
      const pageItems = projectsQuery.data?.pages.flatMap((page) => page.items) ?? [];
      return sortChoice === "liked" || sortChoice === "most_liked"
        ? pageItems
        : winnerFirst(pageItems, allWinnerAwards);
    },
    [projectsQuery.data?.pages, allWinnerAwards, sortChoice],
  );
  const teamsQuery = useQuery(publicProjectTeamsQueryOptions(items.map((item) => item.project.id)));

  const hearts = useQuery(projectHeartsQueryOptions(user?.id, items.map(item => item.project.id)));
  const saves = useQuery(projectSavesQueryOptions(user?.id, items.map(item => item.project.id)));
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

  useEffect(() => {
    if (sortChoice === "liked" && !user) {
      toast.message(t("projects.social.loginToInteract"));
      update("sort", "newest");
    }
  }, [sortChoice, user, t, update]);

  const error = projectsQuery.isError || hackathonsQuery.isError || (sortChoice === "liked" && likedProjectIdsQuery.isError) ? t("projects.errorDescription") : hackathonParam && hackathonsQuery.isSuccess && !selectedHackathon ? t("projects.errors.hackathonMissing") : null;
  const hasProjectFilters = Boolean(
    hackathonParam || trackIds.length || sectorIds.length || techStackIds.length || sortChoice === "liked",
  );
  const showDirectoryEmpty = !projectsQuery.isPending && !error && items.length === 0;
  const showFullPageEmpty =
    !projectsQuery.isPending &&
    !error &&
    items.length === 0 &&
    !hasProjectFilters &&
    hackathonsQuery.isSuccess &&
    projectCountQuery.isSuccess &&
    hackathons.length === 0 &&
    projectCountQuery.data === 0;

  if (showFullPageEmpty) {
    return (
      <FullPageEmptyState
        title={t("projects.emptyTitle")}
        description={t("projects.emptyStartDescription")}
      />
    );
  }

  return (
    <div
      className={cn(
        "course-catalog-page container-app pb-8 pt-6 sm:py-8",
        showDirectoryEmpty && "flex min-h-[calc(100svh-var(--app-header-height))] flex-col",
      )}
    >
      <main
        className={cn(
          "course-catalog mx-auto w-full max-w-[1072px]",
          showDirectoryEmpty && "flex flex-1 flex-col",
        )}
      >
      <header className="mb-6">
        <div>
          <h1 className="text-heading-large font-display text-foreground">
            {t("projects.title")}
            {projectCountQuery.isSuccess ? (
              <span className="ml-2 text-body-large font-body font-normal text-foreground-subtle">
                ({projectCountQuery.data})
              </span>
            ) : null}
          </h1>
          <p className="mt-2 text-body-large text-catalog-subtitle">{t("projects.description")}</p>
        </div>
        {/* Temporarily hidden because this action is not present in the Figma design.
        <Button variant="cta" hierarchy="secondary" render={<NavLink to="/account/projects" />} nativeButton={false}>{t("projects.editor.myProjects")}</Button>
        */}
      </header>

      <section className="course-catalog-filters space-y-5">
        <div className="grid w-full max-w-[1072px] grid-cols-1 gap-2 xl:grid-cols-[520px_352px_auto] xl:items-center">
          <DropdownMenu
            open={hackathonDropdownOpen}
            onOpenChange={(nextOpen) => {
              setHackathonDropdownOpen(nextOpen);
              if (!nextOpen) setHackathonSearch("");
            }}
          >
            <DropdownMenuTriggerWithIndicator
              type="button"
              aria-label={t("projects.filters.hackathon")}
              aria-expanded={hackathonDropdownOpen}
              className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="min-w-0 truncate">
                {selectedHackathon?.title ?? t("projects.filters.allHackathons")}
              </span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent
              layout="multiple-list"
              align="start"
              className="w-(--anchor-width) max-w-[calc(100vw-2rem)]"
            >
              <DropdownMenuSearch>
                <Input
                  type="search"
                  variant="icon-leading"
                  leadingIconClassName="text-dropdown-supporting"
                  statusIcon={null}
                  value={hackathonSearch}
                  onChange={(event) => setHackathonSearch(event.currentTarget.value)}
                  placeholder={t("pageTitles.search")}
                  aria-label={`${t("pageTitles.search")} ${t("projects.filters.hackathon")}`}
                  controlClassName="h-10 gap-sm rounded-lg border-dropdown-input-border bg-dropdown-surface px-md focus-within:ring-dropdown-focus"
                  className="text-body-large text-dropdown-title placeholder:text-dropdown-supporting"
                />
              </DropdownMenuSearch>
              <DropdownMenuList>
                <DropdownMenuRadioGroup
                  value={selectedHackathon?.slug ?? ""}
                  onValueChange={(value) => {
                    update("hackathon", value);
                    setHackathonDropdownOpen(false);
                    setHackathonSearch("");
                  }}
                >
                  <DropdownMenuRadioItem className="text-body-large" value="">
                    <DropdownMenuItemContent>
                      {t("projects.filters.allHackathons")}
                    </DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                  {visibleHackathons.map((hackathon) => (
                    <DropdownMenuRadioItem
                      key={hackathon.id}
                      className="text-body-large"
                      value={hackathon.slug ?? ""}
                    >
                      <DropdownMenuItemContent>{hackathon.title}</DropdownMenuItemContent>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {visibleHackathons.length === 0 ? (
                  <p className="px-3 py-6 text-center text-body-small text-dropdown-supporting">
                    {t("search.empty")}
                  </p>
                ) : null}
              </DropdownMenuList>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTriggerWithIndicator
              type="button"
              aria-label={t("projects.sort.label")}
              className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="min-w-0 truncate">
                {sortChoice === "liked"
                  ? t("projects.sort.liked")
                  : sortChoice === "most_liked"
                    ? t("projects.sort.mostLiked")
                    : sortChoice === "oldest"
                      ? t("projects.sort.oldest")
                      : t("projects.sort.newest")}
              </span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent
              layout="multiple-list"
              align="start"
              className="w-(--anchor-width) max-w-[calc(100vw-2rem)]"
            >
              <DropdownMenuList>
                <DropdownMenuRadioGroup
                  value={sortChoice}
                  onValueChange={(value) => {
                    if (value === "liked" && !user) {
                      toast.message(t("projects.social.loginToInteract"));
                      return;
                    }
                    update("sort", value);
                  }}
                >
                  <DropdownMenuRadioItem className="text-body-large" value="newest">
                    <DropdownMenuItemContent>{t("projects.sort.newest")}</DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem className="text-body-large" value="oldest">
                    <DropdownMenuItemContent>{t("projects.sort.oldest")}</DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem className="text-body-large" value="most_liked">
                    <DropdownMenuItemContent>{t("projects.sort.mostLiked")}</DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem className="text-body-large" value="liked">
                    <DropdownMenuItemContent>{t("projects.sort.liked")}</DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuList>
            </DropdownMenuContent>
          </DropdownMenu>
          {(hackathonParam || trackIds.length || sectorIds.length || techStackIds.length || sortChoice !== "newest") ? (
            <Button
              type="button"
              variant="cta"
              hierarchy="tertiary"
              size="small"
              className="w-fit justify-self-start"
              onClick={() => setParams(new URLSearchParams())}
            >
              <X className="size-4" />
              {t("projects.editor.clearFilters")}
            </Button>
          ) : null}
        </div>

        {selectedHackathon ? (
          <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-3">
            <TaxonomyFilter
              label={t("projects.filters.tracks")}
              options={selectedHackathon.tracks ?? []}
              selected={trackIds}
              onChange={(ids) => update("tracks", ids)}
              searchLabel={t("pageTitles.search")}
              allLabel={t("projects.filters.all")}
              noResultsLabel={t("search.empty")}
            />
            <TaxonomyFilter
              label={t("projects.filters.sectors")}
              options={filterOptions("sector", selectedHackathon.sectors ?? [])}
              selected={sectorIds}
              onChange={(ids) => update("sectors", ids)}
              searchLabel={t("pageTitles.search")}
              allLabel={t("projects.filters.all")}
              noResultsLabel={t("search.empty")}
            />
            <TaxonomyFilter
              label={t("projects.filters.techStacks")}
              options={filterOptions("technology", selectedHackathon.tech_stacks ?? [])}
              selected={techStackIds}
              onChange={(ids) => update("tech", ids)}
              searchLabel={t("pageTitles.search")}
              allLabel={t("projects.filters.all")}
              noResultsLabel={t("search.empty")}
            />
          </div>
        ) : null}
      </section>

      <div className={cn("mt-6", showDirectoryEmpty && "flex flex-1")}>
        {projectsQuery.isPending && !error ? (
          <div className="mobile-bleed-grid grid gap-6 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <ProjectCardSkeleton key={index} />)}</div>
        ) : error && items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center" role="alert">
            <ShieldAlert className="size-8 text-foreground-subtle" aria-hidden />
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button
              type="button"
              onClick={() => {
                void projectsQuery.refetch();
                void hackathonsQuery.refetch();
                if (sortChoice === "liked") void likedProjectIdsQuery.refetch();
              }}
            >
              {t("projects.retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-14 text-center">
            <EmptyStateIllustration
              type="search"
              size="medium"
              title={t(hasProjectFilters ? "search.emptyTitle" : "projects.emptyTitle")}
              description={t(
                hasProjectFilters
                  ? "projects.emptyDescription"
                  : "projects.emptyStartDescription",
              )}
            />
          </div>
        ) : (
          <>
            <div className={cn("mobile-bleed-grid grid gap-6 transition-opacity sm:grid-cols-2", projectsQuery.isPlaceholderData && "opacity-60")} aria-busy={projectsQuery.isPlaceholderData || undefined}>
              {items.map(({ project, owner }) => (
                <ProjectCard
                  systemTaxonomy={systemTaxonomy}
                  key={project.id}
                  hearted={hearts.data?.has(project.id) ?? false}
                  saved={saves.data?.has(project.id) ?? false}
                  saveStateReady={saves.isSuccess && !saves.isPlaceholderData}
                  project={project}
                  taxonomy={hackathons.find((item) => item.id === project.source_id)}
                  ownerLabel={owner?.full_name ?? owner?.username}
                  ownerHandle={owner?.username ?? owner?.ocid}
                  ownerAvatarUrl={owner?.avatar_url}
                  ownerAvatarSeed={owner?.avatar_seed}
                  ownerAvatarConfig={owner?.avatar_config}
                  teamMembers={teamsQuery.data?.[project.id] ?? []}
                />
              ))}
            </div>
            {projectsQuery.hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="cta" hierarchy="secondary" disabled={projectsQuery.isFetchingNextPage} onClick={() => void projectsQuery.fetchNextPage()}>
                  {projectsQuery.isFetchingNextPage ? t("projects.loading") : t("projects.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      </main>
    </div>
  );
}
