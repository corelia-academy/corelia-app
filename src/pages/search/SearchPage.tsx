import { useMemo, useState, type ReactNode } from "react";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/imageUrl";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { FileText, TimerIcon } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Timestamp } from "@/components/ui/timestamp";
import { UserAvatar } from "@/components/UserAvatar";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import {
  createMockParticipantPreview,
  formatCompactParticipantCount,
  type ParticipantPreviewData,
} from "@/components/participants/participantPreview";
import {
  publicHackathonApplicantPreviewsQueryOptions,
  publicHackathonCatalogQueryOptions,
} from "@/features/hackathons/hackathonQueries";
import { ContestCatalogCard } from "@/features/hackathons/list/ContestCatalogCard";
import {
  publicProjectEntriesByIdsQueryOptions,
  publicProjectTeamsQueryOptions,
} from "@/features/projects/projectQueries";
import { projectHeartsQueryOptions } from "@/features/projects/projectSocialQueries";
import { projectSavesQueryOptions } from "@/features/projects/projectSaveQueries";
import {
  searchProfilesQueryOptions,
  searchResultsQueryOptions,
} from "@/features/search/searchQueries";
import { listProjectTaxonomyOptions } from "@/lib/projectTaxonomy";
import type { ProjectOwnerPublicProfile } from "@/lib/projects";
import type { SearchEntityType, SearchResultRow } from "@/lib/search";
import { useAuth } from "@/stores/authStore";
import { formatDuration, getCourseLevelLabel } from "@/types/courses";

const SEARCH_FILTERS = ["all", "course", "hackathon", "project", "profile"] as const;
const SECTION_ORDER: SearchEntityType[] = ["course", "hackathon", "project", "profile"];
// Each section reuses the grid of the entity's own catalog page.
const SECTION_GRID: Record<SearchEntityType, string> = {
  course: "grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3",
  hackathon: "grid gap-3 @container",
  project: "mobile-bleed-grid grid gap-6 sm:grid-cols-2",
  profile: "grid gap-x-6 sm:grid-cols-2",
};
const EMPTY_SEARCH_RESULTS: SearchResultRow[] = [];
type SearchFilter = "all" | SearchEntityType;

function idsOf(items: SearchResultRow[], type: SearchEntityType) {
  return items.filter((item) => item.entity_type === type).map((item) => item.entity_id);
}

function isSearchFilter(value: string): value is SearchFilter {
  return SEARCH_FILTERS.some((filter) => filter === value);
}

function useQueryParam(name: string): string {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(name) ?? "";
  }, [location.search, name]);
}

