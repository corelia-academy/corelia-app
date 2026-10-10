import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  CalendarDots,
  CaretDown,
  Coins,
  FolderOpen,
  Package,
  Sparkle,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useOutletContext, useSearchParams } from "react-router";

import { EmptyState, PageSectionCard } from "@/components/layouts/PagePrimitives";
import { Markdown } from "@/components/markdown/Markdown";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import {
  publicProjectDirectoryQueryOptions,
  publicProjectTeamsQueryOptions,
} from "@/features/projects/projectQueries";
import { useAuth } from "@/stores/authStore";
import { projectHeartsQueryOptions } from "@/features/projects/projectSocialQueries";
import { canEditContestProject } from "@/lib/hackathons";
import type { HackathonOutletContext } from "./ContestPublicLayout";
import { ContestPreparationCard } from "./components/ContestPreparationCard";
import { formatPrizeAmount } from "./utils/formatPrizeAmount";
import { formatVietnamDateTime } from "./utils/formatVietnamDateTime";
import { listProjectTaxonomyOptions, projectTaxonomyNames } from "@/lib/projectTaxonomy";

const HACKATHON_TAB_TITLE_CLASS =
  "text-heading-large font-display text-foreground";

function EmptyTab({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <EmptyState
      icon={<span className="text-foreground-subtle">{icon}</span>}
      title={<span className="font-normal text-foreground-muted">{title}</span>}
      className="min-h-56 justify-center rounded-2xl border border-dashed border-border bg-surface-base p-8"
    />
  );
}

function HackathonProjectSidebar() {
  const { contest, registration, submission, submissionLoading, submissionClosed } = useOutletContext<HackathonOutletContext>();
  const { t } = useTranslation("contests");
  const projectCanEdit = Boolean(submission?.project_id && canEditContestProject(contest));
  const projectPath = submission?.project_id
    ? projectCanEdit
      ? `/projects/${submission.project_id}/edit`
      : `/projects/${submission.project_id}`
    : null;

  return (
    <div className="min-w-0 space-y-0 xl:sticky xl:top-6 xl:z-40 xl:self-start">
      <aside data-hackathon-card className="min-w-0 flex flex-col gap-5 rounded-2xl border border-border bg-surface-base p-5 xl:px-4 xl:py-3">
        <div className="flex flex-col gap-2">
          <h2 data-hackathon-card-title className="font-display text-base font-medium leading-6 tracking-[-0.32px] text-foreground">{t("public.myProject.title")}</h2>
          <Separator />
        </div>
        {!registration ? (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-foreground-muted xl:leading-[1.4] xl:tracking-[0.28px]">{t("public.myProject.registerRequiredDescription")}</p>
            <Button type="button" variant="cta" hierarchy="secondary" size="small" data-hackathon-control className="w-full rounded-lg" disabled>{t("public.myProject.registerRequired")}</Button>
          </div>
        ) : submissionLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label={t("public.myProject.loading")}>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : projectPath ? (
          <div className="space-y-5">
            <p className="break-words text-sm font-medium text-foreground xl:leading-[1.4] xl:tracking-[0.28px]">{submission?.title || t("public.myProject.untitled")}</p>
            <Button render={<NavLink to={projectPath} />} nativeButton={false} variant="cta" hierarchy="secondary" size="small" data-hackathon-control className="w-full rounded-lg">{projectCanEdit ? t("public.myProject.edit") : t("public.myProject.view")}</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-foreground-muted xl:leading-[1.4] xl:tracking-[0.28px]">{t("public.myProject.emptyDescription")}</p>
            {submissionClosed ? (
              <Button type="button" variant="cta" hierarchy="secondary" size="small" data-hackathon-control className="w-full rounded-lg" disabled>{t("public.submissionClosed")}</Button>
            ) : (
              <Button render={<NavLink to={`/projects/new?hackathon=${encodeURIComponent(contest.slug ?? "")}`} />} nativeButton={false} variant="cta" hierarchy="primary" size="small" data-hackathon-control className="w-full rounded-lg capitalize">{t("public.myProject.create")}</Button>
            )}
          </div>
        )}
      </aside>
      {contest.slug && contest.status !== "draft" ? (
        <div className="mx-4 sm:mx-0">
          <Separator className="my-6" />
          <ContestPreparationCard contest={contest} />
        </div>
      ) : null}
    </div>
  );
}

function HackathonPublicTabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-12">
      <div className="min-w-0 px-4 sm:px-0">{children}</div>
      <HackathonProjectSidebar />
    </div>
  );
}

export function HackathonOverviewTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t } = useTranslation("contests");
  const location = useLocation();
  const content = contest.description_markdown || contest.description || "";
  const summary = contest.short_description || contest.tagline || "";
  useEffect(() => {
    if (location.hash !== "#overview-content") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("overview-content")?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);
  return (
    <HackathonPublicTabLayout>
      <section id="overview-content" className="min-w-0 scroll-mt-32">
        <h2 data-hackathon-title data-hackathon-overview-title className={HACKATHON_TAB_TITLE_CLASS}>{t("public.overview.description")}</h2>
        {summary && !content.includes(summary) ? <p className="mt-4 max-w-prose text-sm leading-6 text-foreground-muted sm:text-base sm:leading-[1.4] sm:tracking-[0.32px] xl:mt-6">{summary}</p> : null}
        {content ? <div data-hackathon-overview-body className="mt-4 min-w-0 [overflow-wrap:anywhere] xl:mt-6"><Markdown content={content} /></div> : !summary ? <p className="mt-4 text-sm text-foreground-muted">{t("public.empty.overview")}</p> : null}
      </section>
    </HackathonPublicTabLayout>
  );
}

export function HackathonPrizesTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t, i18n } = useTranslation("contests");
  const formatAmount = (amount: string) => formatPrizeAmount(amount, i18n.resolvedLanguage ?? i18n.language);
  const pool = contest.prize_pool;
  const tracks = [...(contest.tracks ?? [])].filter((track) => track.active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (!pool && tracks.length === 0) {
    return (
      <HackathonPublicTabLayout>
        <EmptyTab icon={<Coins className="size-6" weight="duotone" />} title={t("public.empty.prizes")} />
      </HackathonPublicTabLayout>
    );
  }
  return (
    <HackathonPublicTabLayout>
      <div className="min-w-0 space-y-6">
        <h2 data-hackathon-title className={HACKATHON_TAB_TITLE_CLASS}>{t("public.prizes.structure")}</h2>
        {pool?.description_markdown ? (
          <div className="min-w-0">
            <Markdown content={pool.description_markdown} />
          </div>
        ) : pool ? (
          <PageSectionCard className="min-w-0 border-0 sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("public.prizes.total")}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere] sm:text-3xl">
              {formatAmount(pool.amount || "0")} <span className="text-base font-medium text-foreground-muted">{pool.currency}</span>
            </div>
          </PageSectionCard>
        ) : null}
        {tracks.length > 0 ? (
          <ol className="min-w-0 list-decimal space-y-5 pl-5 marker:text-foreground-muted">
            {tracks.map((track) => (
              <li key={track.id} className="min-w-0 pl-1">
                <article className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <h3 className="min-w-0 break-words text-heading-small font-display text-foreground">{track.name}</h3>
                    {track.prize_amount ? <span className="font-semibold text-primary tabular-nums [overflow-wrap:anywhere]">{formatAmount(track.prize_amount)} {pool?.currency}</span> : null}
                  </div>
                  {track.description ? <div className="mt-3 break-words text-foreground-muted"><Markdown content={track.description} compact /></div> : null}
                </article>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </HackathonPublicTabLayout>
  );
}

export function HackathonTimelineTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t, i18n } = useTranslation("contests");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const timeline = [...(contest.timeline ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.starts_at.localeCompare(b.starts_at));
  if (timeline.length === 0) {
    return (
      <HackathonPublicTabLayout>
        <EmptyTab icon={<CalendarDots className="size-6" weight="duotone" />} title={t("public.empty.timeline")} />
      </HackathonPublicTabLayout>
    );
  }
  const getDateTimeParts = (value: string): [string, string] => {
    const [date = "", time = ""] = formatVietnamDateTime(value, locale, { includeTimezone: false }).split(" · ");
    return [date, time];
  };
  const steps = timeline.map((item) => {
    const [startDate, startTime] = getDateTimeParts(item.starts_at);
    const [endDate, endTime] = item.ends_at ? getDateTimeParts(item.ends_at) : ["", ""];
    return {
      id: item.id,
      state: "Default" as const,
      title: (
        <div className="flex flex-col gap-[6px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-[1.4] tracking-[0.28px] text-foreground-subtle">
            <time dateTime={item.starts_at}>{startDate}{endDate && endDate !== startDate ? ` – ${endDate}` : ""}</time>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <span>{startTime}{item.ends_at ? ` – ${endTime}` : ""} ICT (UTC+7)</span>
          </div>
          <h3 className="font-display text-[18px] font-medium leading-[1.2] text-hackathon-timeline-title">{item.title}</h3>
          {item.description_markdown ? <div className="text-sm font-normal leading-[1.4] tracking-[0.28px] text-foreground-subtle"><Markdown content={item.description_markdown} compact /></div> : null}
        </div>
      ),
    };
  });
  return (
    <HackathonPublicTabLayout>
      <section className="min-w-0">
        <h2 data-hackathon-title className={HACKATHON_TAB_TITLE_CLASS}>{t("detail.sections.timeline")}</h2>
        <Stepper
          aria-label={t("detail.sections.timeline")}
          orientation="Vertical"
          markerStyle="Icon"
          animated={false}
          steps={steps}
          className="mt-6 [&>li]:min-h-[120px] [&>li]:items-stretch [&_[data-slot=stepper-track]]:h-auto [&_[data-slot=stepper-track]]:min-h-[120px] [&_[data-slot=stepper-content]]:flex [&_[data-slot=stepper-content]]:flex-col [&_[data-slot=stepper-content]]:justify-center [&_[data-slot=stepper-content]>div:first-child]:overflow-visible [&_[data-slot=stepper-content]>div:first-child]:whitespace-normal"
        />
      </section>
    </HackathonPublicTabLayout>
  );
}

export function HackathonResourcesTab() {
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t } = useTranslation("contests");
  if (!contest.resources_markdown?.trim()) {
    return (
      <HackathonPublicTabLayout>
        <EmptyTab icon={<FolderOpen className="size-6" weight="duotone" />} title={t("public.empty.resources")} />
      </HackathonPublicTabLayout>
    );
  }
  return (
    <HackathonPublicTabLayout>
      <section className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
        <h2 data-hackathon-title className={HACKATHON_TAB_TITLE_CLASS}>
          {t("public.tabs.resources")}
        </h2>

        <div
          className="
            min-w-0 [overflow-wrap:anywhere]
            [&>div]:space-y-[10px] [&>div]:text-base [&>div]:leading-[1.4]
            [&>div]:tracking-[0.32px] [&>div]:text-foreground
            [&_h1]:mt-0 [&_h1]:text-[18px] [&_h1]:leading-[1.2]
            [&_h1]:text-hackathon-timeline-title
            [&_h2]:mt-0 [&_h2]:text-[18px] [&_h2]:leading-[1.2]
            [&_h2]:text-hackathon-timeline-title
            [&_h3]:mt-0 [&_h3]:text-[18px] [&_h3]:leading-[1.2]
            [&_h3]:text-hackathon-timeline-title
            [&_ol]:space-y-0 [&_ol]:pl-[27px]
            [&_ol>li]:font-display [&_ol>li]:text-[18px] [&_ol>li]:leading-[1.2]
            [&_ol>li]:text-hackathon-timeline-title
            [&_ul]:space-y-0 [&_ul]:pl-[14px]
            [&_ul>li]:text-base [&_ul>li]:leading-[1.4]
            [&_ul>li]:tracking-[0.32px] [&_ul>li]:text-foreground
            [&_a]:text-primary [&_a]:no-underline
          "
        >
          <Markdown content={contest.resources_markdown} />
        </div>
      </section>
    </HackathonPublicTabLayout>
  );
}

export function HackathonProjectsTab() {
  const { user } = useAuth();
  const { contest } = useOutletContext<HackathonOutletContext>();
  const { t, i18n } = useTranslation("contests");
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const taxonomyQuery = useQuery({ queryKey: ["projects", "taxonomy", locale], queryFn: () => listProjectTaxonomyOptions(locale), staleTime: 5 * 60_000 });
  const systemTaxonomy = useMemo(
    () => taxonomyQuery.data ?? [],
    [taxonomyQuery.data],
  );
  const read = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const tracks = read("tracks");
  const sectors = read("sectors");
  const tech = read("tech");
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
  const query = useInfiniteQuery(publicProjectDirectoryQueryOptions(locale, "hackathon", sort, { hackathonId: contest.id, trackIds: tracks, sectorIds: sectors, techStackIds: tech, winnerProjectIds: (contest.winner_awards ?? []).map((award) => award.project_id) }));
  const winnerOrder = useMemo(() => new Map((contest.winner_awards ?? []).map((award) => [award.project_id, award.sort_order])), [contest.winner_awards]);
  const awards = useMemo(() => new Map((contest.winner_awards ?? []).map((award) => [award.project_id, award.label])), [contest.winner_awards]);
  const projects = useMemo(() => [...(query.data?.pages.flatMap((page) => page.items) ?? [])].sort((a, b) => (winnerOrder.get(a.project.id) ?? Number.MAX_SAFE_INTEGER) - (winnerOrder.get(b.project.id) ?? Number.MAX_SAFE_INTEGER)), [query.data?.pages, winnerOrder]);
  const filteredProjects = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale);
    if (!term) return projects;

    return projects.filter(({ project, owner }) => {
      const technologyNames = projectTaxonomyNames(
        project.hackathon_tech_stack_ids ?? [],
        project.custom_tech_stack_names ?? [],
        systemTaxonomy.filter((item) => item.kind === "technology"),
        contest.tech_stacks ?? [],
      );
      return [
        project.title,
        project.summary,
        ...technologyNames,
        owner?.full_name,
        owner?.username,
        owner?.ocid,
      ].some((value) => value?.toLocaleLowerCase(locale).includes(term));
    });
  }, [contest.tech_stacks, locale, projects, search, systemTaxonomy]);
  const teamsQuery = useQuery(publicProjectTeamsQueryOptions(projects.map((item) => item.project.id)));
  const hearts = useQuery(projectHeartsQueryOptions(user?.id, projects.map(item => item.project.id)));
  return (
    <HackathonPublicTabLayout>
      <div className="min-w-0 space-y-4 sm:space-y-8">
        <section className="min-w-0 space-y-6">
          <div className="flex flex-col gap-2">
            <h2 data-hackathon-title className={HACKATHON_TAB_TITLE_CLASS}>
              {t("public.projects.title")}
              <span className="ml-2 text-body-large font-body font-normal text-foreground-subtle">
                {t("public.projects.count", { count: filteredProjects.length })}
              </span>
            </h2>
            <p className="text-body-large text-foreground-muted">
              {t("public.projects.description")}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,520px)_minmax(0,1fr)] sm:items-center">
            <Input
              type="search"
              variant="icon-leading"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={t("public.projects.searchPlaceholder")}
              aria-label={t("public.projects.searchPlaceholder")}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                aria-label={t("public.projects.sort")}
                className="group/sort-menu flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-lg text-left font-body text-body-large text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span>
                  {sort === "newest"
                    ? t("public.projects.newest")
                    : t("public.projects.oldest")}
                </span>
                <CaretDown
                  className="size-5 shrink-0 text-foreground-muted transition-transform duration-200 group-data-[popup-open]/sort-menu:rotate-180"
                  weight="duotone"
                  aria-hidden
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => {
                    if (value !== "newest" && value !== "oldest") return;
                    const next = new URLSearchParams(params);
                    if (value === "oldest") next.set("sort", "oldest");
                    else next.delete("sort");
                    setParams(next, { preventScrollReset: true });
                  }}
                >
                  <DropdownMenuRadioItem className="text-body-large" value="newest">
                    {t("public.projects.newest")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem className="text-body-large" value="oldest">
                    {t("public.projects.oldest")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        {query.isPending ? <div className="grid gap-6 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <ProjectCardSkeleton key={index} />)}</div> : query.isError ? <div role="alert" className="py-8 text-center"><p>{t("detail.errors.loadFailed")}</p><Button className="mt-3" onClick={() => void query.refetch()}>{t("projects.retry", { ns: "common" })}</Button></div> : filteredProjects.length === 0 ? <EmptyTab icon={<Package className="size-6" weight="duotone" />} title={t("public.empty.projects")} /> : (
          <>
            <div className="grid gap-6 sm:grid-cols-2">{filteredProjects.map(({ project, owner }) => <div key={project.id} className="relative">{awards.has(project.id) ? <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow"><Sparkle className="size-3" weight="duotone" />{awards.get(project.id)}</div> : null}<ProjectCard variant="hackathon" phosphorDuotone systemTaxonomy={systemTaxonomy} hearted={hearts.data?.has(project.id) ?? false} taxonomy={contest} project={project} ownerLabel={owner?.full_name ?? owner?.username} ownerHandle={owner?.username ?? owner?.ocid} ownerAvatarUrl={owner?.avatar_url} ownerAvatarSeed={owner?.avatar_seed} ownerAvatarConfig={owner?.avatar_config} teamMembers={teamsQuery.data?.[project.id] ?? []} /></div>)}</div>
            {query.hasNextPage ? <div className="flex justify-center"><Button type="button" variant="cta" hierarchy="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t("public.projects.loading") : t("public.projects.loadMore")}</Button></div> : null}
          </>
        )}
        <div className="text-center"><Button render={<NavLink to={`/projects?hackathon=${encodeURIComponent(contest.slug ?? "")}`} />} nativeButton={false} variant="cta" hierarchy="tertiary">{t("public.projects.openCatalog")}</Button></div>
      </div>
    </HackathonPublicTabLayout>
  );
}