function SearchCourseResultCard({
  item,
  participantPreview,
}: {
  item: SearchResultRow;
  participantPreview: ParticipantPreviewData;
}) {
  const { t } = useTranslation("common");
  const [failedImage, setFailedImage] = useState(false);
  const course = item.course;

  if (!course) return null;

  return (
    <NavLink
      to={item.href}
      className="motion-hover-card block min-w-0 rounded-xl focus-visible:outline-primary"
    >
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-surface-raised">
        {course.thumbnail_url && !failedImage ? (
          <img
            src={optimizedImageUrl(course.thumbnail_url, { width: 400 })} srcSet={optimizedImageSrcSet(course.thumbnail_url, 400)}
            alt=""
            loading="lazy"
            onError={() => setFailedImage(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileText className="size-10 text-foreground-muted" aria-hidden weight="duotone" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 p-4">
        <h2 className="line-clamp-2 text-heading-medium! font-display font-medium leading-[1.2]! text-foreground">
          {item.title}
        </h2>
        <Timestamp
          type="full"
          size="medium"
          className="min-w-0 flex-wrap gap-3 whitespace-normal"
          date={(
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge size="xsmall" color="primary">
                {getCourseLevelLabel(course.level)}
              </Badge>
              {typeof item.lessonCount === "number" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                  <FileText className="size-4" aria-hidden weight="duotone" />
                  {t("home.meta.lessonCount", { count: item.lessonCount })}
                </span>
              ) : null}
            </span>
          )}
          time={(
            <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              <TimerIcon className="size-4" aria-hidden weight="duotone" />
              {formatDuration(Number(course.total_duration_seconds) || 0)}
            </span>
          )}
        />
        <ParticipantSummary
          count={participantPreview.count}
          participants={participantPreview.participants}
          summary={t("home.meta.learners", {
            displayCount: formatCompactParticipantCount(participantPreview.count),
          })}
        />
      </div>
    </NavLink>
  );
}

/** Plain row for results whose card data is unavailable (e.g. not in the public catalog). */
function SearchResultRowLink({ item }: { item: SearchResultRow }) {
  const { t } = useTranslation("common");
  return (
    <NavLink
      to={item.href}
      className="block rounded-lg bg-surface-base px-4 py-5 transition-colors duration-150 hover:bg-surface-raised"
    >
      <div className="min-w-0">
        <div className="line-clamp-2 text-base font-semibold text-foreground">
          {item.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
          <Chip size="xsmall" shape="circle">
            {t(`search.group.${item.entity_type}` as never, {
              defaultValue: item.entity_type,
            })}
          </Chip>
          {item.subtitle ? (
            <span className="truncate">{item.subtitle}</span>
          ) : null}
        </div>
      </div>
    </NavLink>
  );
}

/** Profile row in the same shape as the feed's people list (avatar, name, handle). */
function SearchProfileResultRow({
  item,
  profile,
}: {
  item: SearchResultRow;
  profile?: ProjectOwnerPublicProfile;
}) {
  const name = item.title.trim() || item.subtitle?.trim() || "Corelia";
  return (
    <NavLink
      to={item.href}
      className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-surface-raised"
    >
      <UserAvatar
        userId={item.entity_id}
        avatarUrl={profile?.avatar_url}
        avatarSeed={profile?.avatar_seed}
        avatarConfig={profile?.avatar_config}
        alt={name}
        fallback={name[0]?.toUpperCase() ?? "C"}
        className="size-9 shrink-0"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
        {item.subtitle ? (
          <span className="block truncate text-xs text-foreground-muted">@{item.subtitle}</span>
        ) : null}
      </span>
    </NavLink>
  );
}

function SearchSection({
  type,
  count,
  showHeading,
  children,
}: {
  type: SearchEntityType;
  count: number;
  showHeading: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  return (
    <section className="grid">
      {showHeading ? (
        <>
          <div className="flex min-h-6 items-center gap-2.5">
            <h2 className="course-catalog-section-title text-body-large font-medium text-foreground">
              {t(`search.group.${type}` as never, { defaultValue: type })}
            </h2>
            <Chip size="xsmall" shape="circle">{count}</Chip>
          </div>
          <Separator className="mb-4 mt-3" />
        </>
      ) : null}
      <div className={SECTION_GRID[type]}>{children}</div>
    </section>
  );
}

export default function SearchPage() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { user } = useAuth();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const q = useQueryParam("q").trim();
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
  const [previousQuery, setPreviousQuery] = useState(q);
  const [draftQuery, setDraftQuery] = useState(q);
  const resultsQuery = useQuery(searchResultsQueryOptions(q, 30, true, i18n.language));
  const items = resultsQuery.data ?? EMPTY_SEARCH_RESULTS;
  const hackathonIds = idsOf(items, "hackathon");
  const projectIds = idsOf(items, "project");
  const profileIds = idsOf(items, "profile");
  // Hackathon cards and project taxonomy both come from the cached public catalog.
  const hackathonCatalogQuery = useQuery(
    publicHackathonCatalogQueryOptions(locale, hackathonIds.length > 0 || projectIds.length > 0),
  );
  const applicantsQuery = useQuery(publicHackathonApplicantPreviewsQueryOptions(hackathonIds));
  const projectEntriesQuery = useQuery(publicProjectEntriesByIdsQueryOptions(projectIds, locale));
  const projectTeamsQuery = useQuery(publicProjectTeamsQueryOptions(projectIds));
  const projectHeartsQuery = useQuery(projectHeartsQueryOptions(user?.id, projectIds));
  const projectSavesQuery = useQuery(projectSavesQueryOptions(user?.id, projectIds));
  const projectTaxonomyQuery = useQuery({
    queryKey: ["projects", "taxonomy", locale],
    queryFn: () => listProjectTaxonomyOptions(locale),
    staleTime: 5 * 60_000,
    enabled: projectIds.length > 0,
  });
  const profilesQuery = useQuery(searchProfilesQueryOptions(profileIds));
  const participantPreviewByCourse = useMemo(
    () => new Map(items
      .filter((item) => item.entity_type === "course" && item.course)
      .map((item) => [item.entity_id, createMockParticipantPreview(item.entity_id)])),
    [items],
  );
  const hackathonById = useMemo(
    () => new Map((hackathonCatalogQuery.data ?? []).map((contest) => [contest.id, contest])),
    [hackathonCatalogQuery.data],
  );
  const projectEntryById = useMemo(
    () => new Map((projectEntriesQuery.data ?? []).map((entry) => [entry.project.id, entry])),
    [projectEntriesQuery.data],
  );
  const profileById = useMemo(
    () => new Map((profilesQuery.data ?? []).map((profile) => [profile.id, profile])),
    [profilesQuery.data],
  );
  const sections = SECTION_ORDER
    .filter((type) => activeFilter === "all" || activeFilter === type)
    .map((type) => ({ type, items: items.filter((item) => item.entity_type === type) }))
    .filter((section) => section.items.length > 0);
  const loading = Boolean(q) && resultsQuery.isPending;
  const error = resultsQuery.error instanceof Error
    ? resultsQuery.error.message
    : resultsQuery.error ? t("search.errors.loadFailed") : null;

  // A new query keeps the selected tab so refining a search stays in the same category.
  if (previousQuery !== q) {
    setPreviousQuery(q);
    setDraftQuery(q);
  }

  const renderResult = (item: SearchResultRow) => {
    const key = `${item.entity_type}:${item.entity_id}`;
    if (item.entity_type === "course" && item.course) {
      return (
        <SearchCourseResultCard
          key={key}
          item={item}
          participantPreview={participantPreviewByCourse.get(item.entity_id)!}
        />
      );
    }
    if (item.entity_type === "hackathon") {
      const contest = hackathonById.get(item.entity_id);
      if (contest) {
        return (
          <ContestCatalogCard
            key={key}
            contest={contest}
            applicants={applicantsQuery.data?.[contest.id]}
          />
        );
      }
      if (hackathonCatalogQuery.isPending) {
        return <Skeleton key={key} className="h-[202px] w-full rounded-md" />;
      }
    }
    if (item.entity_type === "project") {
      const entry = projectEntryById.get(item.entity_id);
      if (entry) {
        const { project, owner } = entry;
        return (
          <ProjectCard
            key={key}
            systemTaxonomy={projectTaxonomyQuery.data ?? []}
            hearted={projectHeartsQuery.data?.has(project.id) ?? false}
            saved={projectSavesQuery.data?.has(project.id) ?? false}
            saveStateReady={projectSavesQuery.isSuccess && !projectSavesQuery.isPlaceholderData}
            project={project}
            taxonomy={hackathonById.get(project.source_id ?? "")}
            ownerLabel={owner?.full_name ?? owner?.username}
            ownerHandle={owner?.username ?? owner?.ocid}
            ownerAvatarUrl={owner?.avatar_url}
            ownerAvatarSeed={owner?.avatar_seed}
            ownerAvatarConfig={owner?.avatar_config}
            teamMembers={projectTeamsQuery.data?.[project.id] ?? []}
          />
        );
      }
      if (projectEntriesQuery.isPending) return <ProjectCardSkeleton key={key} />;
    }
    if (item.entity_type === "profile") {
      return (
        <SearchProfileResultRow
          key={key}
          item={item}
          profile={profileById.get(item.entity_id)}
        />
      );
    }
    return <SearchResultRowLink key={key} item={item} />;
  };

  return (
    <div className="course-catalog-page course-catalog container-app pb-8 pt-6 sm:py-8">
      <div className="flex items-start gap-3">
        {/* <Search className="mt-1 size-5 text-primary" aria-hidden /> */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-heading-large font-display text-foreground">
            {q ? t("search.queryLine", { query: q }) : t("search.title")}
          </h1>
          {!q ? (
            <p className="mt-2 text-sm text-foreground-muted">
              {t("search.enterQueryHint")}
            </p>
          ) : null}

        </div>
      </div>

      <form
        role="search"
        className="mt-4 md:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          const next = draftQuery.trim();
          if (next) navigate(`/search?q=${encodeURIComponent(next)}`);
        }}
      >
        <Input
          type="search"
          variant="icon-leading"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          autoFocus={!q}
          enterKeyHint="search"
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
        />
      </form>

      <div className={cn("mt-6 transition-opacity", resultsQuery.isPlaceholderData && "opacity-60")} aria-busy={resultsQuery.isPlaceholderData || undefined}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <ShieldAlert
                className="size-6 text-foreground-subtle"
                aria-hidden
              />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
              <Button className="mt-4" variant="cta" hierarchy="secondary" onClick={() => void resultsQuery.refetch()}>{t("actions.retry")}</Button>
            </div>
          </div>
        ) : !q ? null : items.length === 0 ? (
          <div className="flex justify-center py-8 sm:py-10">
            <EmptyStateIllustration
              type="search"
              size="large"
              title={t("search.emptyTitle")}
              description={t("search.empty")}
            />
          </div>
        ) : (
          <Tabs.Root
            value={activeFilter}
            onValueChange={(value) => {
              if (isSearchFilter(value)) setActiveFilter(value);
            }}
            className="space-y-5"
          >
            <Tabs.List
              aria-label={t("search.categories")}
              className="scrollbar-design w-full overflow-x-auto"
              level="3b"
            >
              {SEARCH_FILTERS.map((filter) => (
                <Tabs.Tab
                  key={filter}
                  value={filter}
                  className="min-h-11 shrink-0"
                >
                  {t(`search.group.${filter}` as never, { defaultValue: filter })}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value={activeFilter}>
              {sections.length === 0 ? (
                <div className="flex justify-center py-8 sm:py-10">
                  <EmptyStateIllustration
                    type="search"
                    size="large"
                    title={t("search.filteredEmptyTitle")}
                    description={t("search.filteredEmpty")}
                  />
                </div>
              ) : (
                <div className="grid gap-10">
                  {sections.map((section) => (
                    <SearchSection
                      key={section.type}
                      type={section.type}
                      count={section.items.length}
                      showHeading={activeFilter === "all"}
                    >
                      {section.items.map(renderResult)}
                    </SearchSection>
                  ))}
                </div>
              )}
            </Tabs.Panel>
          </Tabs.Root>
        )}
      </div>
    </div>
  );
}
